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
exports.createUnixGlobalAgentsReadTool = void 0;
const path = __importStar(require("path"));
const fsPromises = __importStar(require("fs/promises"));
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const unixChat_1 = require("../../../common/constants/unixChat");
function getUnixHomeFromWorkspaceSessionDir(config) {
    if (!config.workspaceSessionDir) {
        throw new Error("unix_global_agents_read requires workspaceSessionDir");
    }
    // workspaceSessionDir = <unixHome>/sessions/<workspaceId>
    const sessionsDir = path.dirname(config.workspaceSessionDir);
    return path.dirname(sessionsDir);
}
const createUnixGlobalAgentsReadTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.unix_global_agents_read.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.unix_global_agents_read.schema,
        execute: async (_args, { abortSignal: _abortSignal }) => {
            try {
                if (config.workspaceId !== unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID) {
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
                }
                catch (error) {
                    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                        return { success: true, content: "" };
                    }
                    throw error;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    error: `Failed to read global AGENTS.md: ${message}`,
                };
            }
        },
    });
};
exports.createUnixGlobalAgentsReadTool = createUnixGlobalAgentsReadTool;
//# sourceMappingURL=unix_global_agents_read.js.map