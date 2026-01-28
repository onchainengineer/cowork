"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RUNTIME_CONFIG = void 0;
/**
 * Default runtime configuration for worktree workspaces.
 * Uses git worktrees for workspace isolation.
 * Used when no runtime config is specified.
 */
exports.DEFAULT_RUNTIME_CONFIG = {
    type: "worktree",
    srcBaseDir: "~/.unix/src",
};
//# sourceMappingURL=workspace.js.map