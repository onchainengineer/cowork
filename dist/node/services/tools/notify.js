"use strict";
/**
 * Notification tool - sends system notifications to the user
 *
 * This tool allows AI agents to notify users of important events using the
 * operating system's native notification system (macOS Notification Center,
 * Windows Toast notifications, Linux notification daemon).
 *
 * Uses Electron's cross-platform Notification API when available, with graceful
 * fallback for non-Electron environments. Clicking a notification navigates
 * the user to the workspace that sent it.
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
exports.createNotifyTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
/** Maximum notification body length (macOS limit is 256 bytes) */
const MAX_NOTIFICATION_BODY_LENGTH = 200;
/** Maximum notification title length */
const MAX_NOTIFICATION_TITLE_LENGTH = 64;
/**
 * Truncates text to a maximum length, adding ellipsis if truncated
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength - 1) + "…";
}
/**
 * Check if we're running in Electron environment
 */
function isElectronEnvironment() {
    return typeof process.versions.electron === "string";
}
/**
 * Send a system notification using Electron's Notification API.
 * When clicked, focuses the app and navigates to the specified workspace.
 * Returns true if notification was shown, false otherwise.
 */
async function sendElectronNotification(title, body, workspaceId) {
    if (!isElectronEnvironment()) {
        return {
            success: false,
            error: "System notifications not supported (not running in Electron)",
        };
    }
    try {
        // eslint-disable-next-line no-restricted-syntax -- Electron is unavailable in `unix server`; avoid top-level import
        const { Notification, BrowserWindow } = await Promise.resolve().then(() => __importStar(require("electron")));
        if (!Notification.isSupported()) {
            return {
                success: false,
                error: "System notifications not supported on this platform",
            };
        }
        const notification = new Notification({
            title: truncateText(title, MAX_NOTIFICATION_TITLE_LENGTH),
            body: body ? truncateText(body, MAX_NOTIFICATION_BODY_LENGTH) : undefined,
            silent: false,
        });
        // Handle notification click - focus app and navigate to workspace
        notification.on("click", () => {
            const windows = BrowserWindow.getAllWindows();
            const mainWindow = windows[0];
            if (mainWindow) {
                // Restore if minimized, then focus
                if (mainWindow.isMinimized()) {
                    mainWindow.restore();
                }
                mainWindow.focus();
                // Send IPC message to renderer to navigate to workspace
                if (workspaceId) {
                    mainWindow.webContents.send("unix:notification-clicked", { workspaceId });
                }
            }
        });
        notification.show();
        return { success: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: `Failed to send notification: ${message}`,
        };
    }
}
/**
 * Notify tool factory for AI assistant
 * Creates a tool that sends system notifications to the user
 */
const createNotifyTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.notify.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.notify.schema,
        execute: async ({ title, message }) => {
            // Validate title
            if (!title || title.trim().length === 0) {
                return {
                    success: false,
                    error: "Notification title is required and cannot be empty",
                };
            }
            const trimmedTitle = title.trim();
            const trimmedMessage = message?.trim();
            const truncatedTitle = truncateText(trimmedTitle, MAX_NOTIFICATION_TITLE_LENGTH);
            const truncatedMessage = trimmedMessage
                ? truncateText(trimmedMessage, MAX_NOTIFICATION_BODY_LENGTH)
                : undefined;
            const result = await sendElectronNotification(truncatedTitle, truncatedMessage, config.workspaceId);
            // If Electron notification succeeded, we're done
            if (result.success) {
                return {
                    success: true,
                    title: truncatedTitle,
                    message: truncatedMessage,
                    ui_only: {
                        notify: {
                            notifiedVia: "electron",
                            workspaceId: config.workspaceId,
                        },
                    },
                };
            }
            // Electron unavailable - signal frontend to handle browser notification
            // This is not an error; the notification will be delivered via Web Notifications API
            return {
                success: true,
                title: truncatedTitle,
                message: truncatedMessage,
                ui_only: {
                    notify: {
                        notifiedVia: "browser",
                        workspaceId: config.workspaceId,
                    },
                },
            };
        },
    });
};
exports.createNotifyTool = createNotifyTool;
//# sourceMappingURL=notify.js.map