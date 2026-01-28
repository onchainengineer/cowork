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
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const eventStore_1 = require("./eventStore");
(0, globals_1.describe)("EventStore", () => {
    const testSessionDir = path.join(__dirname, "../../test-sessions");
    const testWorkspaceId = "test-workspace-123";
    const testFilename = "test-state.json";
    let mockConfig;
    let store;
    let emittedEvents = [];
    // Test serializer: converts state into events
    const serializeState = (state) => {
        const events = [];
        events.push({ type: "start", id: state.workspaceId ?? state.id, data: state.value });
        for (const item of state.items) {
            events.push({ type: "item", id: state.workspaceId ?? state.id, data: item });
        }
        events.push({ type: "end", id: state.workspaceId ?? state.id, data: state.items.length });
        return events;
    };
    // Test emitter: captures events
    const emitEvent = (event) => {
        emittedEvents.push(event);
    };
    (0, globals_1.beforeEach)(async () => {
        // Create test session directory
        try {
            await fs.access(testSessionDir);
        }
        catch {
            await fs.mkdir(testSessionDir, { recursive: true });
        }
        mockConfig = {
            unixDir: path.join(__dirname, "../.."),
            sessionsDir: testSessionDir,
            getSessionDir: (workspaceId) => path.join(testSessionDir, workspaceId),
        };
        emittedEvents = [];
        store = new eventStore_1.EventStore(mockConfig, testFilename, serializeState, emitEvent, "TestStore");
    });
    (0, globals_1.afterEach)(async () => {
        // Clean up test files
        try {
            await fs.access(testSessionDir);
            await fs.rm(testSessionDir, { recursive: true, force: true });
        }
        catch {
            // Directory doesn't exist, nothing to clean up
        }
    });
    (0, globals_1.describe)("State Management", () => {
        (0, globals_1.it)("should store and retrieve in-memory state", () => {
            const state = { id: "test", value: 42, items: ["a", "b"] };
            store.setState(testWorkspaceId, state);
            const retrieved = store.getState(testWorkspaceId);
            (0, globals_1.expect)(retrieved).toEqual(state);
        });
        (0, globals_1.it)("should return undefined for non-existent state", () => {
            const retrieved = store.getState("non-existent");
            (0, globals_1.expect)(retrieved).toBeUndefined();
        });
        (0, globals_1.it)("should delete in-memory state", () => {
            const state = { id: "test", value: 42, items: [] };
            store.setState(testWorkspaceId, state);
            (0, globals_1.expect)(store.hasState(testWorkspaceId)).toBe(true);
            store.deleteState(testWorkspaceId);
            (0, globals_1.expect)(store.hasState(testWorkspaceId)).toBe(false);
            (0, globals_1.expect)(store.getState(testWorkspaceId)).toBeUndefined();
        });
        (0, globals_1.it)("should check if state exists", () => {
            (0, globals_1.expect)(store.hasState(testWorkspaceId)).toBe(false);
            store.setState(testWorkspaceId, { id: "test", value: 1, items: [] });
            (0, globals_1.expect)(store.hasState(testWorkspaceId)).toBe(true);
        });
        (0, globals_1.it)("should get all active workspace IDs", () => {
            store.setState("workspace-1", { id: "1", value: 1, items: [] });
            store.setState("workspace-2", { id: "2", value: 2, items: [] });
            const ids = store.getActiveWorkspaceIds();
            (0, globals_1.expect)(ids).toHaveLength(2);
            (0, globals_1.expect)(ids).toContain("workspace-1");
            (0, globals_1.expect)(ids).toContain("workspace-2");
        });
    });
    (0, globals_1.describe)("Persistence", () => {
        (0, globals_1.it)("should persist state to disk", async () => {
            const state = { id: "test", value: 99, items: ["x", "y", "z"] };
            await store.persist(testWorkspaceId, state);
            // Verify file exists
            const workspaceDir = path.join(testSessionDir, testWorkspaceId);
            const filePath = path.join(workspaceDir, testFilename);
            try {
                await fs.access(filePath);
            }
            catch {
                throw new Error(`File ${filePath} does not exist`);
            }
            // Verify content
            const content = await fs.readFile(filePath, "utf-8");
            const parsed = JSON.parse(content);
            (0, globals_1.expect)(parsed).toEqual(state);
        });
        (0, globals_1.it)("should read persisted state from disk", async () => {
            const state = { id: "test", value: 123, items: ["foo", "bar"] };
            await store.persist(testWorkspaceId, state);
            const retrieved = await store.readPersisted(testWorkspaceId);
            (0, globals_1.expect)(retrieved).toEqual(state);
        });
        (0, globals_1.it)("should return null for non-existent persisted state", async () => {
            const retrieved = await store.readPersisted("non-existent");
            (0, globals_1.expect)(retrieved).toBeNull();
        });
        (0, globals_1.it)("should delete persisted state from disk", async () => {
            const state = { id: "test", value: 456, items: [] };
            await store.persist(testWorkspaceId, state);
            await store.deletePersisted(testWorkspaceId);
            const retrieved = await store.readPersisted(testWorkspaceId);
            (0, globals_1.expect)(retrieved).toBeNull();
        });
        (0, globals_1.it)("should not throw when deleting non-existent persisted state", async () => {
            // Should complete without throwing (logs error but doesn't throw)
            await store.deletePersisted("non-existent");
            // If we get here, it didn't throw
            (0, globals_1.expect)(true).toBe(true);
        });
    });
    (0, globals_1.describe)("Replay", () => {
        (0, globals_1.it)("should replay events from in-memory state", async () => {
            const state = { id: "mem", value: 10, items: ["a", "b", "c"] };
            store.setState(testWorkspaceId, state);
            await store.replay(testWorkspaceId, { workspaceId: testWorkspaceId });
            (0, globals_1.expect)(emittedEvents).toHaveLength(5); // start + 3 items + end
            (0, globals_1.expect)(emittedEvents[0]).toEqual({ type: "start", id: testWorkspaceId, data: 10 });
            (0, globals_1.expect)(emittedEvents[1]).toEqual({ type: "item", id: testWorkspaceId, data: "a" });
            (0, globals_1.expect)(emittedEvents[2]).toEqual({ type: "item", id: testWorkspaceId, data: "b" });
            (0, globals_1.expect)(emittedEvents[3]).toEqual({ type: "item", id: testWorkspaceId, data: "c" });
            (0, globals_1.expect)(emittedEvents[4]).toEqual({ type: "end", id: testWorkspaceId, data: 3 });
        });
        (0, globals_1.it)("should replay events from disk state when not in memory", async () => {
            const state = { id: "disk", value: 20, items: ["x"] };
            await store.persist(testWorkspaceId, state);
            // Don't set in-memory state
            await store.replay(testWorkspaceId, { workspaceId: testWorkspaceId });
            (0, globals_1.expect)(emittedEvents).toHaveLength(3); // start + 1 item + end
            (0, globals_1.expect)(emittedEvents[0]).toEqual({ type: "start", id: testWorkspaceId, data: 20 });
            (0, globals_1.expect)(emittedEvents[1]).toEqual({ type: "item", id: testWorkspaceId, data: "x" });
            (0, globals_1.expect)(emittedEvents[2]).toEqual({ type: "end", id: testWorkspaceId, data: 1 });
        });
        (0, globals_1.it)("should prefer in-memory state over disk state", async () => {
            const diskState = { id: "disk", value: 1, items: [] };
            const memState = { id: "mem", value: 2, items: [] };
            await store.persist(testWorkspaceId, diskState);
            store.setState(testWorkspaceId, memState);
            await store.replay(testWorkspaceId, { workspaceId: testWorkspaceId });
            (0, globals_1.expect)(emittedEvents[0]).toEqual({ type: "start", id: testWorkspaceId, data: 2 }); // Memory value
        });
        (0, globals_1.it)("should do nothing when replaying non-existent state", async () => {
            await store.replay("non-existent", { workspaceId: "non-existent" });
            (0, globals_1.expect)(emittedEvents).toHaveLength(0);
        });
        (0, globals_1.it)("should pass context to serializer", async () => {
            const state = { id: "original", value: 100, items: [] };
            store.setState(testWorkspaceId, state);
            await store.replay(testWorkspaceId, { workspaceId: "override-id" });
            // Serializer should use workspaceId from context
            (0, globals_1.expect)(emittedEvents[0]).toEqual({ type: "start", id: "override-id", data: 100 });
        });
    });
    (0, globals_1.describe)("Integration", () => {
        (0, globals_1.it)("should handle full lifecycle: set → persist → delete memory → replay from disk", async () => {
            const state = { id: "lifecycle", value: 777, items: ["test"] };
            // Set in memory
            store.setState(testWorkspaceId, state);
            (0, globals_1.expect)(store.hasState(testWorkspaceId)).toBe(true);
            // Persist to disk
            await store.persist(testWorkspaceId, state);
            // Clear memory
            store.deleteState(testWorkspaceId);
            (0, globals_1.expect)(store.hasState(testWorkspaceId)).toBe(false);
            // Replay from disk
            await store.replay(testWorkspaceId, { workspaceId: testWorkspaceId });
            // Verify events were emitted
            (0, globals_1.expect)(emittedEvents).toHaveLength(3);
            (0, globals_1.expect)(emittedEvents[0].data).toBe(777);
        });
    });
});
//# sourceMappingURL=eventStore.test.js.map