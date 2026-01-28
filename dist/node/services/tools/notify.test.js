"use strict";
/**
 * Tests for notify tool - system notification integration
 *
 * The notify tool allows AI agents to send system notifications to the user.
 * Notifications appear as OS-native notifications (macOS Notification Center, Windows Toast, etc.)
 *
 * These tests verify the tool's behavior in non-Electron environments (bun test).
 * Full integration testing with actual system notifications requires running in Electron.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const notify_1 = require("./notify");
const testHelpers_1 = require("./testHelpers");
(0, bun_test_1.describe)("notify tool", () => {
    let config;
    let tempDir;
    (0, bun_test_1.beforeEach)(() => {
        tempDir = new testHelpers_1.TestTempDir("notify-test");
        config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
    });
    (0, bun_test_1.it)("should create a tool with correct schema", () => {
        const tool = (0, notify_1.createNotifyTool)(config);
        (0, bun_test_1.expect)(tool).toBeDefined();
        (0, bun_test_1.expect)(tool.description).toContain("notification");
    });
    (0, bun_test_1.it)("should reject empty title", async () => {
        const tool = (0, notify_1.createNotifyTool)(config);
        const execute = tool.execute;
        const result = await execute({
            title: "",
            message: "Some message",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("title");
        }
    });
    (0, bun_test_1.it)("should reject whitespace-only title", async () => {
        const tool = (0, notify_1.createNotifyTool)(config);
        const execute = tool.execute;
        const result = await execute({
            title: "   ",
            message: "Some message",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("title");
        }
    });
    (0, bun_test_1.it)("should return browser fallback in non-Electron environment", async () => {
        // When running in bun:test (not Electron), tool returns success with browser fallback
        const tool = (0, notify_1.createNotifyTool)(config);
        const execute = tool.execute;
        const result = await execute({
            title: "Test Notification",
            message: "This is a test",
        });
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.ui_only?.notify?.notifiedVia).toBe("browser");
            (0, bun_test_1.expect)(result.title).toBe("Test Notification");
            (0, bun_test_1.expect)(result.message).toBe("This is a test");
        }
    });
    (0, bun_test_1.it)("should handle title-only notification (no message)", async () => {
        const tool = (0, notify_1.createNotifyTool)(config);
        const execute = tool.execute;
        const result = await execute({
            title: "Test Notification",
        });
        // In non-Electron, returns success with browser fallback
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.ui_only?.notify?.notifiedVia).toBe("browser");
            (0, bun_test_1.expect)(result.title).toBe("Test Notification");
            (0, bun_test_1.expect)(result.message).toBeUndefined();
        }
    });
    (0, bun_test_1.it)("should include workspaceId in result when provided in config", async () => {
        const configWithWorkspace = {
            ...config,
            workspaceId: "test-workspace-123",
        };
        const tool = (0, notify_1.createNotifyTool)(configWithWorkspace);
        const execute = tool.execute;
        const result = await execute({
            title: "Test Notification",
        });
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.ui_only?.notify?.workspaceId).toBe("test-workspace-123");
        }
    });
});
//# sourceMappingURL=notify.test.js.map