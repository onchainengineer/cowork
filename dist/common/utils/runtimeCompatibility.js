"use strict";
/**
 * Runtime configuration compatibility checks.
 *
 * This module is intentionally in common/ to avoid circular dependencies
 * with runtime implementations (LocalRuntime, SSHRuntime, etc.).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIncompatibleRuntimeConfig = isIncompatibleRuntimeConfig;
const schemas_1 = require("../../common/orpc/schemas");
/**
 * Check if a runtime config is from a newer version and incompatible.
 *
 * This handles downgrade compatibility: if a user upgrades to a version
 * with new runtime types, then downgrades, those workspaces should show
 * a clear error rather than crashing.
 *
 * Currently supported types:
 * - "local" without srcBaseDir: Project-dir runtime (uses project path directly)
 * - "local" with srcBaseDir: Legacy worktree config (for backward compat)
 * - "worktree": Explicit worktree runtime
 * - "ssh": Remote SSH runtime
 * - "docker": Docker container runtime
 */
function isIncompatibleRuntimeConfig(config) {
    if (!config) {
        return false;
    }
    // Unknown type from a future version
    return !schemas_1.RuntimeModeSchema.safeParse(config.type).success;
}
//# sourceMappingURL=runtimeCompatibility.js.map