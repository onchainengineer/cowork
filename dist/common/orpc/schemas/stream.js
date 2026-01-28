"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatUsageDisplaySchema = exports.SendMessageOptionsSchema = exports.ExperimentsSchema = exports.ToolPolicySchema = exports.ToolPolicyFilterSchema = exports.UpdateStatusSchema = exports.WorkspaceChatMessageSchema = exports.RestoreToInputEventSchema = exports.QueuedMessageChangedEventSchema = exports.ReviewNoteDataSchema = exports.ChatUnixMessageSchema = exports.WorkspaceInitEventSchema = exports.InitEndEventSchema = exports.InitOutputEventSchema = exports.InitStartEventSchema = exports.UsageDeltaEventSchema = exports.SessionUsageDeltaEventSchema = exports.ErrorEventSchema = exports.ReasoningEndEventSchema = exports.ReasoningDeltaEventSchema = exports.ToolCallEndEventSchema = exports.BashOutputEventSchema = exports.ToolCallDeltaEventSchema = exports.ToolCallStartEventSchema = exports.StreamAbortEventSchema = exports.StreamAbortReasonSchema = exports.StreamEndEventSchema = exports.LanguageModelV2UsageSchema = exports.CompletedMessagePartSchema = exports.StreamDeltaEventSchema = exports.StreamStartEventSchema = exports.DeleteMessageSchema = exports.StreamErrorMessageSchema = exports.IdleCompactionNeededEventSchema = exports.RuntimeStatusEventSchema = exports.CaughtUpMessageSchema = exports.HeartbeatEventSchema = void 0;
const zod_1 = require("zod");
const agentDefinition_1 = require("./agentDefinition");
const mode_1 = require("../../types/mode");
const chatStats_1 = require("./chatStats");
Object.defineProperty(exports, "ChatUsageDisplaySchema", { enumerable: true, get: function () { return chatStats_1.ChatUsageDisplaySchema; } });
const errors_1 = require("./errors");
const message_1 = require("./message");
const providerOptions_1 = require("./providerOptions");
const runtime_1 = require("./runtime");
// Chat Events
/** Heartbeat event to keep the connection alive during long operations */
exports.HeartbeatEventSchema = zod_1.z.object({
    type: zod_1.z.literal("heartbeat"),
});
exports.CaughtUpMessageSchema = zod_1.z.object({
    type: zod_1.z.literal("caught-up"),
});
/** Sent when a workspace becomes eligible for idle compaction while connected */
/**
 * Progress event for runtime readiness checks.
 * Used by Lattice workspaces to show "Starting Lattice workspace..." while ensureReady() blocks.
 * Not used by Docker (start is near-instant) or local runtimes.
 */
exports.RuntimeStatusEventSchema = zod_1.z.object({
    type: zod_1.z.literal("runtime-status"),
    workspaceId: zod_1.z.string(),
    phase: zod_1.z.enum(["checking", "starting", "waiting", "ready", "error"]),
    runtimeType: runtime_1.RuntimeModeSchema,
    detail: zod_1.z.string().optional(), // Human-readable status like "Starting Lattice workspace..."
});
exports.IdleCompactionNeededEventSchema = zod_1.z.object({
    type: zod_1.z.literal("idle-compaction-needed"),
});
exports.StreamErrorMessageSchema = zod_1.z.object({
    type: zod_1.z.literal("stream-error"),
    messageId: zod_1.z.string(),
    error: zod_1.z.string(),
    errorType: errors_1.StreamErrorTypeSchema,
});
exports.DeleteMessageSchema = zod_1.z.object({
    type: zod_1.z.literal("delete"),
    historySequences: zod_1.z.array(zod_1.z.number()),
});
exports.StreamStartEventSchema = zod_1.z.object({
    type: zod_1.z.literal("stream-start"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
    model: zod_1.z.string(),
    historySequence: zod_1.z.number().meta({
        description: "Backend assigns global message ordering",
    }),
    startTime: zod_1.z.number().meta({
        description: "Backend timestamp when stream started (Date.now())",
    }),
    mode: mode_1.AgentModeSchema.optional().catch(undefined).meta({
        description: "Legacy base mode (plan/exec/compact) derived from agent",
    }),
    agentId: agentDefinition_1.AgentIdSchema.optional().catch(undefined).meta({
        description: "Agent id for this stream",
    }),
});
exports.StreamDeltaEventSchema = zod_1.z.object({
    type: zod_1.z.literal("stream-delta"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
    delta: zod_1.z.string(),
    tokens: zod_1.z.number().meta({
        description: "Token count for this delta",
    }),
    timestamp: zod_1.z.number().meta({
        description: "When delta was received (Date.now())",
    }),
});
exports.CompletedMessagePartSchema = zod_1.z.discriminatedUnion("type", [
    message_1.UnixReasoningPartSchema,
    message_1.UnixTextPartSchema,
    message_1.UnixToolPartSchema,
]);
// Match LanguageModelV2Usage from @ai-sdk/provider exactly
// Note: inputTokens/outputTokens/totalTokens use `number | undefined` (required key, value can be undefined)
// while reasoningTokens/cachedInputTokens use `?: number | undefined` (optional key)
exports.LanguageModelV2UsageSchema = zod_1.z.object({
    inputTokens: zod_1.z
        .union([zod_1.z.number(), zod_1.z.undefined()])
        .meta({ description: "The number of input tokens used" }),
    outputTokens: zod_1.z
        .union([zod_1.z.number(), zod_1.z.undefined()])
        .meta({ description: "The number of output tokens used" }),
    totalTokens: zod_1.z.union([zod_1.z.number(), zod_1.z.undefined()]).meta({
        description: "Total tokens used - may differ from sum of inputTokens and outputTokens (e.g. reasoning tokens or overhead)",
    }),
    reasoningTokens: zod_1.z
        .number()
        .optional()
        .meta({ description: "The number of reasoning tokens used" }),
    cachedInputTokens: zod_1.z
        .number()
        .optional()
        .meta({ description: "The number of cached input tokens" }),
});
exports.StreamEndEventSchema = zod_1.z.object({
    type: zod_1.z.literal("stream-end"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    metadata: zod_1.z
        .object({
        model: zod_1.z.string(),
        // Total usage across all steps (for cost calculation)
        usage: exports.LanguageModelV2UsageSchema.optional(),
        // Last step's usage only (for context window display - inputTokens = current context size)
        contextUsage: exports.LanguageModelV2UsageSchema.optional(),
        // Aggregated provider metadata across all steps (for cost calculation)
        providerMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        // Last step's provider metadata (for context window cache display)
        contextProviderMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        duration: zod_1.z.number().optional(),
        systemMessageTokens: zod_1.z.number().optional(),
        historySequence: zod_1.z.number().optional().meta({
            description: "Present when loading from history",
        }),
        timestamp: zod_1.z.number().optional().meta({
            description: "Present when loading from history",
        }),
    })
        .meta({
        description: "Structured metadata from backend - directly mergeable with UnixMetadata",
    }),
    parts: zod_1.z.array(exports.CompletedMessagePartSchema).meta({
        description: "Parts array preserves temporal ordering of reasoning, text, and tool calls",
    }),
});
exports.StreamAbortReasonSchema = zod_1.z.enum(["user", "startup", "system"]);
exports.StreamAbortEventSchema = zod_1.z.object({
    type: zod_1.z.literal("stream-abort"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    abortReason: exports.StreamAbortReasonSchema.optional(),
    metadata: zod_1.z
        .object({
        // Total usage across all steps (for cost calculation)
        usage: exports.LanguageModelV2UsageSchema.optional(),
        // Last step's usage (for context window display - inputTokens = current context size)
        contextUsage: exports.LanguageModelV2UsageSchema.optional(),
        // Provider metadata for cost calculation (cache tokens, etc.)
        providerMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        // Last step's provider metadata (for context window cache display)
        contextProviderMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        duration: zod_1.z.number().optional(),
    })
        .optional()
        .meta({
        description: "Metadata may contain usage if abort occurred after stream completed processing",
    }),
    abandonPartial: zod_1.z.boolean().optional(),
});
exports.ToolCallStartEventSchema = zod_1.z.object({
    type: zod_1.z.literal("tool-call-start"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
    toolCallId: zod_1.z.string(),
    toolName: zod_1.z.string(),
    args: zod_1.z.unknown(),
    tokens: zod_1.z.number().meta({ description: "Token count for tool input" }),
    timestamp: zod_1.z.number().meta({ description: "When tool call started (Date.now())" }),
    parentToolCallId: zod_1.z.string().optional().meta({ description: "Set for nested PTC calls" }),
});
exports.ToolCallDeltaEventSchema = zod_1.z.object({
    type: zod_1.z.literal("tool-call-delta"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
    toolCallId: zod_1.z.string(),
    toolName: zod_1.z.string(),
    delta: zod_1.z.unknown(),
    tokens: zod_1.z.number().meta({ description: "Token count for this delta" }),
    timestamp: zod_1.z.number().meta({ description: "When delta was received (Date.now())" }),
});
/**
 * UI-only incremental output from the bash tool.
 *
 * This is intentionally NOT part of the tool result returned to the model.
 * It is streamed over workspace.onChat so users can "peek" while the tool is running.
 */
exports.BashOutputEventSchema = zod_1.z.object({
    type: zod_1.z.literal("bash-output"),
    workspaceId: zod_1.z.string(),
    toolCallId: zod_1.z.string(),
    phase: zod_1.z
        .enum(["output", "filtering"])
        .optional()
        .meta({ description: "UI hint for bash output state" }),
    text: zod_1.z.string(),
    isError: zod_1.z.boolean().meta({ description: "True if this chunk is from stderr" }),
    timestamp: zod_1.z.number().meta({ description: "When output was flushed (Date.now())" }),
});
exports.ToolCallEndEventSchema = zod_1.z.object({
    type: zod_1.z.literal("tool-call-end"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
    toolCallId: zod_1.z.string(),
    toolName: zod_1.z.string(),
    result: zod_1.z.unknown(),
    timestamp: zod_1.z.number().meta({ description: "When tool call completed (Date.now())" }),
    parentToolCallId: zod_1.z.string().optional().meta({ description: "Set for nested PTC calls" }),
});
exports.ReasoningDeltaEventSchema = zod_1.z.object({
    type: zod_1.z.literal("reasoning-delta"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
    delta: zod_1.z.string(),
    tokens: zod_1.z.number().meta({ description: "Token count for this delta" }),
    timestamp: zod_1.z.number().meta({ description: "When delta was received (Date.now())" }),
    signature: zod_1.z
        .string()
        .optional()
        .meta({ description: "Anthropic thinking block signature for replay" }),
});
exports.ReasoningEndEventSchema = zod_1.z.object({
    type: zod_1.z.literal("reasoning-end"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    replay: zod_1.z
        .boolean()
        .optional()
        .meta({ description: "True when this event is emitted during stream replay" }),
});
exports.ErrorEventSchema = zod_1.z.object({
    type: zod_1.z.literal("error"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    error: zod_1.z.string(),
    errorType: errors_1.StreamErrorTypeSchema.optional(),
});
/**
 * Emitted when a child workspace is deleted and its accumulated session usage has been
 * rolled up into the parent workspace.
 */
exports.SessionUsageDeltaEventSchema = zod_1.z.object({
    type: zod_1.z.literal("session-usage-delta"),
    workspaceId: zod_1.z.string().meta({ description: "Parent workspace ID" }),
    sourceWorkspaceId: zod_1.z.string().meta({ description: "Deleted child workspace ID" }),
    byModelDelta: zod_1.z.record(zod_1.z.string(), chatStats_1.ChatUsageDisplaySchema),
    timestamp: zod_1.z.number(),
});
exports.UsageDeltaEventSchema = zod_1.z.object({
    type: zod_1.z.literal("usage-delta"),
    workspaceId: zod_1.z.string(),
    messageId: zod_1.z.string(),
    // Step-level: this step only (for context window display)
    usage: exports.LanguageModelV2UsageSchema,
    providerMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    // Cumulative: sum across all steps (for live cost display)
    cumulativeUsage: exports.LanguageModelV2UsageSchema,
    cumulativeProviderMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// Individual init event schemas for flat discriminated union
exports.InitStartEventSchema = zod_1.z.object({
    type: zod_1.z.literal("init-start"),
    hookPath: zod_1.z.string(),
    timestamp: zod_1.z.number(),
});
exports.InitOutputEventSchema = zod_1.z.object({
    type: zod_1.z.literal("init-output"),
    line: zod_1.z.string(),
    timestamp: zod_1.z.number(),
    isError: zod_1.z.boolean().optional(),
});
exports.InitEndEventSchema = zod_1.z.object({
    type: zod_1.z.literal("init-end"),
    exitCode: zod_1.z.number(),
    timestamp: zod_1.z.number(),
    /** Number of lines dropped from middle when output exceeded limit (omitted if 0) */
    truncatedLines: zod_1.z.number().optional(),
});
// Composite schema for backwards compatibility
exports.WorkspaceInitEventSchema = zod_1.z.discriminatedUnion("type", [
    exports.InitStartEventSchema,
    exports.InitOutputEventSchema,
    exports.InitEndEventSchema,
]);
// Chat message wrapper with type discriminator for streaming events
// UnixMessageSchema is used for persisted data (chat.jsonl) which doesn't have a type field.
// This wrapper adds a type discriminator for real-time streaming events.
exports.ChatUnixMessageSchema = message_1.UnixMessageSchema.extend({
    type: zod_1.z.literal("message"),
});
// Review data schema for queued message display
exports.ReviewNoteDataSchema = zod_1.z.object({
    filePath: zod_1.z.string(),
    lineRange: zod_1.z.string(),
    selectedCode: zod_1.z.string(),
    selectedDiff: zod_1.z.string().optional(),
    oldStart: zod_1.z.number().optional(),
    newStart: zod_1.z.number().optional(),
    userNote: zod_1.z.string(),
});
exports.QueuedMessageChangedEventSchema = zod_1.z.object({
    type: zod_1.z.literal("queued-message-changed"),
    workspaceId: zod_1.z.string(),
    queuedMessages: zod_1.z.array(zod_1.z.string()),
    displayText: zod_1.z.string(),
    fileParts: zod_1.z.array(message_1.FilePartSchema).optional(),
    reviews: zod_1.z.array(exports.ReviewNoteDataSchema).optional(),
    /** True when the queued message is a compaction request (/compact) */
    hasCompactionRequest: zod_1.z.boolean().optional(),
});
exports.RestoreToInputEventSchema = zod_1.z.object({
    type: zod_1.z.literal("restore-to-input"),
    workspaceId: zod_1.z.string(),
    text: zod_1.z.string(),
    fileParts: zod_1.z.array(message_1.FilePartSchema).optional(),
});
// All streaming events now have a `type` field for O(1) discriminated union lookup.
// UnixMessages (user/assistant chat messages) are emitted with type: "message"
// when loading from history or sending new messages.
exports.WorkspaceChatMessageSchema = zod_1.z.discriminatedUnion("type", [
    // Stream lifecycle events
    exports.HeartbeatEventSchema,
    exports.CaughtUpMessageSchema,
    exports.StreamErrorMessageSchema,
    exports.DeleteMessageSchema,
    exports.StreamStartEventSchema,
    exports.StreamDeltaEventSchema,
    exports.StreamEndEventSchema,
    exports.StreamAbortEventSchema,
    // Tool events
    exports.ToolCallStartEventSchema,
    exports.ToolCallDeltaEventSchema,
    exports.ToolCallEndEventSchema,
    exports.BashOutputEventSchema,
    // Reasoning events
    exports.ReasoningDeltaEventSchema,
    exports.ReasoningEndEventSchema,
    // Error events
    exports.ErrorEventSchema,
    // Usage and queue events
    exports.UsageDeltaEventSchema,
    exports.SessionUsageDeltaEventSchema,
    exports.QueuedMessageChangedEventSchema,
    exports.RestoreToInputEventSchema,
    // Idle compaction notification
    exports.IdleCompactionNeededEventSchema,
    // Runtime status events
    exports.RuntimeStatusEventSchema,
    // Init events
    ...exports.WorkspaceInitEventSchema.def.options,
    // Chat messages with type discriminator
    exports.ChatUnixMessageSchema,
]);
// Update Status
exports.UpdateStatusSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({ type: zod_1.z.literal("idle") }),
    zod_1.z.object({ type: zod_1.z.literal("checking") }),
    zod_1.z.object({ type: zod_1.z.literal("available"), info: zod_1.z.object({ version: zod_1.z.string() }) }),
    zod_1.z.object({ type: zod_1.z.literal("up-to-date") }),
    zod_1.z.object({ type: zod_1.z.literal("downloading"), percent: zod_1.z.number() }),
    zod_1.z.object({ type: zod_1.z.literal("downloaded"), info: zod_1.z.object({ version: zod_1.z.string() }) }),
    zod_1.z.object({ type: zod_1.z.literal("error"), message: zod_1.z.string() }),
]);
// Tool policy schemas
exports.ToolPolicyFilterSchema = zod_1.z.object({
    regex_match: zod_1.z.string().meta({
        description: 'Regex pattern to match tool names (e.g., "bash", "file_edit_.*", ".*")',
    }),
    action: zod_1.z.enum(["enable", "disable", "require"]).meta({
        description: "Action to take when pattern matches",
    }),
});
exports.ToolPolicySchema = zod_1.z.array(exports.ToolPolicyFilterSchema).meta({
    description: "Tool policy - array of filters applied in order. Default behavior is allow all tools.",
});
// Experiments schema for feature gating
exports.ExperimentsSchema = zod_1.z.object({
    programmaticToolCalling: zod_1.z.boolean().optional(),
    programmaticToolCallingExclusive: zod_1.z.boolean().optional(),
    system1: zod_1.z.boolean().optional(),
});
// SendMessage options
exports.SendMessageOptionsSchema = zod_1.z.object({
    editMessageId: zod_1.z.string().optional(),
    thinkingLevel: zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]).optional(),
    model: zod_1.z.string("No model specified"),
    system1ThinkingLevel: zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]).optional(),
    system1Model: zod_1.z.string().optional(),
    toolPolicy: exports.ToolPolicySchema.optional(),
    additionalSystemInstructions: zod_1.z.string().optional(),
    maxOutputTokens: zod_1.z.number().optional(),
    agentId: agentDefinition_1.AgentIdSchema.meta({
        description: "Agent id for this request",
    }),
    mode: mode_1.AgentModeSchema.optional().catch(undefined).meta({
        description: "Legacy base mode (plan/exec/compact) for backend fallback",
    }),
    providerOptions: providerOptions_1.UnixProviderOptionsSchema.optional(),
    unixMetadata: zod_1.z.any().optional(), // Black box
    experiments: exports.ExperimentsSchema.optional(),
    /**
     * When true, workspace-specific agent definitions are disabled.
     * Only built-in and global agents are loaded. Useful for "unbricking" when
     * iterating on agent files - a broken agent in the worktree won't affect message sending.
     */
    disableWorkspaceAgents: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=stream.js.map