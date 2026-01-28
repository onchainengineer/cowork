"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coder = exports.CoderWorkspaceSchema = exports.CoderWorkspaceStatusSchema = exports.CoderPresetSchema = exports.CoderTemplateSchema = exports.CoderInfoSchema = exports.CoderUnavailableReasonSchema = exports.CoderWorkspaceConfigSchema = void 0;
const zod_1 = require("zod");
// Coder workspace config - attached to SSH runtime when using Coder
exports.CoderWorkspaceConfigSchema = zod_1.z.object({
    /**
     * Coder workspace name.
     * - For new workspaces: omit or undefined (backend derives from unix branch name)
     * - For existing workspaces: required (the selected Coder workspace name)
     * - After creation: populated with the actual Coder workspace name for reference
     */
    workspaceName: zod_1.z.string().optional().meta({ description: "Coder workspace name" }),
    template: zod_1.z.string().optional().meta({ description: "Template used to create workspace" }),
    templateOrg: zod_1.z.string().optional().meta({
        description: "Template organization (for disambiguation when templates have same name)",
    }),
    preset: zod_1.z.string().optional().meta({ description: "Preset used during creation" }),
    /** True if connected to pre-existing Coder workspace (vs unix creating one). */
    existingWorkspace: zod_1.z.boolean().optional().meta({
        description: "True if connected to pre-existing Coder workspace",
    }),
});
// Coder CLI unavailable reason - "missing" or error with message
exports.CoderUnavailableReasonSchema = zod_1.z.union([
    zod_1.z.literal("missing"),
    zod_1.z.object({ kind: zod_1.z.literal("error"), message: zod_1.z.string() }),
]);
// Coder CLI availability info - discriminated union by state
exports.CoderInfoSchema = zod_1.z.discriminatedUnion("state", [
    zod_1.z.object({ state: zod_1.z.literal("available"), version: zod_1.z.string() }),
    zod_1.z.object({ state: zod_1.z.literal("outdated"), version: zod_1.z.string(), minVersion: zod_1.z.string() }),
    zod_1.z.object({ state: zod_1.z.literal("unavailable"), reason: exports.CoderUnavailableReasonSchema }),
]);
// Coder template
exports.CoderTemplateSchema = zod_1.z.object({
    name: zod_1.z.string(),
    displayName: zod_1.z.string(),
    organizationName: zod_1.z.string(),
});
// Coder preset for a template
exports.CoderPresetSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean(),
});
// Coder workspace status
exports.CoderWorkspaceStatusSchema = zod_1.z.enum([
    "running",
    "stopped",
    "starting",
    "stopping",
    "failed",
    "pending",
    "canceling",
    "canceled",
    "deleting",
    "deleted",
]);
// Coder workspace
exports.CoderWorkspaceSchema = zod_1.z.object({
    name: zod_1.z.string(),
    templateName: zod_1.z.string(),
    templateDisplayName: zod_1.z.string(),
    status: exports.CoderWorkspaceStatusSchema,
});
// API schemas for coder namespace
exports.coder = {
    getInfo: {
        input: zod_1.z.void(),
        output: exports.CoderInfoSchema,
    },
    listTemplates: {
        input: zod_1.z.void(),
        output: zod_1.z.array(exports.CoderTemplateSchema),
    },
    listPresets: {
        input: zod_1.z.object({
            template: zod_1.z.string(),
            org: zod_1.z.string().optional().meta({ description: "Organization name for disambiguation" }),
        }),
        output: zod_1.z.array(exports.CoderPresetSchema),
    },
    listWorkspaces: {
        input: zod_1.z.void(),
        output: zod_1.z.array(exports.CoderWorkspaceSchema),
    },
};
//# sourceMappingURL=coder.js.map