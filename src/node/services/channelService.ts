/**
 * ChannelService — manages cross-platform messaging channel adapters.
 *
 * Channels are workbench-scoped: each adapter instance represents one external identity
 * (e.g., one Telegram bot) that serves the entire workbench. Inbound messages are routed
 * to workspaces via the ChannelSessionRouter (OpenClaw pattern), which maps each external
 * peer to an isolated workspace session.
 *
 * Follows the same EventEmitter + ORPC patterns as WorkspaceService.
 */
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { log } from "@/node/services/log";
import { defaultModel } from "@/common/utils/ai/models";
import type { Config } from "@/node/config";
import type { WorkspaceService } from "@/node/services/workspaceService";
import type { ChannelAdapter } from "@/common/types/channel";
import type {
  ChannelConfig,
  ChannelMessage,
  ChannelStatus,
  ChannelType,
  OutboundChannelMessage,
  ChannelSendResult,
  ChannelListItem,
} from "@/common/orpc/schemas/channels";
import type { WorkspaceChatMessage } from "@/common/orpc/types";
import { ChannelConfigSchema } from "@/common/orpc/schemas/channels";
import { TelegramAdapter } from "./channels/telegram/TelegramAdapter";
import { DiscordAdapter } from "./channels/discord/DiscordAdapter";
import type { ChannelSessionRouter } from "./channelSessionRouter";

// ── Event types ─────────────────────────────────────────────────────────

export interface ChannelServiceEvents {
  message: (message: ChannelMessage) => void;
  statusChange: (accountId: string, status: ChannelStatus) => void;
}

export declare interface ChannelService {
  on<U extends keyof ChannelServiceEvents>(event: U, listener: ChannelServiceEvents[U]): this;
  off<U extends keyof ChannelServiceEvents>(event: U, listener: ChannelServiceEvents[U]): this;
  emit<U extends keyof ChannelServiceEvents>(
    event: U,
    ...args: Parameters<ChannelServiceEvents[U]>
  ): boolean;
}

// ── Service ─────────────────────────────────────────────────────────────

export class ChannelService extends EventEmitter {
  private readonly adapters = new Map<string, ChannelAdapter>();
  private readonly configs = new Map<string, ChannelConfig>();
  private readonly channelsFile: string;

  /** Accumulates stream-delta text per workspace for outbound channel responses */
  private readonly pendingResponses = new Map<string, string>();

  /** Typing indicator intervals per workspace — sends "typing" every 4s while streaming */
  private readonly typingIntervals = new Map<string, ReturnType<typeof setInterval>>();

  /** Factory registry — maps channel type → adapter constructor */
  private readonly adapterFactories = new Map<ChannelType, (config: ChannelConfig) => ChannelAdapter>(
    [
      ["telegram", (cfg) => new TelegramAdapter(cfg)],
      ["discord", (cfg) => new DiscordAdapter(cfg)],
    ]
  );

  constructor(
    private readonly config: Config,
    private readonly workspaceService: WorkspaceService,
    private readonly sessionRouter: ChannelSessionRouter
  ) {
    super();
    this.channelsFile = path.join(config.rootDir, "channels.json");
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Initialize: load persisted configs, load session mappings, and auto-connect enabled channels.
   * Called during ServiceContainer.initialize().
   */
  async initialize(): Promise<void> {
    this.loadConfigs();
    this.sessionRouter.loadSessions();

    // Listen for workspace chat events and route assistant responses back to channel peers
    this.workspaceService.on("chat", (event: { workspaceId: string; message: WorkspaceChatMessage }) => {
      this.handleOutboundChatEvent(event.workspaceId, event.message);
    });

    // Auto-connect all enabled channels (best-effort, don't block startup)
    const enabledConfigs = Array.from(this.configs.values()).filter((c) => c.enabled);
    for (const cfg of enabledConfigs) {
      try {
        await this.connectChannel(cfg.accountId);
      } catch (error) {
        log.warn("[ChannelService] Failed to auto-connect channel on startup", {
          accountId: cfg.accountId,
          type: cfg.type,
          error,
        });
      }
    }
  }

  /**
   * Gracefully disconnect all adapters. Called during ServiceContainer.shutdown().
   */
  async shutdown(): Promise<void> {
    const disconnections = Array.from(this.adapters.keys()).map((accountId) =>
      this.disconnectChannel(accountId).catch((error) => {
        log.warn("[ChannelService] Error disconnecting channel during shutdown", {
          accountId,
          error,
        });
      })
    );
    await Promise.all(disconnections);
  }

  // ── Config persistence ──────────────────────────────────────────────

  private loadConfigs(): void {
    try {
      if (!fs.existsSync(this.channelsFile)) {
        return;
      }
      const raw = fs.readFileSync(this.channelsFile, "utf-8");
      const parsed = JSON.parse(raw) as unknown[];

      if (!Array.isArray(parsed)) {
        log.warn("[ChannelService] channels.json is not an array, ignoring");
        return;
      }

      for (const item of parsed) {
        // Try new schema first, then attempt migration from old format
        let result = ChannelConfigSchema.safeParse(item);

        if (!result.success && typeof item === "object" && item !== null) {
          const migrated = this.migrateOldConfig(item as Record<string, unknown>);
          if (migrated) {
            result = ChannelConfigSchema.safeParse(migrated);
          }
        }

        if (result.success) {
          this.configs.set(result.data.accountId, result.data);
        } else {
          log.warn("[ChannelService] Invalid channel config entry, skipping", {
            error: result.error.message,
          });
        }
      }

      log.debug("[ChannelService] Loaded channel configs", { count: this.configs.size });
    } catch (error) {
      log.warn("[ChannelService] Failed to load channels.json", { error });
    }
  }

  /**
   * Migrate old project-scoped config to new workbench-scoped format.
   */
  private migrateOldConfig(old: Record<string, unknown>): Record<string, unknown> | null {
    if ("projectPath" in old || "defaultWorkspaceId" in old) {
      log.info("[ChannelService] Migrating old project-scoped channel config", {
        accountId: old.accountId,
      });
      const { projectPath, defaultWorkspaceId, ...rest } = old;
      return {
        ...rest,
        defaultProjectPath: projectPath,
        sessionScope: "per-peer",
      };
    }
    return null;
  }

  private saveConfigs(): void {
    try {
      const data = Array.from(this.configs.values());
      fs.writeFileSync(this.channelsFile, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      log.error("[ChannelService] Failed to save channels.json", { error });
    }
  }

  // ── CRUD operations ─────────────────────────────────────────────────

  async createChannel(config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    if (this.configs.has(config.accountId)) {
      return { success: false, error: `Channel "${config.accountId}" already exists` };
    }

    this.configs.set(config.accountId, config);
    this.saveConfigs();

    if (config.enabled) {
      const connectResult = await this.connectChannel(config.accountId);
      if (!connectResult.success) {
        return connectResult;
      }
    }

    log.info("[ChannelService] Channel created", { accountId: config.accountId, type: config.type });
    return { success: true };
  }

  async updateChannel(config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    if (!this.configs.has(config.accountId)) {
      return { success: false, error: `Channel "${config.accountId}" not found` };
    }

    // Disconnect if currently connected (will reconnect with new config if enabled)
    if (this.adapters.has(config.accountId)) {
      await this.disconnectChannel(config.accountId);
    }

    this.configs.set(config.accountId, config);
    this.saveConfigs();

    if (config.enabled) {
      const connectResult = await this.connectChannel(config.accountId);
      if (!connectResult.success) {
        return connectResult;
      }
    }

    log.info("[ChannelService] Channel updated", { accountId: config.accountId });
    return { success: true };
  }

  async removeChannel(accountId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.configs.has(accountId)) {
      return { success: false, error: `Channel "${accountId}" not found` };
    }

    if (this.adapters.has(accountId)) {
      await this.disconnectChannel(accountId);
    }

    this.configs.delete(accountId);
    this.saveConfigs();

    log.info("[ChannelService] Channel removed", { accountId });
    return { success: true };
  }

  // ── Connection management ───────────────────────────────────────────

  async connectChannel(accountId: string): Promise<{ success: boolean; error?: string }> {
    const config = this.configs.get(accountId);
    if (!config) {
      return { success: false, error: `Channel "${accountId}" not found` };
    }

    if (this.adapters.has(accountId)) {
      return { success: false, error: `Channel "${accountId}" is already connected` };
    }

    const factory = this.adapterFactories.get(config.type);
    if (!factory) {
      return { success: false, error: `Unsupported channel type: ${config.type}` };
    }

    try {
      const adapter = factory(config);

      // Subscribe to adapter events — forward to ChannelService EventEmitter
      adapter.onMessage((message) => {
        this.handleInboundMessage(message);
      });

      adapter.onStatusChange((status) => {
        this.emit("statusChange", accountId, status);
      });

      await adapter.connect(config);
      this.adapters.set(accountId, adapter);

      log.info("[ChannelService] Channel connected", { accountId, type: config.type });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("[ChannelService] Failed to connect channel", { accountId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  async disconnectChannel(accountId: string): Promise<{ success: boolean; error?: string }> {
    const adapter = this.adapters.get(accountId);
    if (!adapter) {
      return { success: false, error: `Channel "${accountId}" is not connected` };
    }

    try {
      await adapter.disconnect();
      this.adapters.delete(accountId);

      log.info("[ChannelService] Channel disconnected", { accountId });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("[ChannelService] Failed to disconnect channel", { accountId, error: errorMessage });
      // Remove from map even on error — adapter is in unknown state
      this.adapters.delete(accountId);
      return { success: false, error: errorMessage };
    }
  }

  // ── Messaging ───────────────────────────────────────────────────────

  async sendMessage(accountId: string, message: OutboundChannelMessage): Promise<ChannelSendResult> {
    const adapter = this.adapters.get(accountId);
    if (!adapter) {
      return { success: false, error: `Channel "${accountId}" is not connected` };
    }

    try {
      return await adapter.sendMessage(message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error("[ChannelService] Failed to send message", { accountId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────

  listChannels(): ChannelListItem[] {
    return Array.from(this.configs.values()).map((config) => ({
      type: config.type,
      accountId: config.accountId,
      sessionScope: config.sessionScope ?? "per-peer",
      status: this.adapters.get(config.accountId)?.status ?? "disconnected",
      enabled: config.enabled,
      sessionCount: this.sessionRouter.listSessions(config.accountId).length,
    }));
  }

  getConfig(accountId: string): ChannelConfig | undefined {
    return this.configs.get(accountId);
  }

  // ── Outbound response routing ─────────────────────────────────────

  /**
   * Handle workspace chat events. Accumulates stream-delta text and sends the
   * complete response back to the channel peer on stream-end.
   *
   * Flow: stream-start → stream-delta (accumulated) → stream-end (send to TG)
   */
  private handleOutboundChatEvent(workspaceId: string, message: WorkspaceChatMessage): void {
    try {
      // Only process workspaces that belong to a channel session
      const session = this.sessionRouter.findByWorkspaceId(workspaceId);
      if (!session) return;

      switch (message.type) {
        case "stream-start": {
          // Reset accumulator for new response
          this.pendingResponses.set(workspaceId, "");

          // Start typing indicator — Telegram shows "typing…" for ~5s,
          // so we send it immediately and repeat every 4s
          this.startTypingIndicator(session.accountId, session.peerId, workspaceId);
          break;
        }

        case "stream-delta": {
          // Accumulate text deltas
          const current = this.pendingResponses.get(workspaceId) ?? "";
          this.pendingResponses.set(workspaceId, current + (message as { delta: string }).delta);
          break;
        }

        case "stream-end": {
          // Stop typing indicator
          this.stopTypingIndicator(workspaceId);

          // Flush accumulated response to channel
          const fullText = this.pendingResponses.get(workspaceId)?.trim();
          this.pendingResponses.delete(workspaceId);

          if (!fullText) return;

          this.sendResponseToChannel(session.accountId, session.peerId, fullText, workspaceId);
          break;
        }

        case "stream-abort": {
          // Stop typing + discard accumulated text
          this.stopTypingIndicator(workspaceId);
          this.pendingResponses.delete(workspaceId);
          break;
        }
      }
    } catch (error) {
      log.error("[ChannelService] Error in outbound chat event handler", { workspaceId, error });
    }
  }

  /**
   * Send a response back to a channel peer. The LLM is instructed to use "---"
   * as a message break delimiter when it wants to split into multiple messages.
   * We split on that, add typing indicators between messages, and send sequentially.
   */
  private sendResponseToChannel(
    accountId: string,
    peerId: string,
    text: string,
    workspaceId: string
  ): void {
    const adapter = this.adapters.get(accountId);
    if (!adapter) {
      log.warn("[ChannelService] No connected adapter for outbound response", {
        accountId,
        workspaceId,
      });
      return;
    }

    // Split on LLM-provided message breaks (--- on its own line)
    // Then hard-split any chunk that still exceeds Telegram's 4096 limit
    const rawParts = text.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
    const messages: string[] = [];
    for (const part of rawParts) {
      if (part.length <= 4096) {
        messages.push(part);
      } else {
        messages.push(...hardSplit(part, 4096));
      }
    }

    if (messages.length === 0) return;

    // Send sequentially with typing indicators between messages
    const sendSequence = async () => {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]!;

        if (i > 0) {
          // Show typing indicator + pause proportional to message length
          if (adapter.sendTypingIndicator) {
            await adapter.sendTypingIndicator(peerId).catch(() => {});
          }
          const typingMs = Math.min(Math.max(msg.length * 5, 600), 2500);
          await new Promise((r) => setTimeout(r, typingMs));
        }

        await adapter.sendMessage({ to: { id: peerId }, text: msg }).catch((error) => {
          log.error("[ChannelService] Failed to send outbound response to channel", {
            accountId,
            peerId,
            error,
          });
        });
      }
    };

    sendSequence().catch((error) => {
      log.error("[ChannelService] Error in outbound send chain", { accountId, workspaceId, error });
    });
  }

  // ── Typing indicator ─────────────────────────────────────────────────

  private startTypingIndicator(accountId: string, peerId: string, workspaceId: string): void {
    // Clear any existing interval for this workspace
    this.stopTypingIndicator(workspaceId);

    const adapter = this.adapters.get(accountId);
    if (!adapter?.sendTypingIndicator) return;

    // Send immediately
    adapter.sendTypingIndicator(peerId).catch(() => {});

    // Repeat every 4 seconds (Telegram typing expires after ~5s)
    const interval = setInterval(() => {
      const a = this.adapters.get(accountId);
      if (a?.sendTypingIndicator) {
        a.sendTypingIndicator(peerId).catch(() => {});
      } else {
        this.stopTypingIndicator(workspaceId);
      }
    }, 4000);

    this.typingIntervals.set(workspaceId, interval);
  }

  private stopTypingIndicator(workspaceId: string): void {
    const interval = this.typingIntervals.get(workspaceId);
    if (interval) {
      clearInterval(interval);
      this.typingIntervals.delete(workspaceId);
    }
  }

  // ── Inbound message handling ────────────────────────────────────────

  /**
   * Handle an inbound message from an external channel.
   * Routes to the appropriate workspace via the session router (OpenClaw pattern).
   */
  private async handleInboundMessage(message: ChannelMessage): Promise<void> {
    try {
      const config = this.configs.get(message.channelAccountId);
      if (!config) {
        log.warn("[ChannelService] Received message for unconfigured channel", {
          channelAccountId: message.channelAccountId,
        });
        return;
      }

      // Always emit for ORPC streaming subscribers (channels.onMessage)
      this.emit("message", message);

      // Route to workspace via session router
      const { workspaceId, isNew } = await this.sessionRouter.resolve(message, config);

      if (isNew) {
        log.info("[ChannelService] Created new workspace for channel peer", {
          workspaceId,
          peerId: message.from.id,
          channel: config.type,
        });
      }

      // Build prefixed message with sender context
      const senderLabel = message.from.displayName ?? message.from.username ?? message.from.id;
      const prefix = `[${config.type}/${senderLabel}]`;
      const text = message.content.text ?? "";

      // Download attachments and convert to fileParts for multimodal LLM input
      const fileParts: Array<{ url: string; mediaType: string; filename?: string }> = [];
      const attachmentDescs: string[] = [];

      if (message.content.attachments?.length) {
        const adapter = this.adapters.get(message.channelAccountId);

        for (const att of message.content.attachments) {
          // Try to download the file and pass as vision input
          if (adapter?.downloadFile && att.url) {
            // Extract platform file ID from the URL (e.g. "tg-file://ABC123" → "ABC123")
            const fileId = att.url.replace(/^tg-file:\/\//, "").replace(/^discord-file:\/\//, "");
            try {
              const downloaded = await adapter.downloadFile(fileId);
              if (downloaded && downloaded.mimeType.startsWith("image/")) {
                fileParts.push({
                  url: downloaded.dataUrl,
                  mediaType: downloaded.mimeType,
                  filename: att.filename,
                });
                log.info("[ChannelService] Downloaded image for multimodal input", {
                  type: att.type,
                  mimeType: downloaded.mimeType,
                });
                continue; // Successfully downloaded — skip text fallback
              } else if (downloaded && downloaded.mimeType === "application/pdf") {
                fileParts.push({
                  url: downloaded.dataUrl,
                  mediaType: downloaded.mimeType,
                  filename: att.filename,
                });
                continue;
              }
            } catch (error) {
              log.warn("[ChannelService] Failed to download attachment, falling back to text description", {
                error,
              });
            }
          }

          // Fallback: describe attachment as text if download failed or unsupported
          if (att.type === "image") {
            attachmentDescs.push("[📷 Image attached — could not download]");
          } else if (att.type === "file") {
            attachmentDescs.push(`[📎 File: ${att.filename ?? "unknown"}]`);
          } else {
            attachmentDescs.push(`[📁 ${att.type}]`);
          }
        }
      }

      const parts = [prefix, text, ...attachmentDescs].filter(Boolean);
      const fullMessage = parts.join(" ");

      // Resolve the model from the workspace's own AI settings so that if the
      // user switches models in the workbench UI, Telegram messages honour that
      // choice. Falls back to platform default only when no setting exists yet.
      const agentId = "exec";
      const found = this.config.findWorkspace(workspaceId);
      let model = defaultModel;
      if (found) {
        const wsConfig = this.config.loadConfigOrDefault();
        const project = wsConfig.projects.get(found.projectPath);
        const ws = project?.workspaces.find((w) => w.id === workspaceId);
        const wsModel =
          ws?.aiSettingsByAgent?.[agentId]?.model ??
          ws?.aiSettings?.model;
        if (wsModel) model = wsModel as typeof defaultModel;
      }

      const result = await this.workspaceService.sendMessage(
        workspaceId,
        fullMessage,
        {
          model,
          agentId,
          additionalSystemInstructions: getChannelSystemPrompt(config.type),
          ...(fileParts.length > 0 ? { fileParts } : {}),
        }
      );

      if (!result.success) {
        log.error("[ChannelService] Failed to forward channel message to workspace", {
          workspaceId,
          error: result.error,
        });
      }
    } catch (error) {
      log.error("[ChannelService] Error handling inbound channel message", { error });
    }
  }
}

// ── Channel system prompts ────────────────────────────────────────────────

/**
 * Platform-specific system instructions that tell the LLM how to craft its
 * response for the target channel. The LLM handles formatting, tone, length,
 * and message splitting natively — no post-processing gymnastics needed.
 */
const CHANNEL_SYSTEM_PROMPTS: Record<string, string> = {
  telegram: `You are responding via Telegram. Follow these rules:
• Write conversationally — short, punchy messages like a real person chatting.
• Keep each message under 3000 characters. Most messages should be much shorter.
• If your response is long, split it into multiple messages using "---" on its own line as a separator. Each part should feel like a natural follow-up, not a chopped-up wall of text.
• Use Telegram-friendly formatting: *bold*, _italic_, \`inline code\`, \`\`\`code blocks\`\`\`. No HTML tags.
• Use emoji naturally but don't overdo it.
• Bullet points and numbered lists are fine — keep them tight.
• Don't use markdown headers (# etc.) — Telegram doesn't render them.
• For code: use \`\`\`language blocks. If the code is long, put it in its own message (use --- before and after).
• Be direct. Skip filler phrases like "Great question!" or "Sure, I'd be happy to help!".
• Match the user's energy — if they're casual, be casual. If they're technical, be technical.`,

  discord: `You are responding via Discord. Follow these rules:
• Write conversationally — Discord users expect chat-style responses.
• Keep each message under 1800 characters (Discord limit is 2000, leave margin).
• If your response is long, split it into multiple messages using "---" on its own line as a separator.
• Use Discord markdown: **bold**, *italic*, __underline__, ~~strikethrough~~, \`inline code\`, \`\`\`code blocks\`\`\`.
• Use emoji naturally.
• For code: use \`\`\`language blocks. Long code gets its own message.
• Be direct and skip filler.`,

  slack: `You are responding via Slack. Follow these rules:
• Write conversationally — Slack users expect concise, scannable messages.
• Keep each message under 3000 characters.
• If your response is long, split it into multiple messages using "---" on its own line as a separator.
• Use Slack mrkdwn: *bold*, _italic_, ~strikethrough~, \`inline code\`, \`\`\`code blocks\`\`\`.
• Use emoji codes like :thumbsup: naturally.
• Bullet points with • or - are great for lists.
• Be direct and skip filler.`,

  whatsapp: `You are responding via WhatsApp. Follow these rules:
• Write very conversationally — like texting a friend.
• Keep messages short. Most should be 1-3 sentences.
• If your response is long, split it into multiple messages using "---" on its own line as a separator.
• Use WhatsApp formatting: *bold*, _italic_, ~strikethrough~, \`\`\`monospace\`\`\`.
• Use emoji naturally — WhatsApp users expect them.
• No code blocks or technical formatting — keep it simple.
• Be direct and casual.`,
};

function getChannelSystemPrompt(channelType: string): string {
  return CHANNEL_SYSTEM_PROMPTS[channelType] ?? CHANNEL_SYSTEM_PROMPTS.telegram!;
}

// ── Safety-net splitting ──────────────────────────────────────────────────

/**
 * Hard-split a message that exceeds the platform max length.
 * Only used as a safety net — the LLM should already handle splitting via "---".
 */
function hardSplit(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.3) {
      cut = remaining.lastIndexOf(" ", maxLen);
    }
    if (cut < maxLen * 0.3) {
      cut = maxLen;
    }

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
