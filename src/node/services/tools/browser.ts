/**
 * Browser automation tool for AI agents.
 *
 * Follows the Anthropic computer-use pattern:
 * 1. Navigate → Screenshot → Observe → Act → Screenshot → Verify
 *
 * Each workspace gets its own isolated Playwright browser session.
 * Sub-agents spawned via the `task` tool also get independent sessions.
 *
 * The tool lazily creates a BrowserSessionManager-backed session on first use
 * and reuses it for subsequent calls within the same workspace.
 */

import { tool } from "ai";
import type { BrowserToolResult } from "@/common/types/tools";
import type { ToolConfiguration, ToolFactory } from "@/common/utils/tools/tools";
import { TOOL_DEFINITIONS } from "@/common/utils/tools/toolDefinitions";
import {
  BrowserSessionManager,
  type BrowserAction,
  type BrowserActionType,
} from "@/node/services/browserSessionManager";

/**
 * Global fallback BrowserSessionManager instance.
 * Used when ToolConfiguration doesn't provide one (e.g., sub-agents).
 * Each workspace still gets its own isolated browser session.
 */
let globalBrowserManager: BrowserSessionManager | null = null;

function getOrCreateManager(config: ToolConfiguration): BrowserSessionManager {
  if (config.browserSessionManager) return config.browserSessionManager;
  if (!globalBrowserManager) {
    globalBrowserManager = new BrowserSessionManager();
  }
  return globalBrowserManager;
}

/**
 * Browser tool factory — creates the `browser` tool for AI agents.
 */
export const createBrowserTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description: TOOL_DEFINITIONS.browser.description,
    inputSchema: TOOL_DEFINITIONS.browser.schema,
    execute: async (
      {
        action,
        url,
        selector,
        text,
        value,
        coordinate,
        direction,
        amount,
        full_page,
        timeout_ms,
        page_id,
        code,
      },
      { abortSignal }
    ): Promise<BrowserToolResult> => {
      try {
        if (abortSignal?.aborted) {
          return { success: false, error: "Browser action cancelled" };
        }

        const manager = getOrCreateManager(config);
        const workspaceId = config.workspaceId ?? "default";

        // Get or create a session for this workspace
        const session = await manager.getOrCreateSession(workspaceId);

        // Map tool input to BrowserAction
        const browserAction: BrowserAction = {
          action: action as BrowserActionType,
          url,
          selector,
          text,
          value,
          coordinate: coordinate as [number, number] | undefined,
          direction,
          amount,
          fullPage: full_page,
          timeoutMs: timeout_ms,
          pageId: page_id,
          code,
        };

        const result = await manager.executeAction(session.id, browserAction);

        if (!result.success) {
          return { success: false, error: result.error };
        }

        return {
          success: true,
          content_type: result.contentType,
          content: result.content,
          url: result.url,
          title: result.title,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `browser error: ${message}`,
        };
      }
    },
  });
};
