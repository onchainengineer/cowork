"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentDefinitionPackageSchema = exports.AgentDefinitionDescriptorSchema = exports.AgentDefinitionFrontmatterSchema = exports.AgentIdSchema = exports.AgentDefinitionScopeSchema = void 0;
const zod_1 = require("zod");
exports.AgentDefinitionScopeSchema = zod_1.z.enum(["built-in", "project", "global"]);
// Agent IDs come from filenames (<agentId>.md).
// Keep constraints conservative so IDs are safe to use in storage keys, URLs, etc.
exports.AgentIdSchema = zod_1.z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?$/);
const ThinkingLevelSchema = zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]);
const AgentDefinitionUiSchema = zod_1.z
    .object({
    // New: hidden is opt-out. Default: visible.
    hidden: zod_1.z.boolean().optional(),
    // Legacy: selectable was opt-in. Keep for backwards compatibility.
    selectable: zod_1.z.boolean().optional(),
    // When true, completely hides this agent (useful for disabling built-ins)
    disabled: zod_1.z.boolean().optional(),
    // UI color (CSS color value). Inherited from base agent if not specified.
    color: zod_1.z.string().min(1).optional(),
})
    .strip();
const AgentDefinitionSubagentSchema = zod_1.z
    .object({
    runnable: zod_1.z.boolean().optional(),
    // Instructions appended when this agent runs as a subagent (child workspace)
    append_prompt: zod_1.z.string().min(1).optional(),
    // When true, do not run the project's .unix/init hook for this sub-agent.
    // NOTE: This skips only the hook execution, not runtime provisioning (e.g. SSH sync, Docker setup).
    skip_init_hook: zod_1.z.boolean().optional(),
})
    .strip();
const AgentDefinitionAiDefaultsSchema = zod_1.z
    .object({
    // Model identifier: full string (e.g. "anthropic:claude-sonnet-4-5") or abbreviation (e.g. "sonnet")
    model: zod_1.z.string().min(1).optional(),
    thinkingLevel: ThinkingLevelSchema.optional(),
})
    .strip();
const AgentDefinitionPromptSchema = zod_1.z
    .object({
    // When true, append this agent's body to the base agent's body (default: false = replace)
    append: zod_1.z.boolean().optional(),
})
    .strip();
// Tool configuration: add/remove patterns (regex).
// Layers are processed in order during inheritance (base first, then child).
const AgentDefinitionToolsSchema = zod_1.z
    .object({
    // Patterns to add (enable). Processed before remove.
    add: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    // Patterns to remove (disable). Processed after add.
    remove: zod_1.z.array(zod_1.z.string().min(1)).optional(),
})
    .strip();
exports.AgentDefinitionFrontmatterSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(128),
    description: zod_1.z.string().min(1).max(1024).optional(),
    // Inheritance: reference a built-in or custom agent ID
    base: exports.AgentIdSchema.optional(),
    // UI metadata (color, visibility, etc.)
    ui: AgentDefinitionUiSchema.optional(),
    // Prompt behavior configuration
    prompt: AgentDefinitionPromptSchema.optional(),
    subagent: AgentDefinitionSubagentSchema.optional(),
    ai: AgentDefinitionAiDefaultsSchema.optional(),
    // Tool configuration: add/remove patterns (regex).
    // If omitted and no base, no tools are available.
    tools: AgentDefinitionToolsSchema.optional(),
})
    .strip();
exports.AgentDefinitionDescriptorSchema = zod_1.z
    .object({
    id: exports.AgentIdSchema,
    scope: exports.AgentDefinitionScopeSchema,
    name: zod_1.z.string().min(1).max(128),
    description: zod_1.z.string().min(1).max(1024).optional(),
    uiSelectable: zod_1.z.boolean(),
    uiColor: zod_1.z.string().min(1).optional(),
    subagentRunnable: zod_1.z.boolean(),
    // Base agent ID for inheritance (e.g., "exec", "plan", or custom agent)
    base: exports.AgentIdSchema.optional(),
    aiDefaults: AgentDefinitionAiDefaultsSchema.optional(),
    // Tool configuration (for UI display / inheritance computation)
    tools: AgentDefinitionToolsSchema.optional(),
})
    .strict();
exports.AgentDefinitionPackageSchema = zod_1.z
    .object({
    id: exports.AgentIdSchema,
    scope: exports.AgentDefinitionScopeSchema,
    frontmatter: exports.AgentDefinitionFrontmatterSchema,
    body: zod_1.z.string(),
})
    .strict();
//# sourceMappingURL=agentDefinition.js.map