"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPTestResultSchema = exports.MCPTestParamsSchema = exports.MCPSetToolAllowlistParamsSchema = exports.MCPSetEnabledParamsSchema = exports.MCPRemoveParamsSchema = exports.MCPAddParamsSchema = exports.MCPServerMapSchema = exports.MCPServerInfoSchema = exports.MCPHeadersSchema = exports.MCPHeaderValueSchema = exports.MCPTransportSchema = exports.WorkspaceMCPOverridesSchema = void 0;
const zod_1 = require("zod");
/**
 * Per-workspace MCP overrides.
 *
 * Stored per-workspace in <workspace>/.unix/mcp.local.jsonc (workspace-local, intended to be gitignored).
 * Allows workspaces to disable servers or restrict tool allowlists
 * without modifying the project-level .unix/mcp.jsonc.
 */
exports.WorkspaceMCPOverridesSchema = zod_1.z.object({
    /** Server names to explicitly disable for this workspace. */
    disabledServers: zod_1.z.array(zod_1.z.string()).optional(),
    /** Server names to explicitly enable for this workspace (overrides project-level disabled). */
    enabledServers: zod_1.z.array(zod_1.z.string()).optional(),
    /**
     * Per-server tool allowlist.
     * Key: server name (from .unix/mcp.jsonc)
     * Value: raw MCP tool names (NOT namespaced)
     *
     * If omitted for a server => expose all tools from that server.
     * If present but empty => expose no tools from that server.
     */
    toolAllowlist: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())).optional(),
});
exports.MCPTransportSchema = zod_1.z.enum(["stdio", "http", "sse", "auto"]);
exports.MCPHeaderValueSchema = zod_1.z.union([zod_1.z.string(), zod_1.z.object({ secret: zod_1.z.string() })]);
exports.MCPHeadersSchema = zod_1.z.record(zod_1.z.string(), exports.MCPHeaderValueSchema);
exports.MCPServerInfoSchema = zod_1.z.discriminatedUnion("transport", [
    zod_1.z.object({
        transport: zod_1.z.literal("stdio"),
        command: zod_1.z.string(),
        disabled: zod_1.z.boolean(),
        toolAllowlist: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    zod_1.z.object({
        transport: zod_1.z.literal("http"),
        url: zod_1.z.string(),
        headers: exports.MCPHeadersSchema.optional(),
        disabled: zod_1.z.boolean(),
        toolAllowlist: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    zod_1.z.object({
        transport: zod_1.z.literal("sse"),
        url: zod_1.z.string(),
        headers: exports.MCPHeadersSchema.optional(),
        disabled: zod_1.z.boolean(),
        toolAllowlist: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    zod_1.z.object({
        transport: zod_1.z.literal("auto"),
        url: zod_1.z.string(),
        headers: exports.MCPHeadersSchema.optional(),
        disabled: zod_1.z.boolean(),
        toolAllowlist: zod_1.z.array(zod_1.z.string()).optional(),
    }),
]);
exports.MCPServerMapSchema = zod_1.z.record(zod_1.z.string(), exports.MCPServerInfoSchema);
exports.MCPAddParamsSchema = zod_1.z
    .object({
    projectPath: zod_1.z.string(),
    name: zod_1.z.string(),
    // Backward-compatible: if transport omitted, interpret as stdio.
    transport: exports.MCPTransportSchema.optional(),
    command: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    headers: exports.MCPHeadersSchema.optional(),
})
    .superRefine((input, ctx) => {
    const transport = input.transport ?? "stdio";
    if (transport === "stdio") {
        if (!input.command?.trim()) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "command is required for stdio" });
        }
        return;
    }
    if (!input.url?.trim()) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "url is required for http/sse/auto" });
    }
});
exports.MCPRemoveParamsSchema = zod_1.z.object({
    projectPath: zod_1.z.string(),
    name: zod_1.z.string(),
});
exports.MCPSetEnabledParamsSchema = zod_1.z.object({
    projectPath: zod_1.z.string(),
    name: zod_1.z.string(),
    enabled: zod_1.z.boolean(),
});
exports.MCPSetToolAllowlistParamsSchema = zod_1.z.object({
    projectPath: zod_1.z.string(),
    name: zod_1.z.string(),
    /** Tool names to allow. Empty array = no tools allowed. */
    toolAllowlist: zod_1.z.array(zod_1.z.string()),
});
/**
 * Unified test params - provide either:
 * - name (to test a configured server), OR
 * - command (to test arbitrary stdio command), OR
 * - url+transport (to test arbitrary http/sse/auto endpoint)
 */
exports.MCPTestParamsSchema = zod_1.z
    .object({
    projectPath: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    transport: exports.MCPTransportSchema.optional(),
    command: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    headers: exports.MCPHeadersSchema.optional(),
})
    .superRefine((input, ctx) => {
    if (input.name?.trim()) {
        return;
    }
    if (input.command?.trim()) {
        return;
    }
    if (input.url?.trim()) {
        const transport = input.transport;
        if (transport !== "http" && transport !== "sse" && transport !== "auto") {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: "transport must be http|sse|auto when testing by url",
            });
        }
        return;
    }
    ctx.addIssue({
        code: zod_1.z.ZodIssueCode.custom,
        message: "Either name, command, or url is required",
    });
});
exports.MCPTestResultSchema = zod_1.z.discriminatedUnion("success", [
    zod_1.z.object({ success: zod_1.z.literal(true), tools: zod_1.z.array(zod_1.z.string()) }),
    zod_1.z.object({ success: zod_1.z.literal(false), error: zod_1.z.string() }),
]);
//# sourceMappingURL=mcp.js.map