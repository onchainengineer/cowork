"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamErrorTypeSchema = exports.SendMessageErrorSchema = void 0;
const zod_1 = require("zod");
/**
 * Discriminated union for all possible sendMessage errors
 * The frontend is responsible for language and messaging for api_key_not_found and
 * provider_not_supported errors. Other error types include details needed for display.
 */
exports.SendMessageErrorSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({ type: zod_1.z.literal("api_key_not_found"), provider: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal("provider_not_supported"), provider: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal("invalid_model_string"), message: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal("incompatible_workspace"), message: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal("runtime_not_ready"), message: zod_1.z.string() }),
    zod_1.z.object({ type: zod_1.z.literal("runtime_start_failed"), message: zod_1.z.string() }), // Transient - retryable
    zod_1.z.object({ type: zod_1.z.literal("unknown"), raw: zod_1.z.string() }),
]);
/**
 * Stream error types - categorizes errors during AI streaming
 * Used across backend (StreamManager) and frontend (StreamErrorMessage)
 */
exports.StreamErrorTypeSchema = zod_1.z.enum([
    "authentication", // API key issues, 401 errors
    "rate_limit", // 429 rate limiting
    "server_error", // 5xx server errors
    "api", // Generic API errors
    "retry_failed", // Retry exhausted
    "aborted", // User aborted
    "network", // Network/fetch errors
    "context_exceeded", // Context length/token limit exceeded
    "quota", // Usage quota/billing limits
    "model_not_found", // Model does not exist
    "runtime_not_ready", // Container/runtime doesn't exist or failed to start (permanent)
    "runtime_start_failed", // Runtime is starting or temporarily unavailable (retryable)
    "unknown", // Catch-all
]);
//# sourceMappingURL=errors.js.map