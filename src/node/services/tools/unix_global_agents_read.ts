import * as path from "path";
import * as fsPromises from "fs/promises";
import { tool } from "ai";

import type { ToolConfiguration, ToolFactory } from "@/common/utils/tools/tools";
import { TOOL_DEFINITIONS } from "@/common/utils/tools/toolDefinitions";
import { UNIX_HELP_CHAT_WORKSPACE_ID } from "@/common/constants/unixChat";

function getUnixHomeFromWorkspaceSessionDir(config: ToolConfiguration): string {
  if (!config.workspaceSessionDir) {
    throw new Error("unix_global_agents_read requires workspaceSessionDir");
  }

  // workspaceSessionDir = <unixHome>/sessions/<workspaceId>
  const sessionsDir = path.dirname(config.workspaceSessionDir);
  return path.dirname(sessionsDir);
}

export interface UnixGlobalAgentsReadToolResult {
  success: true;
  content: string;
}

export interface UnixGlobalAgentsReadToolError {
  success: false;
  error: string;
}

export type UnixGlobalAgentsReadToolOutput =
  | UnixGlobalAgentsReadToolResult
  | UnixGlobalAgentsReadToolError;

export const createUnixGlobalAgentsReadTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description: TOOL_DEFINITIONS.unix_global_agents_read.description,
    inputSchema: TOOL_DEFINITIONS.unix_global_agents_read.schema,
    execute: async (
      _args,
      { abortSignal: _abortSignal }
    ): Promise<UnixGlobalAgentsReadToolOutput> => {
      try {
        if (config.workspaceId !== UNIX_HELP_CHAT_WORKSPACE_ID) {
          return {
            success: false,
            error: "unix_global_agents_read is only available in the Chat with Unix system workspace",
          };
        }

        const unixHome = getUnixHomeFromWorkspaceSessionDir(config);
        const agentsPath = path.join(unixHome, "AGENTS.md");

        try {
          const stat = await fsPromises.lstat(agentsPath);
          if (stat.isSymbolicLink()) {
            return {
              success: false,
              error: "Refusing to read a symlinked AGENTS.md target",
            };
          }

          const content = await fsPromises.readFile(agentsPath, "utf-8");
          return { success: true, content };
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return { success: true, content: "" };
          }

          throw error;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to read global AGENTS.md: ${message}`,
        };
      }
    },
  });
};
