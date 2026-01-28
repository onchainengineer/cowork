"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireWorkspaceId = requireWorkspaceId;
exports.requireTaskService = requireTaskService;
exports.parseToolResult = parseToolResult;
exports.dedupeStrings = dedupeStrings;
const strict_1 = __importDefault(require("node:assert/strict"));
function requireWorkspaceId(config, toolName) {
    (0, strict_1.default)(config.workspaceId, `${toolName} requires workspaceId`);
    return config.workspaceId;
}
function requireTaskService(config, toolName) {
    (0, strict_1.default)(config.taskService, `${toolName} requires taskService`);
    return config.taskService;
}
function parseToolResult(schema, value, toolName) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw new Error(`${toolName} tool result validation failed: ${parsed.error.message}`);
    }
    return parsed.data;
}
function dedupeStrings(values) {
    return Array.from(new Set(values));
}
//# sourceMappingURL=toolUtils.js.map