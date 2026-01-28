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
const bash_background_list_1 = require("./bash_background_list");
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
(0, bun_test_1.describe)("bash_background_list tool", () => {
    (0, bun_test_1.afterEach)(async () => {
        // Clean up output directories from /tmp/unix-bashes/ to prevent test pollution
        for (const ws of TEST_WORKSPACES) {
            await fs.rm(`/tmp/unix-bashes/${ws}`, { recursive: true, force: true }).catch(() => undefined);
        }
    });
    (0, bun_test_1.it)("should return error when manager not available", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-list");
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        const tool = (0, bash_background_list_1.createBashBackgroundListTool)(config);
        const result = (await tool.execute({}, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Background process manager not available");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return error when workspaceId not available", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-list");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        delete config.workspaceId; // Explicitly remove workspaceId
        const tool = (0, bash_background_list_1.createBashBackgroundListTool)(config);
        const result = (await tool.execute({}, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Workspace ID not available");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should return empty list when no processes", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-list");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        const tool = (0, bash_background_list_1.createBashBackgroundListTool)(config);
        const result = (await tool.execute({}, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.processes).toEqual([]);
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should list spawned processes with correct fields", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-list");
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
        const tool = (0, bash_background_list_1.createBashBackgroundListTool)(config);
        const result = (await tool.execute({}, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.processes.length).toBe(1);
            const proc = result.processes[0];
            (0, bun_test_1.expect)(proc.process_id).toBe(spawnResult.processId);
            (0, bun_test_1.expect)(proc.status).toBe("running");
            (0, bun_test_1.expect)(proc.script).toBe("sleep 10");
            (0, bun_test_1.expect)(proc.uptime_ms).toBeGreaterThanOrEqual(0);
            (0, bun_test_1.expect)(proc.exitCode).toBeUndefined();
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should include display_name in listed processes", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-list");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), { sessionsDir: tempDir.path });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn a process with display_name
        const spawnResult = await manager.spawn(runtime, "test-workspace", "sleep 10", {
            cwd: process.cwd(),
            displayName: "Dev Server",
        });
        if (!spawnResult.success) {
            throw new Error(`Failed to spawn process: ${spawnResult.error}`);
        }
        const tool = (0, bash_background_list_1.createBashBackgroundListTool)(config);
        const result = (await tool.execute({}, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.processes.length).toBe(1);
            (0, bun_test_1.expect)(result.processes[0].display_name).toBe("Dev Server");
        }
        // Cleanup
        await manager.cleanup("test-workspace");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should only list processes for the current workspace", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-list");
        const manager = new backgroundProcessManager_1.BackgroundProcessManager(tempDir.path);
        const runtime = createTestRuntime();
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd(), {
            workspaceId: "workspace-a",
            sessionsDir: tempDir.path,
        });
        config.runtimeTempDir = tempDir.path;
        config.backgroundProcessManager = manager;
        // Spawn processes in different workspaces
        const spawnA = await manager.spawn(runtime, "workspace-a", "sleep 10", {
            cwd: process.cwd(),
            displayName: "test-a",
        });
        const spawnB = await manager.spawn(runtime, "workspace-b", "sleep 10", {
            cwd: process.cwd(),
            displayName: "test-b",
        });
        if (!spawnA.success || !spawnB.success) {
            throw new Error("Failed to spawn processes");
        }
        const tool = (0, bash_background_list_1.createBashBackgroundListTool)(config);
        const result = (await tool.execute({}, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.processes.length).toBe(1);
            (0, bun_test_1.expect)(result.processes[0].process_id).toBe(spawnA.processId);
        }
        // Cleanup
        await manager.cleanup("workspace-a");
        await manager.cleanup("workspace-b");
        tempDir[Symbol.dispose]();
    });
});
//# sourceMappingURL=bash_background_list.test.js.map