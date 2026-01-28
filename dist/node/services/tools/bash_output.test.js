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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const bun_test_1 = require("bun:test");
const bash_output_1 = require("./bash_output");
const backgroundProcessManager_1 = require("../../../node/services/backgroundProcessManager");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const testHelpers_1 = require("./testHelpers");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
// Create test runtime
function createTestRuntime() {
    return new LocalRuntime_1.LocalRuntime(process.cwd());
}
(0, bun_test_1.describe)("bash_output tool", () => {
    (0, bun_test_1.it)("should return error when manager not available", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: "bash_1", timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Background process manager not available");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return error when workspaceId not available", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        delete config.workspaceId;
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: "bash_1", timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Workspace ID not available");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return error for non-existent process", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: "bash_1", timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Process not found");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return incremental output from process", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn a process that outputs incrementally
        const spawnResult = await manager.spawn(runtime, "test-workspace", "echo 'line1'; sleep 0.5; echo 'line2'", { cwd: process.cwd(), displayName: "test" });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        // Wait a bit for first output
        await new Promise((r) => setTimeout(r, 200));
        // First call - should get some output
        const result1 = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result1.success).toBe(true);
        if (result1.success) {
            (0, bun_test_1.expect)(result1.output).toContain("line1");
        }
        // Wait for more output
        await new Promise((r) => setTimeout(r, 600));
        // Second call - should ONLY get new output (incremental)
        const result2 = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result2.success).toBe(true);
        if (result2.success) {
            // Should contain line2 but NOT line1 (already read)
            (0, bun_test_1.expect)(result2.output).toContain("line2");
            (0, bun_test_1.expect)(result2.output).not.toContain("line1");
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should filter output with regex", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn a process that outputs multiple lines
        const spawnResult = await manager.spawn(runtime, "test-workspace", "echo 'ERROR: something failed'; echo 'INFO: everything ok'; echo 'ERROR: another error'", { cwd: process.cwd(), displayName: "test" });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        // Wait for output
        await new Promise((r) => setTimeout(r, 200));
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: spawnResult.processId, filter: "ERROR", timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            // Should only contain ERROR lines
            (0, bun_test_1.expect)(result.output).toContain("ERROR");
            (0, bun_test_1.expect)(result.output).not.toContain("INFO");
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return error for invalid regex filter", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const spawnResult = await manager.spawn(runtime, "test-workspace", "echo 'test'", {
            cwd: process.cwd(),
            displayName: "test",
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        // Wait for output
        await new Promise((r) => setTimeout(r, 100));
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: spawnResult.processId, filter: "[invalid(", timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Invalid filter regex");
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should not return output from other workspace's processes", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), {
            workspaceId: "workspace-a",
            sessionsDir: tempDir.path,
        });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn process in different workspace
        const spawnResult = await manager.spawn(runtime, "workspace-b", "echo 'test'", {
            cwd: process.cwd(),
            displayName: "test",
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Process not found");
        }
        // Cleanup
        await manager.cleanup("workspace-b");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should include process status and exit code", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn a process that exits quickly
        const spawnResult = await manager.spawn(runtime, "test-workspace", "echo 'done'", {
            cwd: process.cwd(),
            displayName: "test",
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        // Wait for process to exit
        await new Promise((r) => setTimeout(r, 200));
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 0 }, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.status).toBe("exited");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should block and wait for output when timeout_secs > 0", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Use unique process ID to avoid leftover state from previous runs
        const processId = `delayed-output-${Date.now()}`;
        const signalPath = path.join(tempDir.path, `${processId}.signal`);
        // Spawn a process that blocks until we create a signal file, then outputs.
        // This avoids flakiness from the spawn call itself taking a non-trivial amount of time.
        const spawnResult = await manager.spawn(runtime, "test-workspace", `while [ ! -f "${signalPath}" ]; do sleep 0.1; done; echo 'delayed output'`, { cwd: process.cwd(), displayName: processId });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        // Call with timeout=3 should wait and return output (waiting for signal file)
        const start = Date.now();
        const resultPromise = tool.execute({ process_id: spawnResult.processId, timeout_secs: 3 }, mockToolCallOptions);
        // Ensure bash_output is actually waiting before we trigger output.
        await new Promise((r) => setTimeout(r, 300));
        await fs.promises.writeFile(signalPath, "go");
        const result = await resultPromise;
        const elapsed = Date.now() - start;
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.output).toContain("delayed output");
            (0, bun_test_1.expect)(elapsed).toBeGreaterThan(250);
            (0, bun_test_1.expect)(elapsed).toBeLessThan(3500);
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return early when process exits during wait", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Use unique process ID to avoid leftover state from previous runs
        const processId = `quick-exit-${Date.now()}`;
        // Spawn a process that exits quickly
        const spawnResult = await manager.spawn(runtime, "test-workspace", "echo 'quick exit'", {
            cwd: process.cwd(),
            displayName: processId,
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        // Wait for process to exit
        await new Promise((r) => setTimeout(r, 200));
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        // Call with long timeout - should return quickly since process already exited
        const start = Date.now();
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 10 }, mockToolCallOptions));
        const elapsed = Date.now() - start;
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.output).toContain("quick exit");
            (0, bun_test_1.expect)(result.status).toBe("exited");
            (0, bun_test_1.expect)(elapsed).toBeLessThan(500); // Should return quickly, not wait full 10s
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should wait full timeout duration when no output and process running", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const processId = `long-sleep-${Date.now()}`;
        // Spawn a process that sleeps for a long time with no output
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 30", {
            cwd: process.cwd(),
            displayName: processId,
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        // Call with short timeout - should wait full duration then return empty
        const start = Date.now();
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 1 }, mockToolCallOptions));
        const elapsed = Date.now() - start;
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.output).toBe(""); // No output
            (0, bun_test_1.expect)(result.status).toBe("running"); // Process still running
            // Should have waited close to 1 second
            (0, bun_test_1.expect)(elapsed).toBeGreaterThan(900);
            (0, bun_test_1.expect)(elapsed).toBeLessThan(1500);
        }
        // Cleanup
        await manager.terminate(spawnResult.processId);
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return immediately with timeout_secs: 0 even when no output", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const processId = `no-wait-${Date.now()}`;
        // Spawn a process that sleeps (no immediate output)
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 30", {
            cwd: process.cwd(),
            displayName: processId,
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        // Call with timeout=0 - should return immediately
        const start = Date.now();
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 0 }, mockToolCallOptions));
        const elapsed = Date.now() - start;
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.output).toBe("");
            (0, bun_test_1.expect)(result.status).toBe("running");
            (0, bun_test_1.expect)(elapsed).toBeLessThan(200); // Should return almost immediately
        }
        // Cleanup
        await manager.terminate(spawnResult.processId);
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return early with 'interrupted' status when abortSignal is triggered", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const processId = `abort-test-${Date.now()}`;
        // Spawn a long-running process with no output
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 60", {
            cwd: process.cwd(),
            displayName: processId,
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        const abortController = new AbortController();
        // Abort after 200ms
        setTimeout(() => abortController.abort(), 200);
        // Call with long timeout - should be interrupted by abort signal
        const start = Date.now();
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 30 }, { ...mockToolCallOptions, abortSignal: abortController.signal }));
        const elapsed = Date.now() - start;
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.status).toBe("interrupted");
            (0, bun_test_1.expect)(result.output).toBe("(waiting interrupted)");
            // Should have returned quickly after abort, not waiting full 30s
            (0, bun_test_1.expect)(elapsed).toBeLessThan(1000);
            (0, bun_test_1.expect)(elapsed).toBeGreaterThan(150); // At least waited until abort
        }
        // Cleanup
        await manager.terminate(spawnResult.processId);
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return early with 'interrupted' status when message is queued", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-output");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const processId = `queued-msg-test-${Date.now()}`;
        // Spawn a long-running process with no output
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 60", {
            cwd: process.cwd(),
            displayName: processId,
        });
        if (!spawnResult.success) {
            throw new Error("Failed to spawn process");
        }
        const tool = (0, bash_output_1.createBashOutputTool)(config);
        // Queue a message after 200ms
        setTimeout(() => manager.setMessageQueued("test-workspace", true), 200);
        // Call with long timeout - should be interrupted by queued message
        const start = Date.now();
        const result = (await tool.execute({ process_id: spawnResult.processId, timeout_secs: 30 }, mockToolCallOptions));
        const elapsed = Date.now() - start;
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.status).toBe("interrupted");
            (0, bun_test_1.expect)(result.output).toBe("(waiting interrupted)");
            // Should have returned quickly after queued message, not waiting full 30s
            (0, bun_test_1.expect)(elapsed).toBeLessThan(1000);
            (0, bun_test_1.expect)(elapsed).toBeGreaterThan(150); // At least waited until message was queued
        }
        // Cleanup
        manager.setMessageQueued("test-workspace", false);
        await manager.terminate(spawnResult.processId);
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
});
//# sourceMappingURL=bash_output.test.js.map