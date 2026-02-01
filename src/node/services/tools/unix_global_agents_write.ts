import * as path from "path";
import * as fsPromises from "fs/promises";
import { tool } from "ai";

import type { ToolConfiguration, ToolFactory } from "@/common/utils/tools/tools";
import { TOOL_DEFINITIONS } from "@/common/utils/tools/toolDefinitions";
import { UNIX_HELP_CHAT_WORKSPACE_ID } from "@/common/constants/unixChat";
import { FILE_EDIT_DIFF_OMITTED_MESSAGE } from "@/common/types/tools";
import { generateDiff } from "./fileCommon";

function getUnixHomeFromWorkspaceSessionDir(config: ToolConfiguration): string {
  if (!config.workspaceSessionDir) {
    throw new Error("unix_global_agents_write requires workspaceSessionDir");
  }

  // workspaceSessionDir = <unixHome>/sessions/<workspaceId>
  const sessionsDir = path.dirname(config.workspaceSessionDir);
  return path.dirname(sessionsDir);
}

export interface UnixGlobalAgentsWriteToolArgs {
  newContent: string;
  confirm: boolean;
}

export interface UnixGlobalAgentsWriteToolResult {
  success: true;
  diff: string;
  ui_only?: {
    file_edit?: {
      diff: string;
    };
  };
}

export interface UnixGlobalAgentsWriteToolError {
  success: false;
  error: string;
}

export type UnixGlobalAgentsWriteToolOutput =
  | UnixGlobalAgentsWriteToolResult
  | UnixGlobalAgentsWriteToolError;

export const createUnixGlobalAgentsWriteTool: ToolFactory = (config: ToolConfiguration) => {
  return tool({
    description: TOOL_DEFINITIONS.unix_global_agents_write.description,
    inputSchema: TOOL_DEFINITIONS.unix_global_agents_write.schema,
    execute: async (
      args: UnixGlobalAgentsWriteToolArgs,
      { abortSignal: _abortSignal }
    ): Promise<UnixGlobalAgentsWriteToolOutput> => {
      try {
        if (config.workspaceId !== UNIX_HELP_CHAT_WORKSPACE_ID) {
          return {
            success: false,
            error:
              "unix_global_agents_write is only available in the Chat with Lattice system workspace",
          };
        }

        if (!args.confirm) {
          return {
            success: false,
            error: "Refusing to write global AGENTS.md without confirm: true",
          };
        }

        const unixHome = getUnixHomeFromWorkspaceSessionDir(config);
        await fsPromises.mkdir(unixHome, { recursive: true });

        // Canonicalize unixHome before constructing the file path.
        const unixHomeReal = await fsPromises.realpath(unixHome);
        const agentsPath = path.join(unixHomeReal, "AGENTS.md");

        let originalContent = "";
        try {
          const stat = await fsPromises.lstat(agentsPath);
          if (stat.isSymbolicLink()) {
            return {
              success: false,
              error: "Refusing to write a symlinked AGENTS.md target",
            };
          }
          originalContent = await fsPromises.readFile(agentsPath, "utf-8");

          // If the file exists, ensure its resolved path matches the resolved unixHome target.
          const agentsPathReal = await fsPromises.realpath(agentsPath);
          if (agentsPathReal !== agentsPath) {
            return {
              success: false,
              error: "Refusing to write global AGENTS.md (path resolution mismatch)",
            };
          }
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
            throw error;
          }
          // File missing is OK (will create).
        }

        await fsPromises.writeFile(agentsPath, args.newContent, "utf-8");

        const diff = generateDiff(agentsPath, originalContent, args.newContent);

        return {
          success: true,
          diff: FILE_EDIT_DIFF_OMITTED_MESSAGE,
          ui_only: {
            file_edit: {
              diff,
            },
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to write global AGENTS.md: ${message}`,
        };
      }
    },
  });
};
