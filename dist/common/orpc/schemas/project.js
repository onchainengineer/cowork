"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectConfigSchema = exports.WorkspaceConfigSchema = exports.SectionConfigSchema = void 0;
const zod_1 = require("zod");
const runtime_1 = require("./runtime");
const mcp_1 = require("./mcp");
const workspaceAiSettings_1 = require("./workspaceAiSettings");
const ThinkingLevelSchema = zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]);
/**
 * Section schema for organizing workspaces within a project.
 * Sections are project-scoped and persist to config.json.
 */
exports.SectionConfigSchema = zod_1.z.object({
    id: zod_1.z.string().meta({
        description: "Unique section ID (8 hex chars)",
    }),
    name: zod_1.z.string().meta({
        description: "Display name for the section",
    }),
    color: zod_1.z.string().optional().meta({
        description: "Accent color (hex value like #ff6b6b or preset name)",
    }),
    nextId: zod_1.z.string().nullable().optional().meta({
        description: "ID of the next section in display order (null = last, undefined treated as null)",
    }),
});
exports.WorkspaceConfigSchema = zod_1.z.object({
    path: zod_1.z.string().meta({
        description: "Absolute path to workspace directory - REQUIRED for backward compatibility",
    }),
    id: zod_1.z.string().optional().meta({
        description: "Stable workspace ID (10 hex chars for new workspaces) - optional for legacy",
    }),
    name: zod_1.z.string().optional().meta({
        description: 'Git branch / directory name (e.g., "plan-a1b2") - optional for legacy',
    }),
    title: zod_1.z.string().optional().meta({
        description: 'Human-readable workspace title (e.g., "Fix plan mode over SSH") - optional for legacy',
    }),
    createdAt: zod_1.z
        .string()
        .optional()
        .meta({ description: "ISO 8601 creation timestamp - optional for legacy" }),
    aiSettingsByAgent: workspaceAiSettings_1.WorkspaceAISettingsByAgentSchema.optional().meta({
        description: "Per-agent workspace-scoped AI settings",
    }),
    runtimeConfig: runtime_1.RuntimeConfigSchema.optional().meta({
        description: "Runtime configuration (local vs SSH) - optional, defaults to local",
    }),
    aiSettings: workspaceAiSettings_1.WorkspaceAISettingsSchema.optional().meta({
        description: "Workspace-scoped AI settings (model + thinking level)",
    }),
    parentWorkspaceId: zod_1.z.string().optional().meta({
        description: "If set, this workspace is a child workspace spawned from the parent workspaceId (enables nesting in UI and backend orchestration).",
    }),
    agentType: zod_1.z.string().optional().meta({
        description: 'If set, selects an agent preset for this workspace (e.g., "explore" or "exec").',
    }),
    agentId: zod_1.z.string().optional().meta({
        description: 'If set, selects an agent definition for this workspace (e.g., "explore" or "exec").',
    }),
    taskStatus: zod_1.z.enum(["queued", "running", "awaiting_report", "reported"]).optional().meta({
        description: "Agent task lifecycle status for child workspaces (queued|running|awaiting_report|reported).",
    }),
    reportedAt: zod_1.z.string().optional().meta({
        description: "ISO 8601 timestamp for when an agent task reported completion (optional).",
    }),
    taskModelString: zod_1.z.string().optional().meta({
        description: "Model string used to run this agent task (used for restart-safe resumptions).",
    }),
    taskThinkingLevel: ThinkingLevelSchema.optional().meta({
        description: "Thinking level used for this agent task (used for restart-safe resumptions).",
    }),
    taskPrompt: zod_1.z.string().optional().meta({
        description: "Initial prompt for a queued agent task (persisted only until the task actually starts).",
    }),
    taskExperiments: zod_1.z
        .object({
        programmaticToolCalling: zod_1.z.boolean().optional(),
        programmaticToolCallingExclusive: zod_1.z.boolean().optional(),
    })
        .optional()
        .meta({
        description: "PTC experiments inherited from parent for restart-safe resumptions.",
    }),
    taskTrunkBranch: zod_1.z.string().optional().meta({
        description: "Trunk branch used to create/init this agent task workspace (used for restart-safe init on queued tasks).",
    }),
    mcp: mcp_1.WorkspaceMCPOverridesSchema.optional().meta({
        description: "LEGACY: Per-workspace MCP overrides (migrated to <workspace>/.unix/mcp.local.jsonc)",
    }),
    archivedAt: zod_1.z.string().optional().meta({
        description: "ISO 8601 timestamp when workspace was last archived. Workspace is considered archived if archivedAt > unarchivedAt (or unarchivedAt is absent).",
    }),
    unarchivedAt: zod_1.z.string().optional().meta({
        description: "ISO 8601 timestamp when workspace was last unarchived. Used for recency calculation to bump restored workspaces to top.",
    }),
    sectionId: zod_1.z.string().optional().meta({
        description: "ID of the section this workspace belongs to (optional, unsectioned if absent)",
    }),
});
exports.ProjectConfigSchema = zod_1.z.object({
    workspaces: zod_1.z.array(exports.WorkspaceConfigSchema),
    sections: zod_1.z.array(exports.SectionConfigSchema).optional().meta({
        description: "Sections for organizing workspaces within this project",
    }),
    idleCompactionHours: zod_1.z.number().min(1).nullable().optional().meta({
        description: "Hours of inactivity before auto-compacting workspaces. null/undefined = disabled.",
    }),
});
//# sourceMappingURL=project.js.map