"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTodoItemsAsMarkdownList = renderTodoItemsAsMarkdownList;
function renderTodoItemsAsMarkdownList(todos) {
    return todos
        .map((todo) => {
        const statusMarker = todo.status === "completed" ? "[x]" : todo.status === "in_progress" ? "[>]" : "[ ]";
        return `- ${statusMarker} ${todo.content}`;
    })
        .join("\n");
}
//# sourceMappingURL=todoList.js.map