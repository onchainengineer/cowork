"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUnixGlobalAgentsWriteTool = void 0;
const path = __importStar(require("path"));
const fsPromises = __importStar(require("fs/promises"));
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const unixChat_1 = require("../../../common/constants/unixChat");
const tools_1 = require("../../../common/types/tools");
const fileCommon_1 = require("./fileCommon");
function getUnixHomeFromWorkspaceSessionDir(config) {
    if (!config.workspaceSessionDir) {
        throw new Error("unix_global_agents_write requires workspaceSessionDir");
    }
    // workspaceSessionDir = <unixHome>/sessions/<workspaceId>
    const sessionsDir = path.dirname(config.workspaceSessionDir);
    return path.dirname(sessionsDir);
}
const createUnixGlobalAgentsWriteTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.unix_global_agents_write.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.unix_global_agents_write.schema,
        execute: async (args, { abortSignal: _abortSignal }) => {
            try {
                if (config.workspaceId !== unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID) {
                    return {
                        success: false,
                        error: "unix_global_agents_write is only available in the Chat with Unix system workspace",
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
                }
                catch (error) {
                    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                        throw error;
                    }
                    // File missing is OK (will create).
                }
                await fsPromises.writeFile(agentsPath, args.newContent, "utf-8");
                const diff = (0, fileCommon_1.generateDiff)(agentsPath, originalContent, args.newContent);
                return {
                    success: true,
                    diff: tools_1.FILE_EDIT_DIFF_OMITTED_MESSAGE,
                    ui_only: {
                        file_edit: {
                            diff,
                        },
                    },
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    error: `Failed to write global AGENTS.md: ${message}`,
                };
            }
        },
    });
};
exports.createUnixGlobalAgentsWriteTool = createUnixGlobalAgentsWriteTool;
//# sourceMappingURL=unix_global_agents_write.js.map