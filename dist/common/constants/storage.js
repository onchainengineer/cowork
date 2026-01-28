"use strict";
/**
 * LocalStorage Key Constants and Helpers
 * These keys are used for persisting state in localStorage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIGHT_SIDEBAR_WIDTH_KEY = exports.RIGHT_SIDEBAR_COLLAPSED_KEY = exports.RIGHT_SIDEBAR_TAB_KEY = exports.REVIEW_SORT_ORDER_KEY = exports.DEFAULT_TUTORIAL_STATE = exports.TUTORIAL_STATE_KEY = exports.DEFAULT_TERMINAL_FONT_CONFIG = exports.TERMINAL_FONT_CONFIG_KEY = exports.DEFAULT_EDITOR_CONFIG = exports.EDITOR_CONFIG_KEY = exports.GIT_STATUS_INDICATOR_MODE_KEY = exports.SHARE_SIGNING_KEY = exports.SHARE_EXPIRATION_KEY = exports.VIM_ENABLED_KEY = exports.AGENT_AI_DEFAULTS_KEY = exports.PREFERRED_SYSTEM_1_THINKING_LEVEL_KEY = exports.PREFERRED_SYSTEM_1_MODEL_KEY = exports.PREFERRED_COMPACTION_MODEL_KEY = exports.EXPANDED_PROJECTS_KEY = exports.SELECTED_WORKSPACE_KEY = exports.LAST_CUSTOM_MODEL_PROVIDER_KEY = exports.UI_THEME_KEY = exports.GLOBAL_SCOPE_ID = void 0;
exports.getProjectScopeId = getProjectScopeId;
exports.getPendingScopeId = getPendingScopeId;
exports.getMCPTestResultsKey = getMCPTestResultsKey;
exports.getThinkingLevelKey = getThinkingLevelKey;
exports.getWorkspaceAISettingsByAgentKey = getWorkspaceAISettingsByAgentKey;
exports.getThinkingLevelByModelKey = getThinkingLevelByModelKey;
exports.getModelKey = getModelKey;
exports.getInputKey = getInputKey;
exports.getInputAttachmentsKey = getInputAttachmentsKey;
exports.getPendingWorkspaceSendErrorKey = getPendingWorkspaceSendErrorKey;
exports.getAutoRetryKey = getAutoRetryKey;
exports.getRetryStateKey = getRetryStateKey;
exports.getCancelledCompactionKey = getCancelledCompactionKey;
exports.getAgentIdKey = getAgentIdKey;
exports.getPinnedAgentIdKey = getPinnedAgentIdKey;
exports.getDisableWorkspaceAgentsKey = getDisableWorkspaceAgentsKey;
exports.getRuntimeKey = getRuntimeKey;
exports.getTrunkBranchKey = getTrunkBranchKey;
exports.getAgentsInitNudgeKey = getAgentsInitNudgeKey;
exports.getLastRuntimeConfigKey = getLastRuntimeConfigKey;
exports.getReviewStateKey = getReviewStateKey;
exports.getHunkFirstSeenKey = getHunkFirstSeenKey;
exports.getReviewExpandStateKey = getReviewExpandStateKey;
exports.getReviewReadMoreKey = getReviewReadMoreKey;
exports.getFileTreeExpandStateKey = getFileTreeExpandStateKey;
exports.getNotifyOnResponseKey = getNotifyOnResponseKey;
exports.getNotifyOnResponseAutoEnableKey = getNotifyOnResponseAutoEnableKey;
exports.getStatusStateKey = getStatusStateKey;
exports.getSessionTimingKey = getSessionTimingKey;
exports.getWorkspaceLastReadKey = getWorkspaceLastReadKey;
exports.getRightSidebarLayoutKey = getRightSidebarLayoutKey;
exports.getTerminalTitlesKey = getTerminalTitlesKey;
exports.getReviewSearchStateKey = getReviewSearchStateKey;
exports.getReviewsKey = getReviewsKey;
exports.getAutoCompactionEnabledKey = getAutoCompactionEnabledKey;
exports.getAutoCompactionThresholdKey = getAutoCompactionThresholdKey;
exports.getPlanContentKey = getPlanContentKey;
exports.getPostCompactionStateKey = getPostCompactionStateKey;
exports.copyWorkspaceStorage = copyWorkspaceStorage;
exports.deleteWorkspaceStorage = deleteWorkspaceStorage;
exports.migrateWorkspaceStorage = migrateWorkspaceStorage;
/**
 * Scope ID Helpers
 * These create consistent scope identifiers for storage keys
 */
/**
 * Get project-scoped ID for storage keys (e.g., model preference before workspace creation)
 * Format: "__project__/{projectPath}"
 * Uses "/" delimiter to safely handle projectPath values containing special characters
 */
function getProjectScopeId(projectPath) {
    return `__project__/${projectPath}`;
}
/**
 * Get pending workspace scope ID for storage keys (e.g., input text during workspace creation)
 * Format: "__pending__{projectPath}"
 */
function getPendingScopeId(projectPath) {
    return `__pending__${projectPath}`;
}
/**
 * Global scope ID for workspace-independent preferences
 */
exports.GLOBAL_SCOPE_ID = "__global__";
/**
 * Get the localStorage key for the UI theme preference (global)
 * Format: "uiTheme"
 */
exports.UI_THEME_KEY = "uiTheme";
/**
 * Get the localStorage key for the last selected provider when adding custom models (global)
 * Format: "lastCustomModelProvider"
 */
exports.LAST_CUSTOM_MODEL_PROVIDER_KEY = "lastCustomModelProvider";
/**
 * Get the localStorage key for the currently selected workspace (global)
 * Format: "selectedWorkspace"
 */
exports.SELECTED_WORKSPACE_KEY = "selectedWorkspace";
/**
 * Get the localStorage key for expanded projects in sidebar (global)
 * Format: "expandedProjects"
 */
exports.EXPANDED_PROJECTS_KEY = "expandedProjects";
/**
 * Get the localStorage key for cached MCP server test results (per project)
 * Format: "mcpTestResults:{projectPath}"
 * Stores: Record<serverName, CachedMCPTestResult>
 */
function getMCPTestResultsKey(projectPath) {
    return `mcpTestResults:${projectPath}`;
}
/**
 * Get the localStorage key for thinking level preference per scope (workspace/project).
 * Format: "thinkingLevel:{scopeId}"
 */
function getThinkingLevelKey(scopeId) {
    return `thinkingLevel:${scopeId}`;
}
/**
 * Get the localStorage key for per-agent workspace AI overrides cache.
 * Format: "workspaceAiSettingsByAgent:{workspaceId}"
 */
function getWorkspaceAISettingsByAgentKey(workspaceId) {
    return `workspaceAiSettingsByAgent:${workspaceId}`;
}
/**
 * LEGACY: Get the localStorage key for thinking level preference per model (global).
 * Format: "thinkingLevel:model:{modelName}"
 *
 * Kept for one-time migration to per-workspace thinking.
 */
function getThinkingLevelByModelKey(modelName) {
    return `thinkingLevel:model:${modelName}`;
}
/**
 * Get the localStorage key for the user's preferred model for a workspace
 */
function getModelKey(workspaceId) {
    return `model:${workspaceId}`;
}
/**
 * Get the localStorage key for the input text for a workspace
 */
function getInputKey(workspaceId) {
    return `input:${workspaceId}`;
}
/**
 * Get the localStorage key for the input attachments for a scope.
 * Format: "inputAttachments:{scopeId}"
 *
 * Note: The input key functions accept any string scope ID. For normal workspaces
 * this is the workspaceId; for creation mode it's a pending scope ID.
 */
function getInputAttachmentsKey(scopeId) {
    return `inputAttachments:${scopeId}`;
}
/**
 * Get the localStorage key for pending initial send errors after workspace creation.
 * Stored so the workspace view can surface a toast after navigation.
 * Format: "pendingSendError:{workspaceId}"
 */
function getPendingWorkspaceSendErrorKey(workspaceId) {
    return `pendingSendError:${workspaceId}`;
}
/**
 * Get the localStorage key for auto-retry preference for a workspace
 */
function getAutoRetryKey(workspaceId) {
    return `${workspaceId}-autoRetry`;
}
/**
 * Get the localStorage key for retry state for a workspace
 * Stores: { attempt, totalRetryTime, retryStartTime }
 */
function getRetryStateKey(workspaceId) {
    return `${workspaceId}-retryState`;
}
/**
 * Get storage key for cancelled compaction tracking.
 * Stores compaction-request user message ID to verify freshness across reloads.
 */
function getCancelledCompactionKey(workspaceId) {
    return `workspace:${workspaceId}:cancelled-compaction`;
}
/**
 * Get the localStorage key for the selected agent definition id for a scope.
 * Format: "agentId:{scopeId}"
 */
function getAgentIdKey(scopeId) {
    return `agentId:${scopeId}`;
}
/**
 * Get the localStorage key for the pinned third agent id for a scope.
 * Format: "pinnedAgentId:{scopeId}"
 */
function getPinnedAgentIdKey(scopeId) {
    return `pinnedAgentId:${scopeId}`;
}
/**
 * Get the localStorage key for "disable workspace agents" toggle per scope.
 * When true, workspace-specific agents are disabled - only built-in and global agents are loaded.
 * Useful for "unbricking" when iterating on agent files in a workspace worktree.
 * Format: "disableWorkspaceAgents:{scopeId}"
 */
function getDisableWorkspaceAgentsKey(scopeId) {
    return `disableWorkspaceAgents:${scopeId}`;
}
/**
 * Get the localStorage key for the default runtime for a project
 * Defaults to worktree if not set; can only be changed via the "Default for project" checkbox.
 * Format: "runtime:{projectPath}"
 */
function getRuntimeKey(projectPath) {
    return `runtime:${projectPath}`;
}
/**
 * Get the localStorage key for trunk branch preference for a project
 * Stores the last used trunk branch when creating a workspace
 * Format: "trunkBranch:{projectPath}"
 */
function getTrunkBranchKey(projectPath) {
    return `trunkBranch:${projectPath}`;
}
/**
 * Get the localStorage key for whether to show the "Initialize with AGENTS.md" nudge for a project.
 * Set to true when a project is first added; cleared when user dismisses or runs /init.
 * Format: "agentsInitNudge:{projectPath}"
 */
function getAgentsInitNudgeKey(projectPath) {
    return `agentsInitNudge:${projectPath}`;
}
/**
 * Get the localStorage key for the last runtime config used per provider for a project.
 *
 * Value shape is a provider-keyed object (e.g. { ssh: { host }, docker: { image } }) so we can
 * add new options without adding more storage keys.
 *
 * Format: "lastRuntimeConfig:{projectPath}"
 */
function getLastRuntimeConfigKey(projectPath) {
    return `lastRuntimeConfig:${projectPath}`;
}
/**
 * Get the localStorage key for the preferred compaction model (global)
 * Format: "preferredCompactionModel"
 */
exports.PREFERRED_COMPACTION_MODEL_KEY = "preferredCompactionModel";
/**
 * Get the localStorage key for the preferred System 1 model (global)
 * Format: "preferredSystem1Model"
 */
exports.PREFERRED_SYSTEM_1_MODEL_KEY = "preferredSystem1Model";
/**
 * Get the localStorage key for the preferred System 1 thinking level (global)
 * Format: "preferredSystem1ThinkingLevel"
 */
exports.PREFERRED_SYSTEM_1_THINKING_LEVEL_KEY = "preferredSystem1ThinkingLevel";
/**
 * Get the localStorage key for cached per-agent AI defaults (global).
 * Format: "agentAiDefaults"
 */
exports.AGENT_AI_DEFAULTS_KEY = "agentAiDefaults";
/**
 * Get the localStorage key for vim mode preference (global)
 * Format: "vimEnabled"
 */
exports.VIM_ENABLED_KEY = "vimEnabled";
/**
 * Preferred expiration for unix.md shares (global)
 * Stores: "1h" | "24h" | "7d" | "30d" | "never"
 * Default: "7d"
 */
exports.SHARE_EXPIRATION_KEY = "shareExpiration";
/**
 * Whether to sign shared messages by default.
 * Stores: boolean
 * Default: true
 */
exports.SHARE_SIGNING_KEY = "shareSigning";
/**
 * Git status indicator display mode (global)
 * Stores: "line-delta" | "divergence"
 */
exports.GIT_STATUS_INDICATOR_MODE_KEY = "gitStatusIndicatorMode";
/**
 * Editor configuration for "Open in Editor" feature (global)
 * Format: "editorConfig"
 */
exports.EDITOR_CONFIG_KEY = "editorConfig";
exports.DEFAULT_EDITOR_CONFIG = {
    editor: "vscode",
};
/**
 * Integrated terminal font configuration (global)
 * Stores: { fontFamily: string; fontSize: number }
 */
exports.TERMINAL_FONT_CONFIG_KEY = "terminalFontConfig";
exports.DEFAULT_TERMINAL_FONT_CONFIG = {
    fontFamily: "Geist Mono, ui-monospace, monospace",
    fontSize: 13,
};
/**
 * Tutorial state storage key (global)
 * Stores: { disabled: boolean, completed: { creation?: true, workspace?: true } }
 */
exports.TUTORIAL_STATE_KEY = "tutorialState";
exports.DEFAULT_TUTORIAL_STATE = {
    disabled: false,
    completed: {},
};
/**
 * Get the localStorage key for review (hunk read) state per workspace
 * Stores which hunks have been marked as read during code review
 * Format: "review-state:{workspaceId}"
 */
function getReviewStateKey(workspaceId) {
    return `review-state:${workspaceId}`;
}
/**
 * Get the localStorage key for hunk first-seen timestamps per workspace
 * Tracks when each hunk content address was first observed (for LIFO sorting)
 * Format: "hunkFirstSeen:{workspaceId}"
 */
function getHunkFirstSeenKey(workspaceId) {
    return `hunkFirstSeen:${workspaceId}`;
}
/**
 * Get the localStorage key for review sort order preference (global)
 * Format: "review-sort-order"
 */
exports.REVIEW_SORT_ORDER_KEY = "review-sort-order";
/**
 * Get the localStorage key for hunk expand/collapse state in Review tab
 * Stores user's manual expand/collapse preferences per hunk
 * Format: "reviewExpandState:{workspaceId}"
 */
function getReviewExpandStateKey(workspaceId) {
    return `reviewExpandState:${workspaceId}`;
}
/**
 * Get the localStorage key for read-more expansion state per hunk.
 * Tracks how many lines are expanded up/down for each hunk.
 * Format: "reviewReadMore:{workspaceId}"
 */
function getReviewReadMoreKey(workspaceId) {
    return `reviewReadMore:${workspaceId}`;
}
/**
 * Get the localStorage key for FileTree expand/collapse state in Review tab
 * Stores directory expand/collapse preferences per workspace
 * Format: "fileTreeExpandState:{workspaceId}"
 */
function getFileTreeExpandStateKey(workspaceId) {
    return `fileTreeExpandState:${workspaceId}`;
}
/**
 * Get the localStorage key for persisted agent status for a workspace
 * Stores the most recent successful status_set payload (emoji, message, url)
 * Format: "statusState:{workspaceId}"
 */
/**
 * Get the localStorage key for "notify on response" toggle per workspace.
 * When true, a browser notification is shown when assistant responses complete.
 * Format: "notifyOnResponse:{workspaceId}"
 */
function getNotifyOnResponseKey(workspaceId) {
    return `notifyOnResponse:${workspaceId}`;
}
/**
 * Get the localStorage key for "auto-enable notifications" toggle per project.
 * When true, new workspaces in this project automatically have notifications enabled.
 * Format: "notifyOnResponseAutoEnable:{projectPath}"
 */
function getNotifyOnResponseAutoEnableKey(projectPath) {
    return `notifyOnResponseAutoEnable:${projectPath}`;
}
function getStatusStateKey(workspaceId) {
    return `statusState:${workspaceId}`;
}
/**
 * Get the localStorage key for session timing stats for a workspace
 * Stores aggregate timing data: totalDurationMs, totalToolExecutionMs, totalTtftMs, ttftCount, responseCount
 * Format: "sessionTiming:{workspaceId}"
 */
function getSessionTimingKey(workspaceId) {
    return `sessionTiming:${workspaceId}`;
}
/**
 * Get the localStorage key for last-read timestamps per workspace.
 * Format: "workspaceLastRead:{workspaceId}"
 */
function getWorkspaceLastReadKey(workspaceId) {
    return `workspaceLastRead:${workspaceId}`;
}
/**
 * Right sidebar tab selection (global)
 * Format: "right-sidebar-tab"
 */
exports.RIGHT_SIDEBAR_TAB_KEY = "right-sidebar-tab";
/**
 * Right sidebar collapsed state (global, manual toggle)
 * Format: "right-sidebar:collapsed"
 */
exports.RIGHT_SIDEBAR_COLLAPSED_KEY = "right-sidebar:collapsed";
/**
 * Right sidebar width (unified across all tabs)
 * Format: "right-sidebar:width"
 */
exports.RIGHT_SIDEBAR_WIDTH_KEY = "right-sidebar:width";
/**
 * Get the localStorage key for right sidebar dock-lite layout per workspace.
 * Each workspace can have its own split/tab configuration (e.g., different
 * numbers of terminals). Width and collapsed state remain global.
 * Format: "right-sidebar:layout:{workspaceId}"
 */
function getRightSidebarLayoutKey(workspaceId) {
    return `right-sidebar:layout:${workspaceId}`;
}
/**
 * Get the localStorage key for terminal titles per workspace.
 * Maps sessionId -> title for persisting OSC-set terminal titles.
 * Format: "right-sidebar:terminal-titles:{workspaceId}"
 */
function getTerminalTitlesKey(workspaceId) {
    return `right-sidebar:terminal-titles:${workspaceId}`;
}
/**
 * Get the localStorage key for unified Review search state per workspace
 * Stores: { input: string, useRegex: boolean, matchCase: boolean }
 * Format: "reviewSearchState:{workspaceId}"
 */
function getReviewSearchStateKey(workspaceId) {
    return `reviewSearchState:${workspaceId}`;
}
/**
 * Get the localStorage key for reviews per workspace
 * Stores: ReviewsState (reviews created from diff viewer - pending, attached, or checked)
 * Format: "reviews:{workspaceId}"
 */
function getReviewsKey(workspaceId) {
    return `reviews:${workspaceId}`;
}
/**
 * Get the localStorage key for auto-compaction enabled preference per workspace
 * Format: "autoCompaction:enabled:{workspaceId}"
 */
function getAutoCompactionEnabledKey(workspaceId) {
    return `autoCompaction:enabled:${workspaceId}`;
}
/**
 * Get the localStorage key for auto-compaction threshold percentage per model
 * Format: "autoCompaction:threshold:{model}"
 * Stored per-model because different models have different context windows
 */
function getAutoCompactionThresholdKey(model) {
    return `autoCompaction:threshold:${model}`;
}
/**
 * List of workspace-scoped key functions that should be copied on fork and deleted on removal
 */
const PERSISTENT_WORKSPACE_KEY_FUNCTIONS = [
    getWorkspaceAISettingsByAgentKey,
    getModelKey,
    getInputKey,
    getInputAttachmentsKey,
    getAgentIdKey,
    getPinnedAgentIdKey,
    getThinkingLevelKey,
    getAutoRetryKey,
    getRetryStateKey,
    getReviewStateKey,
    getHunkFirstSeenKey,
    getReviewExpandStateKey,
    getReviewReadMoreKey,
    getFileTreeExpandStateKey,
    getReviewSearchStateKey,
    getReviewsKey,
    getAutoCompactionEnabledKey,
    getWorkspaceLastReadKey,
    getStatusStateKey,
    // Note: auto-compaction threshold is per-model, not per-workspace
];
/**
 * Get the localStorage key for cached plan content for a workspace
 * Stores: { content: string; path: string } - used for optimistic rendering
 * Format: "planContent:{workspaceId}"
 */
function getPlanContentKey(workspaceId) {
    return `planContent:${workspaceId}`;
}
/**
 * Get the localStorage key for cached post-compaction state for a workspace
 * Stores: { planPath: string | null; trackedFilePaths: string[]; excludedItems: string[] }
 * Format: "postCompactionState:{workspaceId}"
 */
function getPostCompactionStateKey(workspaceId) {
    return `postCompactionState:${workspaceId}`;
}
/**
 * Additional ephemeral keys to delete on workspace removal (not copied on fork)
 */
const EPHEMERAL_WORKSPACE_KEY_FUNCTIONS = [
    getCancelledCompactionKey,
    getPendingWorkspaceSendErrorKey,
    getPlanContentKey, // Cache only, no need to preserve on fork
    getPostCompactionStateKey, // Cache only, no need to preserve on fork
];
/**
 * Copy all workspace-specific localStorage keys from source to destination workspace.
 * Includes keys listed in PERSISTENT_WORKSPACE_KEY_FUNCTIONS (model, draft input text/attachments, etc).
 */
function copyWorkspaceStorage(sourceWorkspaceId, destWorkspaceId) {
    for (const getKey of PERSISTENT_WORKSPACE_KEY_FUNCTIONS) {
        const sourceKey = getKey(sourceWorkspaceId);
        const destKey = getKey(destWorkspaceId);
        const value = localStorage.getItem(sourceKey);
        if (value !== null) {
            localStorage.setItem(destKey, value);
        }
    }
}
/**
 * Delete all workspace-specific localStorage keys for a workspace
 * Should be called when a workspace is deleted to prevent orphaned data
 */
function deleteWorkspaceStorage(workspaceId) {
    const allKeyFunctions = [
        ...PERSISTENT_WORKSPACE_KEY_FUNCTIONS,
        ...EPHEMERAL_WORKSPACE_KEY_FUNCTIONS,
    ];
    for (const getKey of allKeyFunctions) {
        const key = getKey(workspaceId);
        localStorage.removeItem(key);
    }
}
/**
 * Migrate all workspace-specific localStorage keys from old to new workspace ID
 * Should be called when a workspace is renamed to preserve settings
 */
function migrateWorkspaceStorage(oldWorkspaceId, newWorkspaceId) {
    copyWorkspaceStorage(oldWorkspaceId, newWorkspaceId);
    deleteWorkspaceStorage(oldWorkspaceId);
}
//# sourceMappingURL=storage.js.map