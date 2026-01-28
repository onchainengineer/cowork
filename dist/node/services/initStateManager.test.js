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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const bun_test_1 = require("bun:test");
const config_1 = require("../../node/config");
const initStateManager_1 = require("./initStateManager");
const toolLimits_1 = require("../../common/constants/toolLimits");
(0, bun_test_1.describe)("InitStateManager", () => {
    let tempDir;
    let config;
    let manager;
    (0, bun_test_1.beforeEach)(async () => {
        // Create temp directory as unix root
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-state-test-"));
        // Create sessions directory
        const sessionsDir = path.join(tempDir, "sessions");
        await fs.mkdir(sessionsDir, { recursive: true });
        // Config constructor takes rootDir directly
        config = new config_1.Config(tempDir);
        manager = new initStateManager_1.InitStateManager(config);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.describe)("lifecycle", () => {
        (0, bun_test_1.it)("should track init hook lifecycle (start → output → end)", async () => {
            const workspaceId = "test-workspace";
            const events = [];
            // Subscribe to events
            manager.on("init-start", (event) => events.push(event));
            manager.on("init-output", (event) => events.push(event));
            manager.on("init-end", (event) => events.push(event));
            // Start init
            manager.startInit(workspaceId, "/path/to/hook");
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)).toBeTruthy();
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)?.status).toBe("running");
            // Append output
            manager.appendOutput(workspaceId, "Installing deps...", false);
            manager.appendOutput(workspaceId, "Done!", false);
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)?.lines).toEqual([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { line: "Installing deps...", isError: false, timestamp: bun_test_1.expect.any(Number) },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { line: "Done!", isError: false, timestamp: bun_test_1.expect.any(Number) },
            ]);
            // End init (await to ensure event fires)
            await manager.endInit(workspaceId, 0);
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)?.status).toBe("success");
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)?.exitCode).toBe(0);
            // Verify events
            (0, bun_test_1.expect)(events).toHaveLength(4); // start + 2 outputs + end
            (0, bun_test_1.expect)(events[0].type).toBe("init-start");
            (0, bun_test_1.expect)(events[1].type).toBe("init-output");
            (0, bun_test_1.expect)(events[2].type).toBe("init-output");
            (0, bun_test_1.expect)(events[3].type).toBe("init-end");
        });
        (0, bun_test_1.it)("should track stderr lines with isError flag", () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            manager.appendOutput(workspaceId, "stdout line", false);
            manager.appendOutput(workspaceId, "stderr line", true);
            const state = manager.getInitState(workspaceId);
            (0, bun_test_1.expect)(state?.lines).toEqual([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { line: "stdout line", isError: false, timestamp: bun_test_1.expect.any(Number) },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { line: "stderr line", isError: true, timestamp: bun_test_1.expect.any(Number) },
            ]);
        });
        (0, bun_test_1.it)("should set status to error on non-zero exit code", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            await manager.endInit(workspaceId, 1);
            const state = manager.getInitState(workspaceId);
            (0, bun_test_1.expect)(state?.status).toBe("error");
            (0, bun_test_1.expect)(state?.exitCode).toBe(1);
        });
    });
    (0, bun_test_1.describe)("persistence", () => {
        (0, bun_test_1.it)("should persist state to disk on endInit", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            manager.appendOutput(workspaceId, "Line 1", false);
            manager.appendOutput(workspaceId, "Line 2", true);
            await manager.endInit(workspaceId, 0);
            // Read from disk
            const diskState = await manager.readInitStatus(workspaceId);
            (0, bun_test_1.expect)(diskState).toBeTruthy();
            (0, bun_test_1.expect)(diskState?.status).toBe("success");
            (0, bun_test_1.expect)(diskState?.exitCode).toBe(0);
            (0, bun_test_1.expect)(diskState?.lines).toEqual([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { line: "Line 1", isError: false, timestamp: bun_test_1.expect.any(Number) },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                { line: "Line 2", isError: true, timestamp: bun_test_1.expect.any(Number) },
            ]);
        });
        (0, bun_test_1.it)("should replay from in-memory state when available", async () => {
            const workspaceId = "test-workspace";
            const events = [];
            manager.on("init-start", (event) => events.push(event));
            manager.on("init-output", (event) => events.push(event));
            manager.on("init-end", (event) => events.push(event));
            // Create state
            manager.startInit(workspaceId, "/path/to/hook");
            manager.appendOutput(workspaceId, "Line 1", false);
            await manager.endInit(workspaceId, 0);
            events.length = 0; // Clear events
            // Replay from in-memory
            await manager.replayInit(workspaceId);
            (0, bun_test_1.expect)(events).toHaveLength(3); // start + output + end
            (0, bun_test_1.expect)(events[0].type).toBe("init-start");
            (0, bun_test_1.expect)(events[1].type).toBe("init-output");
            (0, bun_test_1.expect)(events[2].type).toBe("init-end");
        });
        (0, bun_test_1.it)("should replay from disk when not in memory", async () => {
            const workspaceId = "test-workspace";
            const events = [];
            // Create and persist state
            manager.startInit(workspaceId, "/path/to/hook");
            manager.appendOutput(workspaceId, "Line 1", false);
            manager.appendOutput(workspaceId, "Error line", true);
            await manager.endInit(workspaceId, 1);
            // Clear in-memory state (simulate process restart)
            manager.clearInMemoryState(workspaceId);
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)).toBeUndefined();
            // Subscribe to events
            manager.on("init-start", (event) => events.push(event));
            manager.on("init-output", (event) => events.push(event));
            manager.on("init-end", (event) => events.push(event));
            // Replay from disk
            await manager.replayInit(workspaceId);
            (0, bun_test_1.expect)(events).toHaveLength(4); // start + 2 outputs + end
            (0, bun_test_1.expect)(events[0].type).toBe("init-start");
            (0, bun_test_1.expect)(events[1].type).toBe("init-output");
            (0, bun_test_1.expect)(events[1].line).toBe("Line 1");
            (0, bun_test_1.expect)(events[2].type).toBe("init-output");
            (0, bun_test_1.expect)(events[2].line).toBe("Error line");
            (0, bun_test_1.expect)(events[2].isError).toBe(true);
            (0, bun_test_1.expect)(events[3].type).toBe("init-end");
            (0, bun_test_1.expect)(events[3].exitCode).toBe(1);
        });
        (0, bun_test_1.it)("should not replay if no state exists", async () => {
            const workspaceId = "nonexistent-workspace";
            const events = [];
            manager.on("init-start", (event) => events.push(event));
            manager.on("init-output", (event) => events.push(event));
            manager.on("init-end", (event) => events.push(event));
            await manager.replayInit(workspaceId);
            (0, bun_test_1.expect)(events).toHaveLength(0);
        });
    });
    (0, bun_test_1.describe)("cleanup", () => {
        (0, bun_test_1.it)("should delete persisted state from disk", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            await manager.endInit(workspaceId, 0);
            // Verify state exists
            const stateBeforeDelete = await manager.readInitStatus(workspaceId);
            (0, bun_test_1.expect)(stateBeforeDelete).toBeTruthy();
            // Delete
            await manager.deleteInitStatus(workspaceId);
            // Verify deleted
            const stateAfterDelete = await manager.readInitStatus(workspaceId);
            (0, bun_test_1.expect)(stateAfterDelete).toBeNull();
        });
        (0, bun_test_1.it)("should clear in-memory state", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)).toBeTruthy();
            // Get the init promise before clearing
            const initPromise = manager.waitForInit(workspaceId);
            // Clear in-memory state (rejects internal promise, but waitForInit catches it)
            manager.clearInMemoryState(workspaceId);
            // Verify state is cleared
            (0, bun_test_1.expect)(manager.getInitState(workspaceId)).toBeUndefined();
            // waitForInit never throws - it resolves even when init is canceled
            // This allows tools to proceed and fail naturally with their own errors
            // eslint-disable-next-line @typescript-eslint/await-thenable
            await (0, bun_test_1.expect)(initPromise).resolves.toBeUndefined();
        });
    });
    (0, bun_test_1.describe)("error handling", () => {
        (0, bun_test_1.it)("should handle appendOutput with no active state", () => {
            const workspaceId = "nonexistent-workspace";
            // Should not throw
            manager.appendOutput(workspaceId, "Line", false);
        });
        (0, bun_test_1.it)("should handle endInit with no active state", async () => {
            const workspaceId = "nonexistent-workspace";
            // Should not throw
            await manager.endInit(workspaceId, 0);
        });
        (0, bun_test_1.it)("should handle deleteInitStatus for nonexistent file", async () => {
            const workspaceId = "nonexistent-workspace";
            // Should not throw
            await manager.deleteInitStatus(workspaceId);
        });
    });
    (0, bun_test_1.describe)("truncation", () => {
        (0, bun_test_1.it)("should truncate lines when exceeding INIT_HOOK_MAX_LINES", () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            // Add more lines than the limit
            const totalLines = toolLimits_1.INIT_HOOK_MAX_LINES + 100;
            for (let i = 0; i < totalLines; i++) {
                manager.appendOutput(workspaceId, `Line ${i}`, false);
            }
            const state = manager.getInitState(workspaceId);
            (0, bun_test_1.expect)(state?.lines.length).toBe(toolLimits_1.INIT_HOOK_MAX_LINES);
            (0, bun_test_1.expect)(state?.truncatedLines).toBe(100);
            // Should have the most recent lines (tail)
            const lastLine = state?.lines[toolLimits_1.INIT_HOOK_MAX_LINES - 1];
            (0, bun_test_1.expect)(lastLine?.line).toBe(`Line ${totalLines - 1}`);
            // First line should be from when truncation started
            const firstLine = state?.lines[0];
            (0, bun_test_1.expect)(firstLine?.line).toBe(`Line 100`);
        });
        (0, bun_test_1.it)("should include truncatedLines in init-end event", async () => {
            const workspaceId = "test-workspace";
            const events = [];
            manager.on("init-end", (event) => events.push(event));
            manager.startInit(workspaceId, "/path/to/hook");
            // Add more lines than the limit
            for (let i = 0; i < toolLimits_1.INIT_HOOK_MAX_LINES + 50; i++) {
                manager.appendOutput(workspaceId, `Line ${i}`, false);
            }
            await manager.endInit(workspaceId, 0);
            (0, bun_test_1.expect)(events).toHaveLength(1);
            (0, bun_test_1.expect)(events[0].truncatedLines).toBe(50);
        });
        (0, bun_test_1.it)("should persist truncatedLines to disk", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            // Add more lines than the limit
            for (let i = 0; i < toolLimits_1.INIT_HOOK_MAX_LINES + 25; i++) {
                manager.appendOutput(workspaceId, `Line ${i}`, false);
            }
            await manager.endInit(workspaceId, 0);
            const diskState = await manager.readInitStatus(workspaceId);
            (0, bun_test_1.expect)(diskState?.truncatedLines).toBe(25);
            (0, bun_test_1.expect)(diskState?.lines.length).toBe(toolLimits_1.INIT_HOOK_MAX_LINES);
        });
        (0, bun_test_1.it)("should not set truncatedLines when under limit", () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            // Add fewer lines than the limit
            for (let i = 0; i < 10; i++) {
                manager.appendOutput(workspaceId, `Line ${i}`, false);
            }
            const state = manager.getInitState(workspaceId);
            (0, bun_test_1.expect)(state?.lines.length).toBe(10);
            (0, bun_test_1.expect)(state?.truncatedLines).toBeUndefined();
        });
        (0, bun_test_1.it)("should truncate old persisted data on replay (backwards compat)", async () => {
            const workspaceId = "test-workspace";
            const events = [];
            // Manually write a large init-status.json to simulate old data
            const sessionsDir = path.join(tempDir, "sessions", workspaceId);
            await fs.mkdir(sessionsDir, { recursive: true });
            const oldLineCount = toolLimits_1.INIT_HOOK_MAX_LINES + 200;
            const oldStatus = {
                status: "success",
                hookPath: "/path/to/hook",
                startTime: Date.now() - 1000,
                lines: Array.from({ length: oldLineCount }, (_, i) => ({
                    line: `Old line ${i}`,
                    isError: false,
                    timestamp: Date.now() - 1000 + i,
                })),
                exitCode: 0,
                endTime: Date.now(),
                // No truncatedLines field - old format
            };
            await fs.writeFile(path.join(sessionsDir, "init-status.json"), JSON.stringify(oldStatus));
            // Subscribe to events
            manager.on("init-output", (event) => events.push(event));
            manager.on("init-end", (event) => events.push(event));
            // Replay from disk
            await manager.replayInit(workspaceId);
            // Should only emit MAX_LINES output events (truncated)
            const outputEvents = events.filter((e) => e.type === "init-output");
            (0, bun_test_1.expect)(outputEvents.length).toBe(toolLimits_1.INIT_HOOK_MAX_LINES);
            // init-end should include truncatedLines count
            const endEvent = events.find((e) => e.type === "init-end");
            (0, bun_test_1.expect)(endEvent.truncatedLines).toBe(200);
            // First replayed line should be from the tail (old line 200)
            (0, bun_test_1.expect)(outputEvents[0].line).toBe("Old line 200");
        });
    });
    (0, bun_test_1.describe)("waitForInit with abortSignal", () => {
        (0, bun_test_1.it)("should return immediately if abortSignal is already aborted", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            const controller = new AbortController();
            controller.abort();
            const start = Date.now();
            await manager.waitForInit(workspaceId, controller.signal);
            (0, bun_test_1.expect)(Date.now() - start).toBeLessThan(50); // Should be instant
        });
        (0, bun_test_1.it)("should return when abortSignal fires during wait", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            const controller = new AbortController();
            const waitPromise = manager.waitForInit(workspaceId, controller.signal);
            setTimeout(() => controller.abort(), 10);
            const start = Date.now();
            await waitPromise;
            (0, bun_test_1.expect)(Date.now() - start).toBeLessThan(100); // Should return quickly after abort
        });
        (0, bun_test_1.it)("should clean up timeout when init completes first", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            const waitPromise = manager.waitForInit(workspaceId);
            await manager.endInit(workspaceId, 0);
            await waitPromise;
            // No spurious timeout error should be logged (verify via log spy if needed)
        });
        (0, bun_test_1.it)("should work without abortSignal (backwards compat)", async () => {
            const workspaceId = "test-workspace";
            manager.startInit(workspaceId, "/path/to/hook");
            const waitPromise = manager.waitForInit(workspaceId);
            // Complete init
            await manager.endInit(workspaceId, 0);
            await waitPromise;
            // Should complete without error
        });
    });
});
//# sourceMappingURL=initStateManager.test.js.map