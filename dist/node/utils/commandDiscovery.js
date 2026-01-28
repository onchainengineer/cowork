"use strict";
/**
 * Utilities for discovering available commands in the system.
 * Used by terminalService and openInEditor to find executables.
 */
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
exports.TERMINAL_EMULATORS = exports.TERMINAL_EDITORS = exports.GUI_EDITORS = void 0;
exports.isCommandAvailable = isCommandAvailable;
exports.findAvailableCommand = findAvailableCommand;
const fs = __importStar(require("fs/promises"));
const child_process_1 = require("child_process");
/** Known installation paths for GUI editors on macOS */
const MACOS_APP_PATHS = {
    cursor: ["/Applications/Cursor.app/Contents/Resources/app/bin/cursor", "/usr/local/bin/cursor"],
    code: [
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        "/usr/local/bin/code",
    ],
    zed: ["/Applications/Zed.app/Contents/MacOS/cli", "/usr/local/bin/zed"],
    subl: ["/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl", "/usr/local/bin/subl"],
    ghostty: [
        "/opt/homebrew/bin/ghostty",
        "/Applications/Ghostty.app/Contents/MacOS/ghostty",
        "/usr/local/bin/ghostty",
    ],
};
/**
 * Check if a command is available in the system PATH or known locations.
 * First checks macOS-specific paths for known apps, then falls back to `which`.
 */
async function isCommandAvailable(command) {
    // Check known paths for macOS apps
    if (process.platform === "darwin" && command in MACOS_APP_PATHS) {
        for (const appPath of MACOS_APP_PATHS[command]) {
            try {
                const stats = await fs.stat(appPath);
                // Check if it's a file and any executable bit is set
                if (stats.isFile() && (stats.mode & 0o111) !== 0) {
                    return true;
                }
            }
            catch {
                // Try next path
            }
        }
    }
    // Fall back to which (inherits enriched PATH from process.env)
    try {
        const result = (0, child_process_1.spawnSync)("which", [command], { encoding: "utf8" });
        return result.status === 0;
    }
    catch {
        return false;
    }
}
/**
 * Find the first available command from a list of candidates.
 * Returns the command name (not full path) of the first available one.
 */
async function findAvailableCommand(commands) {
    for (const cmd of commands) {
        if (await isCommandAvailable(cmd)) {
            return cmd;
        }
    }
    return null;
}
/** GUI editors that spawn detached (no terminal needed) */
exports.GUI_EDITORS = ["cursor", "code", "zed", "subl"];
/** Terminal editors that require a terminal session */
exports.TERMINAL_EDITORS = ["nvim", "vim", "vi", "nano", "emacs"];
/** All known GUI terminal emulators */
exports.TERMINAL_EMULATORS = ["ghostty", "kitty", "alacritty", "wezterm", "iterm2"];
//# sourceMappingURL=commandDiscovery.js.map