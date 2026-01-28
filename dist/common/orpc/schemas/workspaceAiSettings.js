"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceAISettingsByAgentSchema = exports.WorkspaceAISettingsSchema = void 0;
const zod_1 = require("zod");
/**
 * Workspace-scoped AI settings that should persist across devices.
 *
 * Notes:
 * - `model` must be canonical "provider:model" format.
 * - `thinkingLevel` is workspace-scoped (saved per workspace, not per-model).
 */
exports.WorkspaceAISettingsSchema = zod_1.z.object({
    model: zod_1.z.string().meta({ description: 'Canonical model id in the form "provider:model"' }),
    thinkingLevel: zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]).meta({
        description: "Thinking/reasoning effort level",
    }),
});
/**
 * Per-agent workspace AI overrides.
 *
 * Notes:
 * - Keys are agent IDs (plan/exec/custom), values are model + thinking overrides.
 */
exports.WorkspaceAISettingsByAgentSchema = zod_1.z.record(zod_1.z.string().min(1), exports.WorkspaceAISettingsSchema);
//# sourceMappingURL=workspaceAiSettings.js.map