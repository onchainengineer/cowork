/**
 * DiscordAdapter — placeholder for Discord Bot integration.
 *
 * Not yet implemented. Will use Discord Bot API (Gateway + REST)
 * to bridge Discord channels to workspace agent sessions.
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

export class DiscordAdapter extends EventEmitter implements ChannelAdapter {
  readonly type = "discord" as const;
  readonly accountId: string;

  private _status: ChannelStatus = "disconnected";

  constructor(config: ChannelConfig) {
    super();
    this.accountId = config.accountId;
  }

  get status(): ChannelStatus {
    return this._status;
  }

  async connect(_config: ChannelConfig): Promise<void> {
    throw new Error("Discord adapter is not yet implemented. Coming soon.");
  }

  async disconnect(): Promise<void> {
    this._status = "disconnected";
  }

  async sendMessage(_message: OutboundChannelMessage): Promise<ChannelSendResult> {
    return { success: false, error: "Discord adapter is not yet implemented" };
  }

  onMessage(handler: (message: ChannelMessage) => void): () => void {
    this.on("message", handler);
    return () => this.off("message", handler);
  }

  onStatusChange(handler: (status: ChannelStatus) => void): () => void {
    this.on("statusChange", handler);
    return () => this.off("statusChange", handler);
  }
}
