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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTodoReadTool = exports.createTodoWriteTool = void 0;
exports.setTodosForSessionDir = setTodosForSessionDir;
exports.getTodosForSessionDir = getTodosForSessionDir;
exports.clearTodosForSessionDir = clearTodosForSessionDir;
const ai_1 = require("ai");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const toolLimits_1 = require("../../../common/constants/toolLimits");
const todoStorage_1 = require("../../../node/services/todos/todoStorage");
const workspaceFileLocks_1 = require("../../../node/utils/concurrency/workspaceFileLocks");
/**
 * Validate todo sequencing rules before persisting.
 * Enforces order: completed → in_progress → pending (top to bottom)
 * Enforces maximum count to encourage summarization.
 */
function validateTodos(todos) {
    if (!Array.isArray(todos)) {
        throw new Error("Invalid todos payload: expected an array");
    }
    if (todos.length === 0) {
        return;
    }
    // Enforce maximum TODO count
    if (todos.length > toolLimits_1.MAX_TODOS) {
        throw new Error(`Too many TODOs (${todos.length}/${toolLimits_1.MAX_TODOS}). ` +
            `Keep high precision at the center: ` +
            `summarize old completed work (e.g., 'Setup phase (3 tasks)'), ` +
            `keep recent completions detailed (1-2), ` +
            `one in_progress, ` +
            `immediate pending detailed (2-3), ` +
            `and summarize far future work (e.g., 'Testing phase (4 items)').`);
    }
    let phase = "completed";
    let inProgressCount = 0;
    todos.forEach((todo, index) => {
        const status = todo.status;
        switch (status) {
            case "completed": {
                if (phase !== "completed") {
                    throw new Error(`Invalid todo order at index ${index}: completed tasks must appear before in-progress or pending tasks`);
                }
                // Stay in completed phase
                break;
            }
            case "in_progress": {
                if (phase === "pending") {
                    throw new Error(`Invalid todo order at index ${index}: in-progress tasks must appear before pending tasks`);
                }
                inProgressCount += 1;
                if (inProgressCount > 1) {
                    throw new Error("Invalid todo list: only one task can be marked as in_progress at a time");
                }
                // Transition to in_progress phase (from completed or stay in in_progress)
                phase = "in_progress";
                break;
            }
            case "pending": {
                // Transition to pending phase (from completed, in_progress, or stay in pending)
                phase = "pending";
                break;
            }
            default: {
                throw new Error(`Invalid todo status at index ${index}: ${String(status)}`);
            }
        }
    });
}
/**
 * Write todos to the workspace session directory.
 */
async function writeTodos(workspaceId, workspaceSessionDir, todos) {
    validateTodos(todos);
    await workspaceFileLocks_1.workspaceFileLocks.withLock(workspaceId, async () => {
        const todoFile = (0, todoStorage_1.getTodoFilePath)(workspaceSessionDir);
        await fs.mkdir(path.dirname(todoFile), { recursive: true });
        await (0, write_file_atomic_1.default)(todoFile, JSON.stringify(todos, null, 2));
    });
}
async function clearTodos(workspaceId, workspaceSessionDir) {
    await workspaceFileLocks_1.workspaceFileLocks.withLock(workspaceId, async () => {
        const todoFile = (0, todoStorage_1.getTodoFilePath)(workspaceSessionDir);
        try {
            await fs.unlink(todoFile);
        }
        catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                return;
            }
            throw error;
        }
    });
}
/**
 * Todo write tool factory
 * Creates a tool that allows the AI to create/update the todo list
 */
const createTodoWriteTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.todo_write.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.todo_write.schema,
        execute: async ({ todos }) => {
            (0, assert_1.default)(config.workspaceId, "todo_write requires workspaceId");
            (0, assert_1.default)(config.workspaceSessionDir, "todo_write requires workspaceSessionDir");
            await writeTodos(config.workspaceId, config.workspaceSessionDir, todos);
            return {
                success: true,
                count: todos.length,
            };
        },
    });
};
exports.createTodoWriteTool = createTodoWriteTool;
/**
 * Todo read tool factory
 * Creates a tool that allows the AI to read the current todo list
 */
const createTodoReadTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.todo_read.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.todo_read.schema,
        execute: async () => {
            (0, assert_1.default)(config.workspaceSessionDir, "todo_read requires workspaceSessionDir");
            const todos = await (0, todoStorage_1.readTodosForSessionDir)(config.workspaceSessionDir);
            return {
                todos,
            };
        },
    });
};
exports.createTodoReadTool = createTodoReadTool;
/**
 * Set todos for a workspace session directory (useful for testing)
 */
async function setTodosForSessionDir(workspaceId, workspaceSessionDir, todos) {
    await writeTodos(workspaceId, workspaceSessionDir, todos);
}
/**
 * Get todos for a workspace session directory (useful for testing)
 */
async function getTodosForSessionDir(workspaceSessionDir) {
    return (0, todoStorage_1.readTodosForSessionDir)(workspaceSessionDir);
}
/**
 * Clear todos for a workspace session directory (useful for testing and cleanup)
 */
async function clearTodosForSessionDir(workspaceId, workspaceSessionDir) {
    await clearTodos(workspaceId, workspaceSessionDir);
}
//# sourceMappingURL=todo.js.map