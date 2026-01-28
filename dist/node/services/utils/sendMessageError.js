"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStreamErrorEventData = exports.createStreamErrorMessage = exports.coerceStreamErrorTypeForMessage = exports.createErrorEvent = exports.formatSendMessageError = exports.createUnknownSendMessageError = exports.stripNoisyErrorPrefix = void 0;
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const messageIds_1 = require("./messageIds");
/**
 * Strip noisy error prefixes from provider error messages.
 * e.g., "undefined: The document file name can only contain..."
 *       becomes "The document file name can only contain..."
 *
 * These prefixes are artifacts of how upstream errors are coerced to strings
 * (e.g., `${error.type}: ${error.message}` where type is undefined).
 */
const stripNoisyErrorPrefix = (message) => {
    // Strip "undefined: " prefix (common in Anthropic SDK errors)
    if (message.startsWith("undefined: ")) {
        return message.slice("undefined: ".length);
    }
    return message;
};
exports.stripNoisyErrorPrefix = stripNoisyErrorPrefix;
/**
 * Helper to wrap arbitrary errors into SendMessageError structures.
 * Enforces that the raw string is non-empty for defensive debugging.
 */
const createUnknownSendMessageError = (raw) => {
    (0, assert_1.default)(typeof raw === "string", "Expected raw error to be a string");
    const trimmed = (0, exports.stripNoisyErrorPrefix)(raw.trim());
    (0, assert_1.default)(trimmed.length > 0, "createUnknownSendMessageError requires a non-empty message");
    return {
        type: "unknown",
        raw: trimmed,
    };
};
exports.createUnknownSendMessageError = createUnknownSendMessageError;
/**
 * Formats a SendMessageError into a user-visible message and StreamErrorType
 * for display in the chat UI as a stream-error event.
 */
const formatSendMessageError = (error) => {
    switch (error.type) {
        case "api_key_not_found":
            return {
                message: `API key not configured for ${error.provider}. Please add your API key in settings.`,
                errorType: "authentication",
            };
        case "provider_not_supported":
            return {
                message: `Provider "${error.provider}" is not supported.`,
                errorType: "unknown",
            };
        case "invalid_model_string":
            return {
                message: error.message,
                errorType: "model_not_found",
            };
        case "incompatible_workspace":
            return {
                message: error.message,
                errorType: "unknown",
            };
        case "runtime_not_ready":
            return {
                message: `Workspace runtime unavailable: ${error.message}. ` +
                    `The container/workspace may have been removed or does not exist.`,
                errorType: "runtime_not_ready",
            };
        case "runtime_start_failed":
            return {
                message: `Workspace is starting: ${error.message}`,
                errorType: "runtime_start_failed",
            };
        case "unknown":
            return {
                message: error.raw,
                errorType: "unknown",
            };
    }
};
exports.formatSendMessageError = formatSendMessageError;
const createErrorEvent = (workspaceId, payload) => ({
    type: "error",
    workspaceId,
    messageId: payload.messageId,
    error: payload.error,
    errorType: payload.errorType,
});
exports.createErrorEvent = createErrorEvent;
const API_KEY_ERROR_HINTS = ["api key", "api_key", "anthropic_api_key"];
const coerceStreamErrorTypeForMessage = (errorType, errorMessage) => {
    const loweredMessage = errorMessage.toLowerCase();
    if (API_KEY_ERROR_HINTS.some((hint) => loweredMessage.includes(hint))) {
        return "authentication";
    }
    return errorType;
};
exports.coerceStreamErrorTypeForMessage = coerceStreamErrorTypeForMessage;
const createStreamErrorMessage = (payload) => ({
    type: "stream-error",
    messageId: payload.messageId,
    error: payload.error,
    errorType: payload.errorType ?? "unknown",
});
exports.createStreamErrorMessage = createStreamErrorMessage;
/**
 * Build a stream-error payload for pre-stream failures so the UI can surface them immediately.
 */
const buildStreamErrorEventData = (error) => {
    const { message, errorType } = (0, exports.formatSendMessageError)(error);
    const messageId = (0, messageIds_1.createAssistantMessageId)();
    return { messageId, error: message, errorType };
};
exports.buildStreamErrorEventData = buildStreamErrorEventData;
//# sourceMappingURL=sendMessageError.js.map