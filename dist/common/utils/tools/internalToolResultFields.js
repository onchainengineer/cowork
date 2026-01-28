"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD = void 0;
exports.attachModelOnlyToolNotifications = attachModelOnlyToolNotifications;
exports.stripInternalToolResultFields = stripInternalToolResultFields;
const assert_1 = __importDefault(require("../../../common/utils/assert"));
/**
 * Reserved fields that may be injected into tool results for model-only consumption.
 *
 * IMPORTANT: These fields MUST be stripped before persisting tool outputs to disk or
 * sending them to the UI.
 */
exports.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD = "__mux_notifications";
function attachModelOnlyToolNotifications(result, notifications) {
    (0, assert_1.default)(Array.isArray(notifications), "notifications must be an array");
    if (notifications.length === 0) {
        return result;
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return result;
    }
    const record = result;
    const existing = record[exports.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD];
    const merged = Array.isArray(existing)
        ? [
            ...existing.filter((item) => typeof item === "string"),
            ...notifications,
        ]
        : notifications;
    return {
        ...record,
        [exports.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD]: merged,
    };
}
/**
 * Strip model-only fields from tool results before persisting them to history/partial.
 */
function stripInternalToolResultFields(result) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return result;
    }
    if (!(exports.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD in result)) {
        return result;
    }
    const { [exports.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD]: _notifications, ...rest } = result;
    void _notifications;
    return rest;
}
//# sourceMappingURL=internalToolResultFields.js.map