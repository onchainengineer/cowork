"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueueDebug = taskQueueDebug;
function taskQueueDebug(message, details) {
    if (process.env.UNIX_DEBUG_TASK_QUEUE !== "1")
        return;
    console.log(`[task-queue] ${message}`, details ?? {});
}
//# sourceMappingURL=taskQueueDebug.js.map