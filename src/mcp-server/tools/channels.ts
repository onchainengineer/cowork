/**
 * Channel MCP tools — manage Telegram/Discord channels from outside.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkbenchClient } from "../client.js";

export function registerChannelTools(server: McpServer, client: WorkbenchClient): void {
  // ── List channels ─────────────────────────────────────────────────

  server.tool(
    "workbench_list_channels",
    "List all configured messaging channels (Telegram, Discord, etc.) with their connection status and session counts.",
    {},
    async () => {
      try {
        const channels = await client.listChannels();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(channels, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── Connect channel ───────────────────────────────────────────────

  server.tool(
    "workbench_connect_channel",
    "Connect a messaging channel adapter (start the bot).",
    {
      accountId: z.string().describe("The channel account ID to connect"),
    },
    async ({ accountId }) => {
      try {
        const result = await client.connectChannel(accountId);
        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: `Failed: ${result.error}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Channel "${accountId}" connected.` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── Disconnect channel ────────────────────────────────────────────

  server.tool(
    "workbench_disconnect_channel",
    "Disconnect a messaging channel adapter (stop the bot).",
    {
      accountId: z.string().describe("The channel account ID to disconnect"),
    },
    async ({ accountId }) => {
      try {
        const result = await client.disconnectChannel(accountId);
        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: `Failed: ${result.error}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Channel "${accountId}" disconnected.` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── Send channel message ──────────────────────────────────────────

  server.tool(
    "workbench_send_channel_message",
    "Send a message to a specific peer through a messaging channel (e.g., send a Telegram message to a user).",
    {
      accountId: z.string().describe("The channel account ID (e.g., 'mybot')"),
      to: z.string().describe("The recipient's ID (e.g., Telegram chat ID)"),
      text: z.string().describe("The message text to send"),
    },
    async ({ accountId, to, text }) => {
      try {
        const result = await client.sendChannelMessage(accountId, to, text);
        if (!result.success) {
          return {
            content: [{ type: "text" as const, text: `Failed: ${result.error}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Message sent to ${to} via ${accountId}.` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
