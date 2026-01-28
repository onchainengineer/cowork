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
const bun_test_1 = require("bun:test");
const bash_background_terminate_1 = require("./bash_background_terminate");
const backgroundProcessManager_1 = require("../../../node/services/backgroundProcessManager");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const testHelpers_1 = require("./testHelpers");
const fs = __importStar(require("fs/promises"));
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
// Create test runtime
function createTestRuntime() {
    return new LocalRuntime_1.LocalRuntime(process.cwd());
}
// Workspace IDs used in tests - need cleanup after each test
const TEST_WORKSPACES = ["test-workspace", "workspace-a", "workspace-b"];
(0, bun_test_1.describe)("bash_background_terminate tool", () => {
    (0, bun_test_1.afterEach)(async () => {
        // Clean up output directories from /tmp/unix-bashes/ to prevent test pollution
        for (const ws of TEST_WORKSPACES) {
            await fs.rm(`/tmp/unix-bashes/${ws}`, { recursive: true, force: true }).catch(() => undefined);
        }
    });
    (0, bun_test_1.it)("should return error when manager not available", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-term");
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        const tool = (0, bash_background_terminate_1.createBashBackgroundTerminateTool)(config);
        const args = {
            process_id: "bg-test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Background process manager not available");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return error for non-existent process", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-term");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const tool = (0, bash_background_terminate_1.createBashBackgroundTerminateTool)(config);
        const args = {
            process_id: "bg-nonexistent",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
    });
    (0, bun_test_1.it)("should terminate a running process", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-term");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn a long-running process
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 10", {
            cwd: process.cwd(),
            displayName: "test",
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_background_terminate_1.createBashBackgroundTerminateTool)(config);
        const args = {
            process_id: spawnResult.processId,
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.message).toContain(spawnResult.processId);
        }
        // Verify process is no longer running
        const bgProcess = await manager.getProcess(spawnResult.processId);
        (0, bun_test_1.expect)(bgProcess?.status).not.toBe("running");
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should be idempotent (double-terminate succeeds)", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-term");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn a process
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 10", {
            cwd: process.cwd(),
            displayName: "test",
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_background_terminate_1.createBashBackgroundTerminateTool)(config);
        const args = {
            process_id: spawnResult.processId,
        };
        // First termination
        const result1 = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result1.success).toBe(true);
        // Second termination
        const result2 = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result2.success).toBe(true);
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should not terminate processes from other workspaces", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-term");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        // Config is for workspace-a
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), {
            workspaceId: "workspace-a",
            sessionsDir: tempDir.path,
        });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn process in workspace-b
        const spawnResult = await manager.spawn(runtime, "workspace-b", "sleep 10", {
            cwd: process.cwd(),
            displayName: "test",
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        // Try to terminate from workspace-a (should fail)
        const tool = (0, bash_background_terminate_1.createBashBackgroundTerminateTool)(config);
        const args = {
            process_id: spawnResult.processId,
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Process not found");
        }
        // Process should still be running
        const proc = await manager.getProcess(spawnResult.processId);
        (0, bun_test_1.expect)(proc?.status).toBe("running");
        // Cleanup
        await manager.cleanup("workspace-b");
        tempDir[Symbol.dispose]();
    });
});
//# sourceMappingURL=bash_background_terminate.test.js.map