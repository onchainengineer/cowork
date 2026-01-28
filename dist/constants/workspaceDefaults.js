"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKSPACE_DEFAULTS = exports.STORAGE_KEYS = void 0;
/**
 * Storage key helpers for persisted settings.
 */
exports.STORAGE_KEYS = {
    /** Per-project default diff base for code review. Pass projectPath. */
    reviewDefaultBase: (projectPath) => `review-default-base:${projectPath}`,
    /** Per-workspace diff base override. Pass workspaceId. */
    reviewDiffBase: (workspaceId) => `review-diff-base:${workspaceId}`,
};
Object.freeze(exports.STORAGE_KEYS);
const knownModels_1 = require("../common/constants/knownModels");
/**
 * Hard-coded default values for workspace settings.
 * Type assertions ensure proper typing while maintaining immutability.
 */
exports.WORKSPACE_DEFAULTS = {
    /** Default agent id for new workspaces (built-in exec agent). */
    agentId: "exec",
    /** Default thinking/reasoning level for new workspaces */
    thinkingLevel: "off",
    /**
     * Default AI model for new workspaces.
     * Uses the centralized default from knownModels.ts.
     */
    model: knownModels_1.DEFAULT_MODEL,
    /** Default auto-retry preference for new workspaces */
    autoRetry: true,
    /** Default input text for new workspaces (empty) */
    input: "",
    /** Default diff base for code review (compare against origin/main) */
    reviewBase: "origin/main",
};
// Freeze the object at runtime to prevent accidental mutation
Object.freeze(exports.WORKSPACE_DEFAULTS);
//# sourceMappingURL=workspaceDefaults.js.map