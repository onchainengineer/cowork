"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionTimingFileSchema = exports.WorkspaceStatsSnapshotSchema = exports.SessionTimingStatsSchema = exports.ModelTimingStatsSchema = exports.CompletedStreamStatsSchema = exports.ActiveStreamStatsSchema = exports.TimingAnomalySchema = void 0;
const zod_1 = require("zod");
const mode_1 = require("../../types/mode");
// Mode is an enum, but we defensively drop unknown values when replaying old history.
const ModeSchema = mode_1.AgentModeSchema.optional().catch(undefined);
exports.TimingAnomalySchema = zod_1.z.enum([
    "negative_duration",
    "tool_gt_total",
    "ttft_gt_total",
    "percent_out_of_range",
    "nan",
]);
exports.ActiveStreamStatsSchema = zod_1.z.object({
    messageId: zod_1.z.string(),
    model: zod_1.z.string(),
    mode: ModeSchema,
    elapsedMs: zod_1.z.number(),
    ttftMs: zod_1.z.number().nullable(),
    toolExecutionMs: zod_1.z.number(),
    modelTimeMs: zod_1.z.number(),
    streamingMs: zod_1.z.number(),
    outputTokens: zod_1.z.number(),
    reasoningTokens: zod_1.z.number(),
    /** Total tokens streamed so far (text + reasoning + tool args). */
    liveTokenCount: zod_1.z.number(),
    /** Tokens/sec, trailing window. */
    liveTPS: zod_1.z.number(),
    invalid: zod_1.z.boolean(),
    anomalies: zod_1.z.array(exports.TimingAnomalySchema),
});
exports.CompletedStreamStatsSchema = zod_1.z.object({
    messageId: zod_1.z.string(),
    model: zod_1.z.string(),
    mode: ModeSchema,
    totalDurationMs: zod_1.z.number(),
    ttftMs: zod_1.z.number().nullable(),
    toolExecutionMs: zod_1.z.number(),
    modelTimeMs: zod_1.z.number(),
    streamingMs: zod_1.z.number(),
    outputTokens: zod_1.z.number(),
    reasoningTokens: zod_1.z.number(),
    invalid: zod_1.z.boolean(),
    anomalies: zod_1.z.array(exports.TimingAnomalySchema),
});
exports.ModelTimingStatsSchema = zod_1.z.object({
    model: zod_1.z.string(),
    mode: ModeSchema,
    totalDurationMs: zod_1.z.number(),
    totalToolExecutionMs: zod_1.z.number(),
    totalStreamingMs: zod_1.z.number(),
    totalTtftMs: zod_1.z.number(),
    ttftCount: zod_1.z.number(),
    responseCount: zod_1.z.number(),
    totalOutputTokens: zod_1.z.number(),
    totalReasoningTokens: zod_1.z.number(),
});
exports.SessionTimingStatsSchema = zod_1.z.object({
    totalDurationMs: zod_1.z.number(),
    totalToolExecutionMs: zod_1.z.number(),
    totalStreamingMs: zod_1.z.number(),
    totalTtftMs: zod_1.z.number(),
    ttftCount: zod_1.z.number(),
    responseCount: zod_1.z.number(),
    totalOutputTokens: zod_1.z.number(),
    totalReasoningTokens: zod_1.z.number(),
    /** Per-model breakdown (key is stable identifier like normalizeGatewayModel(model) or model:mode). */
    byModel: zod_1.z.record(zod_1.z.string(), exports.ModelTimingStatsSchema),
});
exports.WorkspaceStatsSnapshotSchema = zod_1.z.object({
    workspaceId: zod_1.z.string(),
    generatedAt: zod_1.z.number(),
    active: exports.ActiveStreamStatsSchema.optional(),
    lastRequest: exports.CompletedStreamStatsSchema.optional(),
    session: exports.SessionTimingStatsSchema.optional(),
});
exports.SessionTimingFileSchema = zod_1.z.object({
    version: zod_1.z.literal(2),
    lastRequest: exports.CompletedStreamStatsSchema.optional(),
    session: exports.SessionTimingStatsSchema,
    /**
     * Idempotency ledger for rolled-up sub-agent timing.
     *
     * When a child workspace is deleted, we merge its session timing into the parent.
     * This tracks which children have already been merged to prevent double-counting
     * if removal is retried.
     */
    rolledUpFrom: zod_1.z.record(zod_1.z.string(), zod_1.z.literal(true)).optional(),
});
//# sourceMappingURL=workspaceStats.js.map