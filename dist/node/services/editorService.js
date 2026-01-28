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
exports.EditorService = void 0;
const child_process_1 = require("child_process");
const fsPromises = __importStar(require("fs/promises"));
const runtime_1 = require("../../common/types/runtime");
const log_1 = require("../../node/services/log");
/**
 * Quote a string for safe use in shell commands.
 *
 * IMPORTANT: Prefer spawning commands with an args array instead of building a
 * single shell string. This helper exists only for custom editor commands.
 */
function shellQuote(value) {
    if (value.length === 0)
        return process.platform === "win32" ? '""' : "''";
    // cmd.exe: use double quotes (single quotes are treated as literal characters)
    if (process.platform === "win32") {
        return `"${value.replace(/"/g, '""')}"`;
    }
    // POSIX shells: single quotes with proper escaping for embedded single quotes.
    return "'" + value.replace(/'/g, "'\"'\"'") + "'";
}
function getExecutableFromShellCommand(command) {
    const trimmed = command.trim();
    if (!trimmed)
        return null;
    const quote = trimmed[0];
    if (quote === '"' || quote === "'") {
        const endQuoteIndex = trimmed.indexOf(quote, 1);
        if (endQuoteIndex === -1) {
            return null;
        }
        return trimmed.slice(1, endQuoteIndex);
    }
    return trimmed.split(/\s+/)[0] ?? null;
}
function looksLikePath(command) {
    return (command.startsWith("./") ||
        command.startsWith("../") ||
        command.includes("/") ||
        command.includes("\\") ||
        /^[A-Za-z]:/.test(command));
}
/**
 * Service for opening workspaces in code editors.
 *
 * NOTE: VS Code/Cursor/Zed are opened via deep links in the renderer.
 * This service is only responsible for spawning the user's custom editor command.
 */
class EditorService {
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Open a path in the user's configured code editor.
     *
     * @param workspaceId - The workspace (used to determine runtime + validate constraints)
     * @param targetPath - The path to open (workspace directory or specific file)
     * @param editorConfig - Editor configuration from user settings
     */
    async openInEditor(workspaceId, targetPath, editorConfig) {
        try {
            if (editorConfig.editor !== "custom") {
                return {
                    success: false,
                    error: "Built-in editors are opened via deep links. Select Custom editor to use a command.",
                };
            }
            const customCommand = editorConfig.customCommand?.trim();
            if (!customCommand) {
                return { success: false, error: "No editor command configured" };
            }
            const allMetadata = await this.config.getAllWorkspaceMetadata();
            const workspace = allMetadata.find((w) => w.id === workspaceId);
            if (!workspace) {
                return { success: false, error: `Workspace not found: ${workspaceId}` };
            }
            // Remote runtimes: custom commands run on the local machine and can't access remote paths.
            if ((0, runtime_1.isSSHRuntime)(workspace.runtimeConfig)) {
                return {
                    success: false,
                    error: "Custom editors do not support SSH connections for SSH workspaces",
                };
            }
            if ((0, runtime_1.isDevcontainerRuntime)(workspace.runtimeConfig)) {
                return { success: false, error: "Custom editors do not support Dev Containers" };
            }
            if ((0, runtime_1.isDockerRuntime)(workspace.runtimeConfig)) {
                return { success: false, error: "Custom editors do not support Docker containers" };
            }
            const executable = getExecutableFromShellCommand(customCommand);
            if (!executable) {
                return { success: false, error: `Invalid custom editor command: ${customCommand}` };
            }
            if (!(await this.isCommandAvailable(executable))) {
                return { success: false, error: `Editor command not found: ${executable}` };
            }
            // Local - expand tilde (shellQuote prevents shell expansion)
            const resolvedPath = targetPath.startsWith("~/")
                ? targetPath.replace("~", process.env.HOME ?? "~")
                : targetPath;
            const shellCmd = `${customCommand} ${shellQuote(resolvedPath)}`;
            log_1.log.info(`Opening local path in custom editor: ${shellCmd}`);
            const child = (0, child_process_1.spawn)(shellCmd, [], {
                detached: true,
                stdio: "ignore",
                shell: true,
                windowsHide: true,
            });
            child.unref();
            return { success: true, data: undefined };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log_1.log.error(`Failed to open in editor: ${message}`);
            return { success: false, error: message };
        }
    }
    /**
     * Check if a command is available in the system PATH.
     * Inherits enriched PATH from process.env (set by initShellEnv at startup).
     */
    async isCommandAvailable(command) {
        try {
            if (looksLikePath(command)) {
                await fsPromises.access(command);
                return true;
            }
            const lookupCommand = process.platform === "win32" ? "where" : "which";
            const result = (0, child_process_1.spawnSync)(lookupCommand, [command], { encoding: "utf8" });
            return result.status === 0;
        }
        catch {
            return false;
        }
    }
}
exports.EditorService = EditorService;
//# sourceMappingURL=editorService.js.map