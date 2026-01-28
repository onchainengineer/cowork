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
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const todo_1 = require("../../../../node/services/tools/todo");
const TodoListReminderSource_1 = require("./TodoListReminderSource");
(0, bun_test_1.describe)("TodoListReminderSource", () => {
    const workspaceId = "ws-test";
    let workspaceSessionDir;
    (0, bun_test_1.beforeEach)(async () => {
        workspaceSessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-todos-"));
        await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, [
            { content: "Completed", status: "completed" },
            { content: "In progress", status: "in_progress" },
            { content: "Pending", status: "pending" },
        ]);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(workspaceSessionDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("reminds after 5 tool calls, then every 10", async () => {
        const source = new TodoListReminderSource_1.TodoListReminderSource({ workspaceSessionDir });
        for (let i = 0; i < 4; i += 1) {
            const notifications = await source.poll({ toolName: "bash", toolSucceeded: true, now: i });
            (0, bun_test_1.expect)(notifications).toEqual([]);
        }
        const fifth = await source.poll({ toolName: "bash", toolSucceeded: true, now: 4 });
        (0, bun_test_1.expect)(fifth.length).toBe(1);
        (0, bun_test_1.expect)(fifth[0].content).toContain("5 tool calls");
        (0, bun_test_1.expect)(fifth[0].content).toContain("- [>] In progress");
        for (let i = 0; i < 9; i += 1) {
            const notifications = await source.poll({
                toolName: "bash",
                toolSucceeded: true,
                now: 5 + i,
            });
            (0, bun_test_1.expect)(notifications).toEqual([]);
        }
        const fifteenth = await source.poll({ toolName: "bash", toolSucceeded: true, now: 14 });
        (0, bun_test_1.expect)(fifteenth.length).toBe(1);
        (0, bun_test_1.expect)(fifteenth[0].content).toContain("15 tool calls");
    });
    (0, bun_test_1.test)("resets after successful todo_write", async () => {
        const source = new TodoListReminderSource_1.TodoListReminderSource({ workspaceSessionDir });
        for (let i = 0; i < 4; i += 1) {
            await source.poll({ toolName: "bash", toolSucceeded: true, now: i });
        }
        const write = await source.poll({ toolName: "todo_write", toolSucceeded: true, now: 100 });
        (0, bun_test_1.expect)(write).toEqual([]);
        for (let i = 0; i < 4; i += 1) {
            const notifications = await source.poll({
                toolName: "bash",
                toolSucceeded: true,
                now: 200 + i,
            });
            (0, bun_test_1.expect)(notifications).toEqual([]);
        }
        const fifthAfterReset = await source.poll({ toolName: "bash", toolSucceeded: true, now: 205 });
        (0, bun_test_1.expect)(fifthAfterReset.length).toBe(1);
        (0, bun_test_1.expect)(fifthAfterReset[0].content).toContain("5 tool calls");
    });
    (0, bun_test_1.test)("suppresses reminder when todo list is empty", async () => {
        const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-todos-empty-"));
        const source = new TodoListReminderSource_1.TodoListReminderSource({ workspaceSessionDir: emptyDir });
        try {
            for (let i = 0; i < 5; i += 1) {
                const notifications = await source.poll({ toolName: "bash", toolSucceeded: true, now: i });
                (0, bun_test_1.expect)(notifications).toEqual([]);
            }
        }
        finally {
            await fs.rm(emptyDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.test)("suppresses reminder when all todos are completed", async () => {
        await (0, todo_1.setTodosForSessionDir)(workspaceId, workspaceSessionDir, [
            { content: "Done 1", status: "completed" },
            { content: "Done 2", status: "completed" },
        ]);
        const source = new TodoListReminderSource_1.TodoListReminderSource({ workspaceSessionDir });
        for (let i = 0; i < 5; i += 1) {
            const notifications = await source.poll({ toolName: "bash", toolSucceeded: true, now: i });
            (0, bun_test_1.expect)(notifications).toEqual([]);
        }
    });
});
//# sourceMappingURL=TodoListReminderSource.test.js.map