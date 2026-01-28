"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const sendMessageError_1 = require("./sendMessageError");
(0, bun_test_1.describe)("buildStreamErrorEventData", () => {
    (0, bun_test_1.test)("builds a stream-error payload with a synthetic messageId", () => {
        const result = (0, sendMessageError_1.buildStreamErrorEventData)({
            type: "api_key_not_found",
            provider: "openai",
        });
        (0, bun_test_1.expect)(result.errorType).toBe("authentication");
        (0, bun_test_1.expect)(result.error).toContain("openai");
        (0, bun_test_1.expect)(result.messageId).toMatch(/^assistant-/);
    });
});
(0, bun_test_1.describe)("createStreamErrorMessage", () => {
    (0, bun_test_1.test)("defaults errorType to unknown", () => {
        const result = (0, sendMessageError_1.createStreamErrorMessage)({
            messageId: "assistant-test",
            error: "something went wrong",
        });
        (0, bun_test_1.expect)(result.type).toBe("stream-error");
        (0, bun_test_1.expect)(result.errorType).toBe("unknown");
        (0, bun_test_1.expect)(result.messageId).toBe("assistant-test");
    });
});
(0, bun_test_1.describe)("createErrorEvent", () => {
    (0, bun_test_1.test)("builds an error event payload", () => {
        const result = (0, sendMessageError_1.createErrorEvent)("workspace-1", {
            messageId: "assistant-123",
            error: "something broke",
            errorType: "unknown",
        });
        (0, bun_test_1.expect)(result).toEqual({
            type: "error",
            workspaceId: "workspace-1",
            messageId: "assistant-123",
            error: "something broke",
            errorType: "unknown",
        });
    });
});
(0, bun_test_1.describe)("coerceStreamErrorTypeForMessage", () => {
    (0, bun_test_1.test)("forces authentication when API key hints are present", () => {
        const result = (0, sendMessageError_1.coerceStreamErrorTypeForMessage)("unknown", "Missing API key");
        (0, bun_test_1.expect)(result).toBe("authentication");
    });
    (0, bun_test_1.test)("keeps the original errorType otherwise", () => {
        const result = (0, sendMessageError_1.coerceStreamErrorTypeForMessage)("network", "Connection reset");
        (0, bun_test_1.expect)(result).toBe("network");
    });
});
(0, bun_test_1.describe)("formatSendMessageError", () => {
    (0, bun_test_1.test)("formats api_key_not_found with authentication errorType", () => {
        const result = (0, sendMessageError_1.formatSendMessageError)({
            type: "api_key_not_found",
            provider: "anthropic",
        });
        (0, bun_test_1.expect)(result.errorType).toBe("authentication");
        (0, bun_test_1.expect)(result.message).toContain("anthropic");
        (0, bun_test_1.expect)(result.message).toContain("API key");
    });
    (0, bun_test_1.test)("formats provider_not_supported", () => {
        const result = (0, sendMessageError_1.formatSendMessageError)({
            type: "provider_not_supported",
            provider: "unsupported-provider",
        });
        (0, bun_test_1.expect)(result.errorType).toBe("unknown");
        (0, bun_test_1.expect)(result.message).toContain("unsupported-provider");
        (0, bun_test_1.expect)(result.message).toContain("not supported");
    });
    (0, bun_test_1.test)("formats invalid_model_string with model_not_found errorType", () => {
        const result = (0, sendMessageError_1.formatSendMessageError)({
            type: "invalid_model_string",
            message: "Invalid model format: foo",
        });
        (0, bun_test_1.expect)(result.errorType).toBe("model_not_found");
        (0, bun_test_1.expect)(result.message).toBe("Invalid model format: foo");
    });
    (0, bun_test_1.test)("formats incompatible_workspace", () => {
        const result = (0, sendMessageError_1.formatSendMessageError)({
            type: "incompatible_workspace",
            message: "Workspace is incompatible",
        });
        (0, bun_test_1.expect)(result.errorType).toBe("unknown");
        (0, bun_test_1.expect)(result.message).toBe("Workspace is incompatible");
    });
    (0, bun_test_1.test)("formats unknown errors", () => {
        const result = (0, sendMessageError_1.formatSendMessageError)({
            type: "unknown",
            raw: "Something went wrong",
        });
        (0, bun_test_1.expect)(result.errorType).toBe("unknown");
        (0, bun_test_1.expect)(result.message).toBe("Something went wrong");
    });
});
(0, bun_test_1.describe)("createUnknownSendMessageError", () => {
    (0, bun_test_1.test)("creates unknown error with trimmed message", () => {
        const result = (0, sendMessageError_1.createUnknownSendMessageError)("  test error  ");
        (0, bun_test_1.expect)(result).toEqual({ type: "unknown", raw: "test error" });
    });
    (0, bun_test_1.test)("throws on empty message", () => {
        (0, bun_test_1.expect)(() => (0, sendMessageError_1.createUnknownSendMessageError)("")).toThrow();
        (0, bun_test_1.expect)(() => (0, sendMessageError_1.createUnknownSendMessageError)("   ")).toThrow();
    });
    (0, bun_test_1.test)("strips 'undefined: ' prefix from error messages", () => {
        const result = (0, sendMessageError_1.createUnknownSendMessageError)("undefined: The document file name can only contain alphanumeric characters");
        (0, bun_test_1.expect)(result.type).toBe("unknown");
        if (result.type === "unknown") {
            (0, bun_test_1.expect)(result.raw).toBe("The document file name can only contain alphanumeric characters");
            (0, bun_test_1.expect)(result.raw).not.toContain("undefined:");
        }
    });
    (0, bun_test_1.test)("preserves messages without 'undefined: ' prefix", () => {
        const result = (0, sendMessageError_1.createUnknownSendMessageError)("Normal error message");
        (0, bun_test_1.expect)(result.type).toBe("unknown");
        if (result.type === "unknown") {
            (0, bun_test_1.expect)(result.raw).toBe("Normal error message");
        }
    });
    (0, bun_test_1.test)("only strips prefix when at the start of message", () => {
        const result = (0, sendMessageError_1.createUnknownSendMessageError)("Error code undefined: something happened");
        (0, bun_test_1.expect)(result.type).toBe("unknown");
        if (result.type === "unknown") {
            (0, bun_test_1.expect)(result.raw).toBe("Error code undefined: something happened");
        }
    });
});
//# sourceMappingURL=sendMessageError.test.js.map