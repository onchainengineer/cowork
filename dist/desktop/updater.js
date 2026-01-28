"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdaterService = void 0;
const electron_updater_1 = require("electron-updater");
const log_1 = require("../node/services/log");
const env_1 = require("../common/utils/env");
// Update check timeout in milliseconds (30 seconds)
const UPDATE_CHECK_TIMEOUT_MS = 30_000;
/**
 * Manages application updates using electron-updater.
 *
 * This service integrates with Electron's auto-updater to:
 * - Check for updates automatically and on-demand
 * - Download updates in the background
 * - Notify the renderer process of update status changes
 * - Install updates when requested by the user
 */
class UpdaterService {
    updateStatus = { type: "idle" };
    checkTimeout = null;
    fakeVersion;
    subscribers = new Set();
    constructor() {
        // Configure auto-updater
        electron_updater_1.autoUpdater.autoDownload = false; // Wait for user confirmation
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
        // Parse DEBUG_UPDATER for dev mode and optional fake version
        const debugConfig = (0, env_1.parseDebugUpdater)(process.env.DEBUG_UPDATER);
        this.fakeVersion = debugConfig.fakeVersion;
        if (debugConfig.enabled) {
            log_1.log.debug("Forcing dev update config (DEBUG_UPDATER is set)");
            electron_updater_1.autoUpdater.forceDevUpdateConfig = true;
            if (this.fakeVersion) {
                log_1.log.debug(`DEBUG_UPDATER fake version enabled: ${this.fakeVersion}`);
            }
        }
        // Set up event handlers
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        electron_updater_1.autoUpdater.on("checking-for-update", () => {
            log_1.log.debug("Checking for updates...");
            this.updateStatus = { type: "checking" };
            this.notifyRenderer();
        });
        electron_updater_1.autoUpdater.on("update-available", (info) => {
            log_1.log.info("Update available:", info.version);
            this.clearCheckTimeout();
            this.updateStatus = { type: "available", info };
            this.notifyRenderer();
        });
        electron_updater_1.autoUpdater.on("update-not-available", () => {
            log_1.log.debug("No updates available - up to date");
            this.clearCheckTimeout();
            this.updateStatus = { type: "up-to-date" };
            this.notifyRenderer();
        });
        electron_updater_1.autoUpdater.on("download-progress", (progress) => {
            const percent = Math.round(progress.percent);
            log_1.log.debug(`Download progress: ${percent}%`);
            this.updateStatus = { type: "downloading", percent };
            this.notifyRenderer();
        });
        electron_updater_1.autoUpdater.on("update-downloaded", (info) => {
            log_1.log.info("Update downloaded:", info.version);
            this.updateStatus = { type: "downloaded", info };
            this.notifyRenderer();
        });
        electron_updater_1.autoUpdater.on("error", (error) => {
            log_1.log.error("Update error:", error);
            this.clearCheckTimeout();
            this.updateStatus = { type: "error", message: error.message };
            this.notifyRenderer();
        });
    }
    /**
     * Clear the check timeout
     */
    clearCheckTimeout() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
            this.checkTimeout = null;
        }
    }
    /**
     * Check for updates manually
     *
     * This triggers the check but returns immediately. The actual results
     * will be delivered via event handlers (checking-for-update, update-available, etc.)
     *
     * A 30-second timeout ensures we don't stay in "checking" state indefinitely.
     */
    checkForUpdates() {
        log_1.log.debug("checkForUpdates() called");
        try {
            // Clear any existing timeout
            this.clearCheckTimeout();
            // Set checking status immediately
            log_1.log.debug("Setting status to 'checking'");
            this.updateStatus = { type: "checking" };
            this.notifyRenderer();
            // If fake version is set, immediately report it as available
            if (this.fakeVersion) {
                log_1.log.debug(`Faking update available: ${this.fakeVersion}`);
                const version = this.fakeVersion;
                setTimeout(() => {
                    const fakeInfo = {
                        version,
                    };
                    this.updateStatus = {
                        type: "available",
                        info: fakeInfo,
                    };
                    this.notifyRenderer();
                }, 500); // Small delay to simulate check
                return;
            }
            // Set timeout to prevent hanging in "checking" state
            log_1.log.debug(`Setting ${UPDATE_CHECK_TIMEOUT_MS}ms timeout`);
            this.checkTimeout = setTimeout(() => {
                if (this.updateStatus.type === "checking") {
                    log_1.log.debug(`Update check timed out after ${UPDATE_CHECK_TIMEOUT_MS}ms, returning to idle state`);
                    this.updateStatus = { type: "idle" };
                    this.notifyRenderer();
                }
                else {
                    log_1.log.debug(`Timeout fired but status already changed to: ${this.updateStatus.type}`);
                }
            }, UPDATE_CHECK_TIMEOUT_MS);
            // Trigger the check (don't await - it never resolves, just fires events)
            log_1.log.debug("Calling autoUpdater.checkForUpdates()");
            electron_updater_1.autoUpdater.checkForUpdates().catch((error) => {
                this.clearCheckTimeout();
                const message = error instanceof Error ? error.message : "Unknown error";
                log_1.log.error("Update check failed:", message);
                this.updateStatus = { type: "error", message };
                this.notifyRenderer();
            });
        }
        catch (error) {
            this.clearCheckTimeout();
            const message = error instanceof Error ? error.message : "Unknown error";
            log_1.log.error("Update check error:", message);
            this.updateStatus = { type: "error", message };
            this.notifyRenderer();
        }
    }
    /**
     * Download an available update
     */
    async downloadUpdate() {
        if (this.updateStatus.type !== "available") {
            throw new Error("No update available to download");
        }
        // If using fake version, simulate download progress
        if (this.fakeVersion) {
            log_1.log.debug(`Faking download for version ${this.fakeVersion}`);
            this.updateStatus = { type: "downloading", percent: 0 };
            this.notifyRenderer();
            // Simulate download progress
            for (let percent = 0; percent <= 100; percent += 10) {
                await new Promise((resolve) => setTimeout(resolve, 200));
                this.updateStatus = { type: "downloading", percent };
                this.notifyRenderer();
            }
            // Mark as downloaded
            const version = this.fakeVersion;
            const fakeDownloadedInfo = { version };
            this.updateStatus = {
                type: "downloaded",
                info: fakeDownloadedInfo,
            };
            this.notifyRenderer();
            return;
        }
        await electron_updater_1.autoUpdater.downloadUpdate();
    }
    /**
     * Install a downloaded update and restart the app
     */
    installUpdate() {
        if (this.updateStatus.type !== "downloaded") {
            throw new Error("No update downloaded to install");
        }
        // If using fake version, just log (can't actually restart with fake update)
        if (this.fakeVersion) {
            log_1.log.debug(`Fake update install requested for ${this.fakeVersion} - would restart app here`);
            return;
        }
        electron_updater_1.autoUpdater.quitAndInstall();
    }
    /**
     * Get the current update status
     */
    /**
     * Subscribe to status updates
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }
    getStatus() {
        return this.updateStatus;
    }
    /**
     * Notify the renderer process of status changes
     */
    notifyRenderer() {
        log_1.log.debug("notifyRenderer() called, status:", this.updateStatus);
        // Notify subscribers (ORPC)
        for (const subscriber of this.subscribers) {
            try {
                subscriber(this.updateStatus);
            }
            catch (err) {
                log_1.log.error("Error notifying subscriber:", err);
            }
        }
    }
}
exports.UpdaterService = UpdaterService;
//# sourceMappingURL=updater.js.map