"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBashTaskId = toBashTaskId;
exports.fromBashTaskId = fromBashTaskId;
exports.isBashTaskId = isBashTaskId;
const strict_1 = __importDefault(require("node:assert/strict"));
const BASH_TASK_ID_PREFIX = "bash:";
function toBashTaskId(processId) {
    (0, strict_1.default)(typeof processId === "string", "toBashTaskId: processId must be a string");
    const trimmed = processId.trim();
    (0, strict_1.default)(trimmed.length > 0, "toBashTaskId: processId must be non-empty");
    return `${BASH_TASK_ID_PREFIX}${trimmed}`;
}
function fromBashTaskId(taskId) {
    (0, strict_1.default)(typeof taskId === "string", "fromBashTaskId: taskId must be a string");
    if (!taskId.startsWith(BASH_TASK_ID_PREFIX)) {
        return null;
    }
    const processId = taskId.slice(BASH_TASK_ID_PREFIX.length).trim();
    return processId.length > 0 ? processId : null;
}
function isBashTaskId(taskId) {
    return fromBashTaskId(taskId) !== null;
}
//# sourceMappingURL=taskId.js.map