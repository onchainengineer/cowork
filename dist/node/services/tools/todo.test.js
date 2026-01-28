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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const todo_1 = require("./todo");
(0, globals_1.describe)("Todo Storage", () => {
    const workspaceId = "test-workspace";
    let workspaceSessionDir;
    (0, globals_1.beforeEach)(async () => {
        workspaceSessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "todo-session-test-"));
    });
    (0, globals_1.afterEach)(async () => {
        await fs.rm(workspaceSessionDir, { recursive: true, force: true });
    });
    (0, globals_1.describe)("setTodosForSessionDir", () => {
        (0, globals_1.it)("should store todo list in temp directory", async () => {
            const todos = [
                {
                    content: "Installed dependencies",
                    status: "completed",
                },
                {
                    content: "Writing tests",
                    status: "in_progress",
                },
                {
                    content: "Update documentation",
                    status: "pending",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, todos);
            const storedTodos = await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir);
            (0, globals_1.expect)(storedTodos).toEqual(todos);
        });
        (0, globals_1.it)("should replace entire todo list on update", async () => {
            // Create initial list
            const initialTodos = [
                {
                    content: "Task 1",
                    status: "pending",
                },
                {
                    content: "Task 2",
                    status: "pending",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, initialTodos);
            // Replace with updated list
            const updatedTodos = [
                {
                    content: "Task 1",
                    status: "completed",
                },
                {
                    content: "Task 2",
                    status: "in_progress",
                },
                {
                    content: "Task 3",
                    status: "pending",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, updatedTodos);
            // Verify list was replaced, not merged
            const storedTodos = await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir);
            (0, globals_1.expect)(storedTodos).toEqual(updatedTodos);
        });
        (0, globals_1.it)("should handle empty todo list", async () => {
            // Create initial list
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, [
                {
                    content: "Task 1",
                    status: "pending",
                },
            ]);
            // Clear list
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, []);
            const storedTodos = await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir);
            (0, globals_1.expect)(storedTodos).toEqual([]);
        });
        (0, globals_1.it)("should reject when exceeding MAX_TODOS limit", async () => {
            // Create a list with 8 items (exceeds MAX_TODOS = 7)
            const tooManyTodos = [
                { content: "Task 1", status: "completed" },
                { content: "Task 2", status: "completed" },
                { content: "Task 3", status: "completed" },
                { content: "Task 4", status: "completed" },
                { content: "Task 5", status: "in_progress" },
                { content: "Task 6", status: "pending" },
                { content: "Task 7", status: "pending" },
                { content: "Task 8", status: "pending" },
            ];
            await (0, globals_1.expect)((0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, tooManyTodos)).rejects.toThrow(/Too many TODOs \(8\/7\)/i);
            await (0, globals_1.expect)((0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, tooManyTodos)).rejects.toThrow(/Keep high precision at the center/i);
        });
        (0, globals_1.it)("should accept exactly MAX_TODOS items", async () => {
            const maxTodos = [
                { content: "Old work (2 tasks)", status: "completed" },
                { content: "Recent task", status: "completed" },
                { content: "Current work", status: "in_progress" },
                { content: "Next step 1", status: "pending" },
                { content: "Next step 2", status: "pending" },
                { content: "Next step 3", status: "pending" },
                { content: "Future work (5 items)", status: "pending" },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, maxTodos);
            (0, globals_1.expect)(await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir)).toEqual(maxTodos);
        });
        (0, globals_1.it)("should reject multiple in_progress tasks", async () => {
            const validTodos = [
                {
                    content: "Step 1",
                    status: "pending",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, validTodos);
            const invalidTodos = [
                {
                    content: "Step 1",
                    status: "in_progress",
                },
                {
                    content: "Step 2",
                    status: "in_progress",
                },
            ];
            await (0, globals_1.expect)((0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, invalidTodos)).rejects.toThrow(/only one task can be marked as in_progress/i);
            // Original todos should remain unchanged on failure
            (0, globals_1.expect)(await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir)).toEqual(validTodos);
        });
        (0, globals_1.it)("should reject when in_progress tasks appear after pending", async () => {
            const invalidTodos = [
                {
                    content: "Step 1",
                    status: "pending",
                },
                {
                    content: "Step 2",
                    status: "in_progress",
                },
            ];
            await (0, globals_1.expect)((0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, invalidTodos)).rejects.toThrow(/in-progress tasks must appear before pending tasks/i);
        });
        (0, globals_1.it)("should reject when completed tasks appear after in_progress", async () => {
            const invalidTodos = [
                {
                    content: "Step 1",
                    status: "in_progress",
                },
                {
                    content: "Step 2",
                    status: "completed",
                },
            ];
            await (0, globals_1.expect)((0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, invalidTodos)).rejects.toThrow(/completed tasks must appear before in-progress or pending tasks/i);
        });
        (0, globals_1.it)("should allow all completed tasks without in_progress", async () => {
            const todos = [
                {
                    content: "Step 1",
                    status: "completed",
                },
                {
                    content: "Step 2",
                    status: "completed",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, todos);
            (0, globals_1.expect)(await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir)).toEqual(todos);
        });
        (0, globals_1.it)("should create directory if it doesn't exist", async () => {
            // Use a non-existent nested directory path
            const nonExistentDir = path.join(os.tmpdir(), "todo-nonexistent-test", "nested", "path");
            try {
                const todos = [
                    {
                        content: "Test task",
                        status: "pending",
                    },
                ];
                // Should not throw even though directory doesn't exist
                await (0, todo_1.setTodosForSessionDir)(workspaceId, nonExistentDir, todos);
                // Verify the file was created and is readable
                const retrievedTodos = await (0, todo_1.getTodosForSessionDir)(nonExistentDir);
                (0, globals_1.expect)(retrievedTodos).toEqual(todos);
                // Verify the directory was actually created
                const dirStats = await fs.stat(nonExistentDir);
                (0, globals_1.expect)(dirStats.isDirectory()).toBe(true);
            }
            finally {
                // Clean up the created directory
                await fs.rm(path.join(os.tmpdir(), "todo-nonexistent-test"), {
                    recursive: true,
                    force: true,
                });
            }
        });
    });
    (0, globals_1.describe)("getTodosForSessionDir", () => {
        (0, globals_1.it)("should return empty array when no todos exist", async () => {
            const todos = await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir);
            (0, globals_1.expect)(todos).toEqual([]);
        });
        (0, globals_1.it)("should return current todo list", async () => {
            const todos = [
                {
                    content: "Task 1",
                    status: "completed",
                },
                {
                    content: "Task 2",
                    status: "in_progress",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, todos);
            const retrievedTodos = await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir);
            (0, globals_1.expect)(retrievedTodos).toEqual(todos);
        });
    });
    (0, globals_1.describe)("workspace isolation", () => {
        (0, globals_1.it)("should isolate todos between different session directories", async () => {
            const tempDir1 = await fs.mkdtemp(path.join(os.tmpdir(), "todo-test-1-"));
            const tempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), "todo-test-2-"));
            try {
                // Create different todos in each temp directory
                const todos1 = [
                    {
                        content: "Stream 1 task",
                        status: "pending",
                    },
                ];
                const todos2 = [
                    {
                        content: "Stream 2 task",
                        status: "pending",
                    },
                ];
                await (0, todo_1.setTodosForSessionDir)("ws-1", tempDir1, todos1);
                await (0, todo_1.setTodosForSessionDir)("ws-2", tempDir2, todos2);
                // Verify each session directory has its own todos
                const retrievedTodos1 = await (0, todo_1.getTodosForSessionDir)(tempDir1);
                const retrievedTodos2 = await (0, todo_1.getTodosForSessionDir)(tempDir2);
                (0, globals_1.expect)(retrievedTodos1).toEqual(todos1);
                (0, globals_1.expect)(retrievedTodos2).toEqual(todos2);
            }
            finally {
                // Clean up
                await fs.rm(tempDir1, { recursive: true, force: true });
                await fs.rm(tempDir2, { recursive: true, force: true });
            }
        });
    });
    (0, globals_1.describe)("clearTodosForSessionDir", () => {
        (0, globals_1.it)("should clear todos for specific temp directory", async () => {
            const todos = [
                {
                    content: "Task 1",
                    status: "pending",
                },
            ];
            await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, todos);
            (0, globals_1.expect)(await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir)).toEqual(todos);
            await (0, todo_1.clearTodosForSessionDir)(workspaceId, workspaceSessionDir);
            (0, globals_1.expect)(await (0, todo_1.getTodosForSessionDir)(workspaceSessionDir)).toEqual([]);
        });
    });
});
//# sourceMappingURL=todo.test.js.map