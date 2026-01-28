"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const events_1 = require("events");
const updater_1 = require("./updater");
// Create a mock autoUpdater that's an EventEmitter with the required methods
const mockAutoUpdater = Object.assign(new events_1.EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates: (0, bun_test_1.mock)(() => Promise.resolve()),
    downloadUpdate: (0, bun_test_1.mock)(() => Promise.resolve()),
    quitAndInstall: (0, bun_test_1.mock)(() => {
        // Mock implementation - does nothing in tests
    }),
});
// Mock electron-updater module
void bun_test_1.mock.module("electron-updater", () => ({
    autoUpdater: mockAutoUpdater,
}));
(0, bun_test_1.describe)("UpdaterService", () => {
    let service;
    let statusUpdates;
    let originalDebugUpdater;
    (0, bun_test_1.beforeEach)(() => {
        // Reset mocks
        mockAutoUpdater.checkForUpdates.mockClear();
        mockAutoUpdater.downloadUpdate.mockClear();
        mockAutoUpdater.quitAndInstall.mockClear();
        mockAutoUpdater.removeAllListeners();
        // Save and clear DEBUG_UPDATER to ensure clean test environment
        originalDebugUpdater = process.env.DEBUG_UPDATER;
        delete process.env.DEBUG_UPDATER;
        service = new updater_1.UpdaterService();
        // Capture status updates via subscriber pattern (ORPC model)
        statusUpdates = [];
        service.subscribe((status) => statusUpdates.push(status));
    });
    (0, bun_test_1.afterEach)(() => {
        // Restore DEBUG_UPDATER
        if (originalDebugUpdater !== undefined) {
            process.env.DEBUG_UPDATER = originalDebugUpdater;
        }
        else {
            delete process.env.DEBUG_UPDATER;
        }
    });
    (0, bun_test_1.describe)("checkForUpdates", () => {
        (0, bun_test_1.it)("should set status to 'checking' immediately and notify subscribers", () => {
            // Setup
            mockAutoUpdater.checkForUpdates.mockReturnValue(Promise.resolve());
            // Act
            service.checkForUpdates();
            // Assert - should immediately notify with 'checking' status
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "checking" });
        });
        (0, bun_test_1.it)("should transition to 'up-to-date' when no update found", async () => {
            // Setup
            mockAutoUpdater.checkForUpdates.mockImplementation(() => {
                // Simulate electron-updater behavior: emit event, return unresolved promise
                setImmediate(() => {
                    mockAutoUpdater.emit("update-not-available");
                });
                return new Promise(() => {
                    // Intentionally never resolves to simulate hanging promise
                });
            });
            // Act
            service.checkForUpdates();
            // Wait for event to be processed
            await new Promise((resolve) => setImmediate(resolve));
            // Assert - should notify with 'up-to-date' status
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "checking" });
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "up-to-date" });
        });
        (0, bun_test_1.it)("should transition to 'available' when update found", async () => {
            // Setup
            const updateInfo = {
                version: "1.0.0",
                files: [],
                path: "test-path",
                sha512: "test-sha",
                releaseDate: "2025-01-01",
            };
            mockAutoUpdater.checkForUpdates.mockImplementation(() => {
                setImmediate(() => {
                    mockAutoUpdater.emit("update-available", updateInfo);
                });
                return new Promise(() => {
                    // Intentionally never resolves to simulate hanging promise
                });
            });
            // Act
            service.checkForUpdates();
            // Wait for event to be processed
            await new Promise((resolve) => setImmediate(resolve));
            // Assert
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "checking" });
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "available", info: updateInfo });
        });
        (0, bun_test_1.it)("should handle errors from checkForUpdates", async () => {
            // Setup
            const error = new Error("Network error");
            mockAutoUpdater.checkForUpdates.mockImplementation(() => {
                return Promise.reject(error);
            });
            // Act
            service.checkForUpdates();
            // Wait a bit for error to be caught
            await new Promise((resolve) => setImmediate(resolve));
            // Assert
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "checking" });
            // Should eventually get error status
            const errorStatus = statusUpdates.find((s) => s.type === "error");
            (0, bun_test_1.expect)(errorStatus).toBeDefined();
            (0, bun_test_1.expect)(errorStatus).toEqual({ type: "error", message: "Network error" });
        });
        (0, bun_test_1.it)("should timeout if no events fire within 30 seconds", () => {
            // Use shorter timeout for testing (100ms instead of 30s)
            // We'll verify the timeout logic works, not the exact timing
            const originalSetTimeout = global.setTimeout;
            let timeoutCallback = null;
            // Mock setTimeout to capture the timeout callback
            const globalObj = global;
            globalObj.setTimeout = ((cb, _delay) => {
                timeoutCallback = cb;
                return 123;
            });
            // Setup - checkForUpdates returns promise that never resolves and emits no events
            mockAutoUpdater.checkForUpdates.mockImplementation(() => {
                return new Promise(() => {
                    // Intentionally never resolves to simulate hanging promise
                });
            });
            // Act
            service.checkForUpdates();
            // Should be in checking state
            (0, bun_test_1.expect)(statusUpdates).toContainEqual({ type: "checking" });
            // Manually trigger the timeout callback
            (0, bun_test_1.expect)(timeoutCallback).toBeTruthy();
            timeoutCallback();
            // Should have timed out and returned to idle
            const lastStatus = statusUpdates[statusUpdates.length - 1];
            (0, bun_test_1.expect)(lastStatus).toEqual({ type: "idle" });
            // Restore original setTimeout
            global.setTimeout = originalSetTimeout;
        });
    });
    (0, bun_test_1.describe)("getStatus", () => {
        (0, bun_test_1.it)("should return initial status as idle", () => {
            const status = service.getStatus();
            (0, bun_test_1.expect)(status).toEqual({ type: "idle" });
        });
        (0, bun_test_1.it)("should return current status after check starts", () => {
            mockAutoUpdater.checkForUpdates.mockReturnValue(Promise.resolve());
            service.checkForUpdates();
            const status = service.getStatus();
            (0, bun_test_1.expect)(status.type).toBe("checking");
        });
    });
});
//# sourceMappingURL=updater.test.js.map