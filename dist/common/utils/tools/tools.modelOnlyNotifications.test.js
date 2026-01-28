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
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const todo_1 = require("../../../node/services/tools/todo");
const internalToolResultFields_1 = require("./internalToolResultFields");
const tools_1 = require("./tools");
function getExecute(tool) {
    if (!tool || typeof tool !== "object" || !("execute" in tool)) {
        throw new Error("Tool is missing execute()");
    }
    const execute = tool.execute;
    if (typeof execute !== "function") {
        throw new Error("Tool execute() is not a function");
    }
    return execute;
}
function asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Expected a plain object tool result");
    }
    return value;
}
(0, bun_test_1.describe)("getToolsForModel - model-only notifications", () => {
    (0, bun_test_1.test)("injects __mux_notifications into tool results after 5 tool calls", async () => {
        const workspaceSessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-ws-"));
        try {
            await (0, todo_1.setTodosForSessionDir)("ws-1", workspaceSessionDir, [
                { content: "Completed", status: "completed" },
                { content: "In progress", status: "in_progress" },
                { content: "Pending", status: "pending" },
            ]);
            const runtime = new LocalRuntime_1.LocalRuntime(process.cwd());
            const initStateManager = {
                waitForInit: () => Promise.resolve(),
            };
            const tools = await (0, tools_1.getToolsForModel)("noop:model", {
                cwd: process.cwd(),
                runtime,
                runtimeTempDir: "/tmp",
                workspaceSessionDir,
            }, "ws-1", initStateManager);
            const todoReadExecute = getExecute(tools.todo_read);
            for (let i = 0; i < 4; i += 1) {
                const result = asRecord(await todoReadExecute());
                (0, bun_test_1.expect)(internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD in result).toBe(false);
            }
            const fifth = asRecord(await todoReadExecute());
            (0, bun_test_1.expect)(Array.isArray(fifth[internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD])).toBe(true);
            (0, bun_test_1.expect)(String(fifth[internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD][0])).toContain("Current TODO List");
        }
        finally {
            await fs.rm(workspaceSessionDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.test)("does not re-wrap cached MCP tools across getToolsForModel() calls", async () => {
        const workspaceSessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-ws-"));
        try {
            await (0, todo_1.setTodosForSessionDir)("ws-1", workspaceSessionDir, [
                { content: "In progress", status: "in_progress" },
            ]);
            const runtime = new LocalRuntime_1.LocalRuntime(process.cwd());
            const initStateManager = {
                waitForInit: () => Promise.resolve(),
            };
            const cachedMcpTool = {
                // eslint-disable-next-line @typescript-eslint/require-await
                execute: async () => ({ ok: true }),
            };
            const tools1 = await (0, tools_1.getToolsForModel)("noop:model", {
                cwd: process.cwd(),
                runtime,
                runtimeTempDir: "/tmp",
                workspaceSessionDir,
            }, "ws-1", initStateManager, undefined, { mcp_dummy: cachedMcpTool });
            const execute1 = getExecute(tools1.mcp_dummy);
            for (let i = 0; i < 4; i += 1) {
                const result = asRecord(await execute1());
                (0, bun_test_1.expect)(internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD in result).toBe(false);
            }
            const tools2 = await (0, tools_1.getToolsForModel)("noop:model", {
                cwd: process.cwd(),
                runtime,
                runtimeTempDir: "/tmp",
                workspaceSessionDir,
            }, "ws-1", initStateManager, undefined, { mcp_dummy: cachedMcpTool });
            const execute2 = getExecute(tools2.mcp_dummy);
            for (let i = 0; i < 4; i += 1) {
                const result = asRecord(await execute2());
                (0, bun_test_1.expect)(internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD in result).toBe(false);
            }
            const fifth = asRecord(await execute2());
            (0, bun_test_1.expect)(Array.isArray(fifth[internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD])).toBe(true);
        }
        finally {
            await fs.rm(workspaceSessionDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.test)("does not enable notification injection when workspaceSessionDir is missing", async () => {
        const runtime = new LocalRuntime_1.LocalRuntime(process.cwd());
        const initStateManager = {
            waitForInit: () => Promise.resolve(),
        };
        const dummyTool = {
            // eslint-disable-next-line @typescript-eslint/require-await
            execute: async () => ({ ok: true }),
        };
        const tools = await (0, tools_1.getToolsForModel)("noop:model", {
            cwd: process.cwd(),
            runtime,
            runtimeTempDir: "/tmp",
        }, "ws-1", initStateManager, undefined, { dummy: dummyTool });
        const dummyExecute = getExecute(tools.dummy);
        for (let i = 0; i < 5; i += 1) {
            const result = asRecord(await dummyExecute());
            (0, bun_test_1.expect)(internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD in result).toBe(false);
        }
    });
    (0, bun_test_1.test)("only attaches notifications to plain-object tool results", async () => {
        const workspaceSessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-ws-"));
        try {
            await (0, todo_1.setTodosForSessionDir)("ws-1", workspaceSessionDir, [
                { content: "In progress", status: "in_progress" },
            ]);
            const runtime = new LocalRuntime_1.LocalRuntime(process.cwd());
            const initStateManager = {
                waitForInit: () => Promise.resolve(),
            };
            const stringTool = {
                // eslint-disable-next-line @typescript-eslint/require-await
                execute: async () => "ok",
            };
            const tools = await (0, tools_1.getToolsForModel)("noop:model", {
                cwd: process.cwd(),
                runtime,
                runtimeTempDir: "/tmp",
                workspaceSessionDir,
            }, "ws-1", initStateManager, undefined, { string_tool: stringTool });
            const stringExecute = getExecute(tools.string_tool);
            const todoReadExecute = getExecute(tools.todo_read);
            for (let i = 0; i < 4; i += 1) {
                const result = await stringExecute();
                (0, bun_test_1.expect)(result).toBe("ok");
            }
            const fifth = asRecord(await todoReadExecute());
            (0, bun_test_1.expect)(Array.isArray(fifth[internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD])).toBe(true);
        }
        finally {
            await fs.rm(workspaceSessionDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=tools.modelOnlyNotifications.test.js.map