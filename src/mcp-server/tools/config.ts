/**
 * Config MCP tools — providers, models, workbench info.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkbenchClient } from "../client.js";

export function registerConfigTools(server: McpServer, client: WorkbenchClient): void {
  // ── List providers ────────────────────────────────────────────────

  server.tool(
    "workbench_list_providers",
    "List all configured AI providers (OpenAI, Anthropic, Google, etc.) and their status.",
    {},
    async () => {
      try {
        const providers = await client.listProviders();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(providers, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── Ping/health check ────────────────────────────────────────────

  server.tool(
    "workbench_ping",
    "Check if the workbench server is running and reachable.",
    {},
    async () => {
      try {
        const alive = await client.ping();
        return {
          content: [
            {
              type: "text" as const,
              text: alive ? "Workbench is running and healthy." : "Workbench is not responding.",
            },
          ],
          isError: !alive,
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
