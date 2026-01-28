"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoListReminderSource = void 0;
const assert_1 = __importDefault(require("../../../../common/utils/assert"));
const todoList_1 = require("../../../../common/utils/todoList");
const todoStorage_1 = require("../../../../node/services/todos/todoStorage");
const FIRST_REMINDER_TOOL_CALL_COUNT = 5;
const REMINDER_TOOL_CALL_INTERVAL = 10;
function isReminderDue(toolCallsSinceLastTodoWrite) {
    if (toolCallsSinceLastTodoWrite === FIRST_REMINDER_TOOL_CALL_COUNT) {
        return true;
    }
    if (toolCallsSinceLastTodoWrite > FIRST_REMINDER_TOOL_CALL_COUNT) {
        return ((toolCallsSinceLastTodoWrite - FIRST_REMINDER_TOOL_CALL_COUNT) %
            REMINDER_TOOL_CALL_INTERVAL ===
            0);
    }
    return false;
}
class TodoListReminderSource {
    workspaceSessionDir;
    toolCallsSinceLastTodoWrite = 0;
    constructor(args) {
        (0, assert_1.default)(typeof args.workspaceSessionDir === "string", "workspaceSessionDir must be a string");
        this.workspaceSessionDir = args.workspaceSessionDir;
    }
    async poll(ctx) {
        (0, assert_1.default)(typeof ctx.toolName === "string", "toolName must be a string");
        if (ctx.toolName === "todo_write") {
            if (ctx.toolSucceeded) {
                this.toolCallsSinceLastTodoWrite = 0;
            }
            return [];
        }
        this.toolCallsSinceLastTodoWrite += 1;
        if (!isReminderDue(this.toolCallsSinceLastTodoWrite)) {
            return [];
        }
        const todos = await (0, todoStorage_1.readTodosForSessionDir)(this.workspaceSessionDir);
        if (todos.length === 0) {
            return [];
        }
        if (todos.every((t) => t.status === "completed")) {
            return [];
        }
        const renderedTodos = (0, todoList_1.renderTodoItemsAsMarkdownList)(todos);
        const content = `<notification>\nIt's been ${this.toolCallsSinceLastTodoWrite} tool calls since you last updated the TODO list. If your progress changed, update it now using todo_write.\n\nCurrent TODO List:\n${renderedTodos || "- (empty)"}\n</notification>`;
        return [
            {
                source: "todo_list_reminder",
                content,
            },
        ];
    }
}
exports.TodoListReminderSource = TodoListReminderSource;
//# sourceMappingURL=TodoListReminderSource.js.map