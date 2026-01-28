"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lattice = exports.LatticeWorkspaceSchema = exports.LatticeWorkspaceStatusSchema = exports.LatticePresetSchema = exports.LatticeTemplateSchema = exports.LatticeInfoSchema = exports.LatticeUnavailableReasonSchema = exports.LatticeWorkspaceConfigSchema = void 0;
const zod_1 = require("zod");
// Lattice workspace config - attached to SSH runtime when using Lattice
exports.LatticeWorkspaceConfigSchema = zod_1.z.object({
    /**
     * Lattice workspace name.
     * - For new workspaces: omit or undefined (backend derives from unix branch name)
     * - For existing workspaces: required (the selected Lattice workspace name)
     * - After creation: populated with the actual Lattice workspace name for reference
     */
    workspaceName: zod_1.z.string().optional().meta({ description: "Lattice workspace name" }),
    template: zod_1.z.string().optional().meta({ description: "Template used to create workspace" }),
    templateOrg: zod_1.z.string().optional().meta({
        description: "Template organization (for disambiguation when templates have same name)",
    }),
    preset: zod_1.z.string().optional().meta({ description: "Preset used during creation" }),
    /** True if connected to pre-existing Lattice workspace (vs unix creating one). */
    existingWorkspace: zod_1.z.boolean().optional().meta({
        description: "True if connected to pre-existing Lattice workspace",
    }),
});
// Lattice CLI unavailable reason - "missing" or error with message
exports.LatticeUnavailableReasonSchema = zod_1.z.union([
    zod_1.z.literal("missing"),
    zod_1.z.object({ kind: zod_1.z.literal("error"), message: zod_1.z.string() }),
]);
// Lattice CLI availability info - discriminated union by state
exports.LatticeInfoSchema = zod_1.z.discriminatedUnion("state", [
    zod_1.z.object({ state: zod_1.z.literal("available"), version: zod_1.z.string() }),
    zod_1.z.object({ state: zod_1.z.literal("outdated"), version: zod_1.z.string(), minVersion: zod_1.z.string() }),
    zod_1.z.object({ state: zod_1.z.literal("unavailable"), reason: exports.LatticeUnavailableReasonSchema }),
]);
// Lattice template
exports.LatticeTemplateSchema = zod_1.z.object({
    name: zod_1.z.string(),
    displayName: zod_1.z.string(),
    organizationName: zod_1.z.string(),
});
// Lattice preset for a template
exports.LatticePresetSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean(),
});
// Lattice workspace status
exports.LatticeWorkspaceStatusSchema = zod_1.z.enum([
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
// Lattice workspace
exports.LatticeWorkspaceSchema = zod_1.z.object({
    name: zod_1.z.string(),
    templateName: zod_1.z.string(),
    templateDisplayName: zod_1.z.string(),
    status: exports.LatticeWorkspaceStatusSchema,
});
// API schemas for lattice namespace
exports.lattice = {
    getInfo: {
        input: zod_1.z.void(),
        output: exports.LatticeInfoSchema,
    },
    listTemplates: {
        input: zod_1.z.void(),
        output: zod_1.z.array(exports.LatticeTemplateSchema),
    },
    listPresets: {
        input: zod_1.z.object({
            template: zod_1.z.string(),
            org: zod_1.z.string().optional().meta({ description: "Organization name for disambiguation" }),
        }),
        output: zod_1.z.array(exports.LatticePresetSchema),
    },
    listWorkspaces: {
        input: zod_1.z.void(),
        output: zod_1.z.array(exports.LatticeWorkspaceSchema),
    },
};
//# sourceMappingURL=lattice.js.map