"use strict";
/**
 * Telemetry ORPC schemas
 *
 * Defines input/output schemas for backend telemetry endpoints.
 * Telemetry is controlled by UNIX_DISABLE_TELEMETRY env var on the backend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetry = exports.TelemetryEventSchema = void 0;
const zod_1 = require("zod");
const runtime_1 = require("./runtime");
// Error context enum (matches payload.ts)
const ErrorContextSchema = zod_1.z.enum([
    "workspace-creation",
    "workspace-deletion",
    "workspace-switch",
    "message-send",
    "message-stream",
    "project-add",
    "project-remove",
    "git-operation",
]);
// Runtime type - derived from RuntimeModeSchema to stay in sync
const TelemetryRuntimeTypeSchema = runtime_1.RuntimeModeSchema;
// Frontend platform info (matches payload.ts FrontendPlatformInfo)
const FrontendPlatformInfoSchema = zod_1.z.object({
    userAgent: zod_1.z.string(),
    platform: zod_1.z.string(),
});
// Thinking level enum (matches payload.ts TelemetryThinkingLevel)
const TelemetryThinkingLevelSchema = zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]);
// Command type enum (matches payload.ts TelemetryCommandType)
const TelemetryCommandTypeSchema = zod_1.z.enum([
    "clear",
    "compact",
    "new",
    "fork",
    "vim",
    "model",
    "mode",
    "plan",
    "providers",
]);
// Individual event payload schemas
const AppStartedPropertiesSchema = zod_1.z.object({
    isFirstLaunch: zod_1.z.boolean(),
    vimModeEnabled: zod_1.z.boolean(),
});
const WorkspaceCreatedPropertiesSchema = zod_1.z.object({
    workspaceId: zod_1.z.string(),
    runtimeType: TelemetryRuntimeTypeSchema,
    frontendPlatform: FrontendPlatformInfoSchema,
});
const WorkspaceSwitchedPropertiesSchema = zod_1.z.object({
    fromWorkspaceId: zod_1.z.string(),
    toWorkspaceId: zod_1.z.string(),
});
const MessageSentPropertiesSchema = zod_1.z.object({
    workspaceId: zod_1.z.string(),
    model: zod_1.z.string(),
    agentId: zod_1.z.string().min(1).optional().catch(undefined),
    message_length_b2: zod_1.z.number(),
    runtimeType: TelemetryRuntimeTypeSchema,
    frontendPlatform: FrontendPlatformInfoSchema,
    thinkingLevel: TelemetryThinkingLevelSchema,
});
// MCP transport mode enum (matches payload.ts TelemetryMCPTransportMode)
const TelemetryMCPTransportModeSchema = zod_1.z.enum([
    "none",
    "stdio_only",
    "http_only",
    "sse_only",
    "mixed",
]);
const MCPContextInjectedPropertiesSchema = zod_1.z.object({
    workspaceId: zod_1.z.string(),
    model: zod_1.z.string(),
    agentId: zod_1.z.string().min(1).optional().catch(undefined),
    runtimeType: TelemetryRuntimeTypeSchema,
    mcp_server_enabled_count: zod_1.z.number(),
    mcp_server_started_count: zod_1.z.number(),
    mcp_server_failed_count: zod_1.z.number(),
    mcp_tool_count: zod_1.z.number(),
    total_tool_count: zod_1.z.number(),
    builtin_tool_count: zod_1.z.number(),
    mcp_transport_mode: TelemetryMCPTransportModeSchema,
    mcp_has_http: zod_1.z.boolean(),
    mcp_has_sse: zod_1.z.boolean(),
    mcp_has_stdio: zod_1.z.boolean(),
    mcp_auto_fallback_count: zod_1.z.number(),
    mcp_setup_duration_ms_b2: zod_1.z.number(),
});
const TelemetryMCPServerTransportSchema = zod_1.z.enum(["stdio", "http", "sse", "auto"]);
const TelemetryMCPTestErrorCategorySchema = zod_1.z.enum([
    "timeout",
    "connect",
    "http_status",
    "unknown",
]);
const MCPServerTestedPropertiesSchema = zod_1.z.object({
    transport: TelemetryMCPServerTransportSchema,
    success: zod_1.z.boolean(),
    duration_ms_b2: zod_1.z.number(),
    error_category: TelemetryMCPTestErrorCategorySchema.optional(),
});
const TelemetryMCPServerConfigActionSchema = zod_1.z.enum([
    "add",
    "edit",
    "remove",
    "enable",
    "disable",
    "set_tool_allowlist",
    "set_headers",
]);
const StatsTabOpenedPropertiesSchema = zod_1.z.object({
    viewMode: zod_1.z.enum(["session", "last-request"]),
    showModeBreakdown: zod_1.z.boolean(),
});
const StreamTimingComputedPropertiesSchema = zod_1.z.object({
    model: zod_1.z.string(),
    agentId: zod_1.z.string().min(1).optional().catch(undefined),
    duration_b2: zod_1.z.number(),
    ttft_ms_b2: zod_1.z.number(),
    tool_ms_b2: zod_1.z.number(),
    streaming_ms_b2: zod_1.z.number(),
    tool_percent_bucket: zod_1.z.number(),
    invalid: zod_1.z.boolean(),
});
const StreamTimingInvalidPropertiesSchema = zod_1.z.object({
    reason: zod_1.z.string(),
});
const MCPServerConfigChangedPropertiesSchema = zod_1.z.object({
    action: TelemetryMCPServerConfigActionSchema,
    transport: TelemetryMCPServerTransportSchema,
    has_headers: zod_1.z.boolean(),
    uses_secret_headers: zod_1.z.boolean(),
    tool_allowlist_size_b2: zod_1.z.number().optional(),
});
const StreamCompletedPropertiesSchema = zod_1.z.object({
    model: zod_1.z.string(),
    wasInterrupted: zod_1.z.boolean(),
    duration_b2: zod_1.z.number(),
    output_tokens_b2: zod_1.z.number(),
});
const CompactionCompletedPropertiesSchema = zod_1.z.object({
    model: zod_1.z.string(),
    duration_b2: zod_1.z.number(),
    input_tokens_b2: zod_1.z.number(),
    output_tokens_b2: zod_1.z.number(),
    compaction_source: zod_1.z.enum(["manual", "idle"]),
});
const ProviderConfiguredPropertiesSchema = zod_1.z.object({
    provider: zod_1.z.string(),
    keyType: zod_1.z.string(),
});
const CommandUsedPropertiesSchema = zod_1.z.object({
    command: TelemetryCommandTypeSchema,
});
const VoiceTranscriptionPropertiesSchema = zod_1.z.object({
    audio_duration_b2: zod_1.z.number(),
    success: zod_1.z.boolean(),
});
const ErrorOccurredPropertiesSchema = zod_1.z.object({
    errorType: zod_1.z.string(),
    context: ErrorContextSchema,
});
const ExperimentOverriddenPropertiesSchema = zod_1.z.object({
    experimentId: zod_1.z.string(),
    assignedVariant: zod_1.z.union([zod_1.z.string(), zod_1.z.boolean(), zod_1.z.null()]),
    userChoice: zod_1.z.boolean(),
});
// Union of all telemetry events
exports.TelemetryEventSchema = zod_1.z.discriminatedUnion("event", [
    zod_1.z.object({
        event: zod_1.z.literal("app_started"),
        properties: AppStartedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("workspace_created"),
        properties: WorkspaceCreatedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("workspace_switched"),
        properties: WorkspaceSwitchedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("mcp_context_injected"),
        properties: MCPContextInjectedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("mcp_server_tested"),
        properties: MCPServerTestedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("stats_tab_opened"),
        properties: StatsTabOpenedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("stream_timing_computed"),
        properties: StreamTimingComputedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("stream_timing_invalid"),
        properties: StreamTimingInvalidPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("mcp_server_config_changed"),
        properties: MCPServerConfigChangedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("message_sent"),
        properties: MessageSentPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("stream_completed"),
        properties: StreamCompletedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("compaction_completed"),
        properties: CompactionCompletedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("provider_configured"),
        properties: ProviderConfiguredPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("command_used"),
        properties: CommandUsedPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("voice_transcription"),
        properties: VoiceTranscriptionPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("error_occurred"),
        properties: ErrorOccurredPropertiesSchema,
    }),
    zod_1.z.object({
        event: zod_1.z.literal("experiment_overridden"),
        properties: ExperimentOverriddenPropertiesSchema,
    }),
]);
// API schemas - only track endpoint, enabled state controlled by env var
exports.telemetry = {
    track: {
        input: exports.TelemetryEventSchema,
        output: zod_1.z.void(),
    },
    status: {
        input: zod_1.z.void(),
        output: zod_1.z.object({
            /** True if telemetry is actively running (false in dev mode) */
            enabled: zod_1.z.boolean(),
            /** True only if user explicitly set UNIX_DISABLE_TELEMETRY=1 */
            explicit: zod_1.z.boolean(),
        }),
    },
};
//# sourceMappingURL=telemetry.js.map