"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionUsageFileSchema = exports.SessionUsageTokenStatsCacheSchema = exports.ChatStatsSchema = exports.ChatUsageDisplaySchema = exports.ChatUsageComponentSchema = exports.TokenConsumerSchema = exports.TopFilePathSchema = void 0;
const zod_1 = require("zod");
/** Top file path entry for file_read/file_edit consumers */
exports.TopFilePathSchema = zod_1.z.object({
    path: zod_1.z.string().meta({ description: "File path (relative or absolute)" }),
    tokens: zod_1.z.number().meta({ description: "Token count for this file" }),
});
exports.TokenConsumerSchema = zod_1.z.object({
    name: zod_1.z.string().meta({ description: '"User", "Assistant", "bash", "readFile", etc.' }),
    tokens: zod_1.z.number().meta({ description: "Total token count for this consumer" }),
    percentage: zod_1.z.number().meta({ description: "% of total tokens" }),
    fixedTokens: zod_1.z
        .number()
        .optional()
        .meta({ description: "Fixed overhead (e.g., tool definitions)" }),
    variableTokens: zod_1.z
        .number()
        .optional()
        .meta({ description: "Variable usage (e.g., actual tool calls, text)" }),
});
exports.ChatUsageComponentSchema = zod_1.z.object({
    tokens: zod_1.z.number(),
    cost_usd: zod_1.z.number().optional(),
});
exports.ChatUsageDisplaySchema = zod_1.z.object({
    input: exports.ChatUsageComponentSchema,
    cached: exports.ChatUsageComponentSchema,
    cacheCreate: exports.ChatUsageComponentSchema,
    output: exports.ChatUsageComponentSchema,
    reasoning: exports.ChatUsageComponentSchema,
    model: zod_1.z.string().optional(),
});
exports.ChatStatsSchema = zod_1.z.object({
    consumers: zod_1.z.array(exports.TokenConsumerSchema).meta({ description: "Sorted descending by token count" }),
    totalTokens: zod_1.z.number(),
    model: zod_1.z.string(),
    tokenizerName: zod_1.z.string().meta({ description: 'e.g., "o200k_base", "claude"' }),
    usageHistory: zod_1.z
        .array(exports.ChatUsageDisplaySchema)
        .meta({ description: "Ordered array of actual usage statistics from API responses" }),
    topFilePaths: zod_1.z
        .array(exports.TopFilePathSchema)
        .optional()
        .meta({ description: "Top 10 files by token count aggregated across all file tools" }),
});
/**
 * Cached token statistics for consumer/file breakdown in the Costs tab.
 *
 * Stored inside session-usage.json to avoid re-tokenizing on every app start.
 */
exports.SessionUsageTokenStatsCacheSchema = zod_1.z.object({
    version: zod_1.z.literal(1),
    computedAt: zod_1.z.number().meta({ description: "Unix timestamp (ms) when this cache was computed" }),
    model: zod_1.z
        .string()
        .meta({ description: "Model used for tokenization (affects tokenizer + tool definitions)" }),
    tokenizerName: zod_1.z.string().meta({ description: 'e.g., "o200k_base", "claude"' }),
    history: zod_1.z.object({
        messageCount: zod_1.z.number().meta({ description: "Number of messages used to compute this cache" }),
        maxHistorySequence: zod_1.z
            .number()
            .optional()
            .meta({ description: "Max UnixMessage.metadata.historySequence seen in the message list" }),
    }),
    consumers: zod_1.z.array(exports.TokenConsumerSchema).meta({ description: "Sorted descending by token count" }),
    totalTokens: zod_1.z.number(),
    topFilePaths: zod_1.z
        .array(exports.TopFilePathSchema)
        .optional()
        .meta({ description: "Top 10 files by token count aggregated across all file tools" }),
});
/**
 * Cumulative session usage file format.
 * Stored in ~/.unix/sessions/{workspaceId}/session-usage.json
 */
exports.SessionUsageFileSchema = zod_1.z.object({
    byModel: zod_1.z.record(zod_1.z.string(), exports.ChatUsageDisplaySchema),
    lastRequest: zod_1.z
        .object({
        model: zod_1.z.string(),
        usage: exports.ChatUsageDisplaySchema,
        timestamp: zod_1.z.number(),
    })
        .optional(),
    /**
     * Idempotency ledger for rolled-up sub-agent usage.
     * Key: child workspaceId, value: true.
     */
    rolledUpFrom: zod_1.z.record(zod_1.z.string(), zod_1.z.literal(true)).optional(),
    tokenStatsCache: exports.SessionUsageTokenStatsCacheSchema.optional(),
    version: zod_1.z.literal(1),
});
//# sourceMappingURL=chatStats.js.map