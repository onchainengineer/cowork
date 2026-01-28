"use strict";
/**
 * Terminal Window Manager
 *
 * Manages pop-out terminal windows for workspaces.
 * Each workspace can have multiple terminal windows open simultaneously.
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
exports.TerminalWindowManager = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const log_1 = require("../node/services/log");
class TerminalWindowManager {
    windows = new Map(); // workspaceId -> Set of windows
    windowCount = 0; // Counter for unique window IDs
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Open a new terminal window for a workspace
     * Multiple windows can be open for the same workspace
     * @param sessionId Optional session ID to reattach to (for pop-out handoff from embedded terminal)
     */
    async openTerminalWindow(workspaceId, sessionId) {
        this.windowCount++;
        const windowId = this.windowCount;
        // Look up workspace metadata to get project and branch names
        const allWorkspaces = await this.config.getAllWorkspaceMetadata();
        const workspace = allWorkspaces.find((ws) => ws.id === workspaceId);
        let title;
        if (workspace) {
            title = `Terminal ${windowId} — ${workspace.projectName} (${workspace.name})`;
        }
        else {
            // Fallback if workspace not found
            title = `Terminal ${windowId} — ${workspaceId}`;
        }
        const terminalWindow = new electron_1.BrowserWindow({
            width: 1000,
            height: 600,
            title,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                // __dirname is dist/services/ but preload.js is in dist/
                preload: path.join(__dirname, "../preload.js"),
            },
            backgroundColor: "#1e1e1e",
        });
        // Track the window
        if (!this.windows.has(workspaceId)) {
            this.windows.set(workspaceId, new Set());
        }
        this.windows.get(workspaceId).add(terminalWindow);
        // Clean up when window is closed
        terminalWindow.on("closed", () => {
            const windowSet = this.windows.get(workspaceId);
            if (windowSet) {
                windowSet.delete(terminalWindow);
                if (windowSet.size === 0) {
                    this.windows.delete(workspaceId);
                }
            }
            log_1.log.info(`Terminal window ${windowId} closed for workspace: ${workspaceId}`);
        });
        // Load the terminal page
        // Match main window logic: use dev server unless packaged or UNIX_E2E_LOAD_DIST=1
        const forceDistLoad = process.env.UNIX_E2E_LOAD_DIST === "1";
        const useDevServer = !electron_1.app.isPackaged && !forceDistLoad;
        // Build query params including optional sessionId for session handoff
        const queryParams = { workspaceId };
        if (sessionId) {
            queryParams.sessionId = sessionId;
        }
        if (useDevServer) {
            // Development mode - load from Vite dev server
            const params = new URLSearchParams(queryParams);
            await terminalWindow.loadURL(`http://localhost:5173/terminal.html?${params.toString()}`);
            terminalWindow.webContents.openDevTools();
        }
        else {
            // Production mode (or E2E dist mode) - load from built files
            await terminalWindow.loadFile(path.join(__dirname, "../terminal.html"), {
                query: queryParams,
            });
        }
        log_1.log.info(`Terminal window ${windowId} opened for workspace: ${workspaceId}`);
    }
    /**
     * Close all terminal windows for a workspace
     */
    closeTerminalWindow(workspaceId) {
        const windowSet = this.windows.get(workspaceId);
        if (windowSet) {
            for (const window of windowSet) {
                if (!window.isDestroyed()) {
                    window.close();
                }
            }
            this.windows.delete(workspaceId);
        }
    }
    /**
     * Close all terminal windows for all workspaces
     */
    closeAll() {
        for (const [workspaceId, windowSet] of this.windows.entries()) {
            for (const window of windowSet) {
                if (!window.isDestroyed()) {
                    window.close();
                }
            }
            this.windows.delete(workspaceId);
        }
    }
    /**
     * Get all windows for a workspace
     */
    getWindows(workspaceId) {
        const windowSet = this.windows.get(workspaceId);
        if (!windowSet)
            return [];
        return Array.from(windowSet).filter((w) => !w.isDestroyed());
    }
    /**
     * Get count of open terminal windows for a workspace
     */
    getWindowCount(workspaceId) {
        return this.getWindows(workspaceId).length;
    }
}
exports.TerminalWindowManager = TerminalWindowManager;
//# sourceMappingURL=terminalWindowManager.js.map