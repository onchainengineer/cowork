/**
 * TelegramAdapter — connects to Telegram Bot API via long-polling.
 *
 * Uses native fetch (no heavy deps). Normalizes Telegram updates into
 * the platform-agnostic ChannelMessage format.
 */
import { EventEmitter } from "events";
import type { ChannelAdapter } from "@/common/types/channel";
import type {
  ChannelConfig,
  ChannelMessage,
  ChannelStatus,
  OutboundChannelMessage,
  ChannelSendResult,
} from "@/common/orpc/schemas/channels";
import { log } from "@/node/services/log";

// ── Telegram API types (minimal subset) ─────────────────────────────────

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

// ── Adapter ─────────────────────────────────────────────────────────────

export class TelegramAdapter extends EventEmitter implements ChannelAdapter {
  readonly type = "telegram" as const;
  readonly accountId: string;

  private _status: ChannelStatus = "disconnected";
  private config?: ChannelConfig;
  private abortController?: AbortController;
  private lastUpdateId = 0;
  private polling = false;

  constructor(config: ChannelConfig) {
    super();
    this.accountId = config.accountId;
  }

  get status(): ChannelStatus {
    return this._status;
  }

  private setStatus(status: ChannelStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.emit("statusChange", status);
    }
  }

  private get token(): string {
    return this.config?.credentials.botToken ?? "";
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async connect(config: ChannelConfig): Promise<void> {
    this.config = config;

    if (!this.token) {
      throw new Error("Telegram bot token not provided in credentials.botToken");
    }

    this.setStatus("connecting");

    try {
      // Validate token via getMe
      const response = await fetch(this.apiUrl("getMe"));
      const data = (await response.json()) as TelegramApiResponse<TelegramUser>;

      if (!data.ok) {
        throw new Error(`Telegram getMe failed: ${data.description ?? "unknown error"}`);
      }

      log.info("[TelegramAdapter] Connected", {
        accountId: this.accountId,
        botUsername: data.result.username,
      });

      // Start long-polling
      this.abortController = new AbortController();
      this.polling = true;
      this.setStatus("connected");

      // Fire-and-forget polling loop
      void this.pollLoop();
    } catch (error) {
      this.setStatus("error");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.polling = false;
    this.abortController?.abort();
    this.abortController = undefined;
    this.setStatus("disconnected");
    log.info("[TelegramAdapter] Disconnected", { accountId: this.accountId });
  }

  // ── Polling ───────────────────────────────────────────────────────────

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const url = `${this.apiUrl("getUpdates")}?offset=${this.lastUpdateId + 1}&timeout=30`;
        const response = await fetch(url, {
          signal: this.abortController?.signal,
        });

        if (!response.ok) {
          log.error("[TelegramAdapter] Polling HTTP error", { status: response.status });
          await this.sleep(5000);
          continue;
        }

        const data = (await response.json()) as TelegramApiResponse<TelegramUpdate[]>;

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            if (update.message) {
              this.handleTelegramMessage(update.message);
            }
          }
        }
      } catch (error) {
        if (!this.polling) break; // Expected abort during disconnect

        log.error("[TelegramAdapter] Polling exception", { error });
        this.setStatus("error");
        await this.sleep(5000);
        if (this.polling) this.setStatus("connected"); // Retry
      }
    }
  }

  private handleTelegramMessage(msg: TelegramMessage): void {
    // Skip messages without sender (channel posts, etc.)
    if (!msg.from) return;

    const channelMessage: ChannelMessage = {
      id: `tg-${this.accountId}-${msg.message_id}`,
      channelType: "telegram",
      channelAccountId: this.accountId,
      externalMessageId: String(msg.message_id),
      direction: "inbound",
      from: {
        id: String(msg.from.id),
        username: msg.from.username,
        displayName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" "),
      },
      to: {
        id: String(msg.chat.id),
      },
      content: {
        text: msg.text,
      },
      timestamp: msg.date * 1000,
    };

    this.emit("message", channelMessage);
  }

  // ── Sending ───────────────────────────────────────────────────────────

  /**
   * Send a "typing…" indicator to a chat. Telegram shows it for ~5 seconds.
   * Call repeatedly for long operations.
   */
  async sendTypingIndicator(chatId: string): Promise<void> {
    if (!this.config) return;
    try {
      await fetch(this.apiUrl("sendChatAction"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "typing" }),
      });
    } catch {
      // Best-effort — don't fail the main flow
    }
  }

  async sendMessage(message: OutboundChannelMessage): Promise<ChannelSendResult> {
    if (!this.config) {
      return { success: false, error: "Not connected" };
    }

    const text = message.text ?? "";

    try {
      // Try sending with HTML formatting first
      let response = await fetch(this.apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.to.id,
          text: markdownToTelegramHTML(text),
          parse_mode: "HTML",
          ...(message.threadId ? { message_thread_id: Number(message.threadId) } : {}),
        }),
      });

      let data = (await response.json()) as TelegramApiResponse<TelegramMessage>;

      // If HTML parsing failed (bad entities), retry as plain text
      if (!data.ok && data.description?.includes("parse")) {
        log.warn("[TelegramAdapter] HTML parse failed, retrying as plain text", {
          error: data.description,
        });
        response = await fetch(this.apiUrl("sendMessage"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.to.id,
            text,
            ...(message.threadId ? { message_thread_id: Number(message.threadId) } : {}),
          }),
        });
        data = (await response.json()) as TelegramApiResponse<TelegramMessage>;
      }

      if (!data.ok) {
        return { success: false, error: data.description ?? "Telegram API error" };
      }

      return {
        success: true,
        externalId: String(data.result.message_id),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  // ── Event subscriptions ───────────────────────────────────────────────

  onMessage(handler: (message: ChannelMessage) => void): () => void {
    this.on("message", handler);
    return () => this.off("message", handler);
  }

  onStatusChange(handler: (status: ChannelStatus) => void): () => void {
    this.on("statusChange", handler);
    return () => this.off("statusChange", handler);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Markdown → Telegram HTML converter ──────────────────────────────────

/**
 * Convert common markdown to Telegram-supported HTML subset.
 * Telegram supports: <b>, <i>, <u>, <s>, <code>, <pre>, <a href="">.
 *
 * This is intentionally simple — handles the most common patterns
 * from LLM output without pulling in a full markdown parser.
 */
function markdownToTelegramHTML(md: string): string {
  // First, escape HTML entities in the source text
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```lang\n...\n``` → <pre><code class="language-lang">...</code></pre>
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const langAttr = lang ? ` class="language-${lang}"` : "";
      return `<pre><code${langAttr}>${code.trimEnd()}</code></pre>`;
    }
  );

  // Inline code: `...` → <code>...</code>
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Bold: **text** or __text__ → <b>text</b>
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ → <i>text</i>  (but not inside words like file_name)
  html = html.replace(/(?<![\\w*])\*([^*\n]+)\*(?![\\w*])/g, "<i>$1</i>");
  html = html.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "<i>$1</i>");

  // Strikethrough: ~~text~~ → <s>text</s>
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links: [text](url) → <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Headings: # text → <b>text</b> (Telegram has no heading tag)
  html = html.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // Bullet lists: - item or * item → • item
  html = html.replace(/^[\s]*[-*]\s+/gm, "• ");

  // Numbered lists: keep as-is (1. item)

  // Horizontal rules: --- or *** → ———
  html = html.replace(/^[-*]{3,}$/gm, "———");

  return html;
}
