"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitStatusSchema = exports.PostCompactionStateSchema = exports.WorkspaceActivitySnapshotSchema = exports.FrontendWorkspaceMetadataSchema = exports.WorkspaceMetadataSchema = void 0;
const zod_1 = require("zod");
const runtime_1 = require("./runtime");
const workspaceAiSettings_1 = require("./workspaceAiSettings");
const ThinkingLevelSchema = zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]);
exports.WorkspaceMetadataSchema = zod_1.z.object({
    id: zod_1.z.string().meta({
        description: "Stable unique identifier (10 hex chars for new workspaces, legacy format for old)",
    }),
    name: zod_1.z.string().meta({
        description: 'Git branch / directory name (e.g., "plan-a1b2") - used for path computation',
    }),
    title: zod_1.z.string().optional().meta({
        description: 'Human-readable workspace title (e.g., "Fix plan mode over SSH") - optional for legacy workspaces',
    }),
    projectName: zod_1.z
        .string()
        .meta({ description: "Project name extracted from project path (for display)" }),
    projectPath: zod_1.z
        .string()
        .meta({ description: "Absolute path to the project (needed to compute workspace path)" }),
    createdAt: zod_1.z.string().optional().meta({
        description: "ISO 8601 timestamp of when workspace was created (optional for backward compatibility)",
    }),
    aiSettingsByAgent: workspaceAiSettings_1.WorkspaceAISettingsByAgentSchema.optional().meta({
        description: "Per-agent AI settings persisted in config",
    }),
    runtimeConfig: runtime_1.RuntimeConfigSchema.meta({
        description: "Runtime configuration for this workspace (always set, defaults to local on load)",
    }),
    aiSettings: workspaceAiSettings_1.WorkspaceAISettingsSchema.optional().meta({
        description: "Workspace-scoped AI settings (model + thinking level) persisted in config",
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
    taskTrunkBranch: zod_1.z.string().optional().meta({
        description: "Trunk branch used to create/init this agent task workspace (used for restart-safe init on queued tasks).",
    }),
    status: zod_1.z.enum(["creating"]).optional().meta({
        description: "Workspace creation status. 'creating' = pending setup (ephemeral, not persisted). Absent = ready.",
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
exports.FrontendWorkspaceMetadataSchema = exports.WorkspaceMetadataSchema.extend({
    namedWorkspacePath: zod_1.z
        .string()
        .meta({ description: "Worktree path (uses workspace name as directory)" }),
    incompatibleRuntime: zod_1.z.string().optional().meta({
        description: "If set, this workspace has an incompatible runtime configuration (e.g., from a newer version of unix). The workspace should be displayed but interactions should show this error message.",
    }),
    isRemoving: zod_1.z.boolean().optional().meta({
        description: "True if this workspace is currently being deleted (deletion in progress).",
    }),
});
exports.WorkspaceActivitySnapshotSchema = zod_1.z.object({
    recency: zod_1.z.number().meta({ description: "Unix ms timestamp of last user interaction" }),
    streaming: zod_1.z.boolean().meta({ description: "Whether workspace currently has an active stream" }),
    lastModel: zod_1.z.string().nullable().meta({ description: "Last model sent from this workspace" }),
    lastThinkingLevel: ThinkingLevelSchema.nullable().meta({
        description: "Last thinking/reasoning level used in this workspace",
    }),
});
exports.PostCompactionStateSchema = zod_1.z.object({
    planPath: zod_1.z.string().nullable(),
    trackedFilePaths: zod_1.z.array(zod_1.z.string()),
    excludedItems: zod_1.z.array(zod_1.z.string()),
});
exports.GitStatusSchema = zod_1.z.object({
    /** Commit divergence relative to origin's primary branch */
    ahead: zod_1.z.number(),
    behind: zod_1.z.number(),
    dirty: zod_1.z
        .boolean()
        .meta({ description: "Whether there are uncommitted changes (staged or unstaged)" }),
    /**
     * Line deltas for changes unique to this workspace.
     * Computed vs the merge-base with origin's primary branch.
     *
     * Note: outgoing includes committed changes + uncommitted changes (working tree).
     */
    outgoingAdditions: zod_1.z.number(),
    outgoingDeletions: zod_1.z.number(),
    /** Line deltas for changes that exist on origin's primary branch but not locally */
    incomingAdditions: zod_1.z.number(),
    incomingDeletions: zod_1.z.number(),
});
//# sourceMappingURL=workspace.js.map