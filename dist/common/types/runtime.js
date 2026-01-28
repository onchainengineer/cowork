"use strict";
/**
 * Runtime configuration types for workspace execution environments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LATTICE_RUNTIME_PLACEHOLDER = exports.DEVCONTAINER_RUNTIME_PREFIX = exports.DOCKER_RUNTIME_PREFIX = exports.SSH_RUNTIME_PREFIX = exports.RUNTIME_MODES_REQUIRING_GIT = exports.RUNTIME_MODE = void 0;
exports.parseRuntimeModeAndHost = parseRuntimeModeAndHost;
exports.buildRuntimeString = buildRuntimeString;
exports.buildRuntimeConfig = buildRuntimeConfig;
exports.isSSHRuntime = isSSHRuntime;
exports.isDockerRuntime = isDockerRuntime;
exports.isDevcontainerRuntime = isDevcontainerRuntime;
exports.isWorktreeRuntime = isWorktreeRuntime;
exports.isLocalProjectRuntime = isLocalProjectRuntime;
exports.hasSrcBaseDir = hasSrcBaseDir;
exports.getSrcBaseDir = getSrcBaseDir;
exports.getDevcontainerConfigs = getDevcontainerConfigs;
exports.hasDevcontainerConfigs = hasDevcontainerConfigs;
const schemas_1 = require("../orpc/schemas");
/** Runtime mode constants */
exports.RUNTIME_MODE = {
    LOCAL: "local",
    WORKTREE: "worktree",
    SSH: "ssh",
    DOCKER: "docker",
    DEVCONTAINER: "devcontainer",
};
/**
 * Runtime modes that require a git repository.
 *
 * Worktree/SSH/Docker/Devcontainer all depend on git operations (worktrees, clones, bundles).
 * Local runtime can operate directly in a directory without git.
 */
exports.RUNTIME_MODES_REQUIRING_GIT = [
    exports.RUNTIME_MODE.WORKTREE,
    exports.RUNTIME_MODE.SSH,
    exports.RUNTIME_MODE.DOCKER,
    exports.RUNTIME_MODE.DEVCONTAINER,
];
/** Runtime string prefix for SSH mode (e.g., "ssh hostname") */
exports.SSH_RUNTIME_PREFIX = "ssh ";
/** Runtime string prefix for Docker mode (e.g., "docker ubuntu:22.04") */
exports.DOCKER_RUNTIME_PREFIX = "docker ";
/** Runtime string prefix for Devcontainer mode (e.g., "devcontainer .devcontainer/devcontainer.json") */
exports.DEVCONTAINER_RUNTIME_PREFIX = "devcontainer ";
/** Placeholder host for Lattice SSH runtimes (where host is derived from Lattice config) */
exports.LATTICE_RUNTIME_PLACEHOLDER = "lattice://";
/**
 * Parse runtime string from localStorage or UI input into structured result.
 * Format: "ssh <host>" -> { mode: "ssh", host: "<host>" }
 *         "docker <image>" -> { mode: "docker", image: "<image>" }
 *         "worktree" -> { mode: "worktree" }
 *         "local" -> { mode: "local" }
 *         undefined/null -> { mode: "worktree" } (default)
 *
 * Note: "ssh" or "docker" without arguments returns null (invalid).
 * Use this for UI state management (localStorage, form inputs).
 */
function parseRuntimeModeAndHost(runtime) {
    if (!runtime) {
        return { mode: exports.RUNTIME_MODE.WORKTREE };
    }
    const trimmed = runtime.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    if (lowerTrimmed === exports.RUNTIME_MODE.LOCAL) {
        return { mode: exports.RUNTIME_MODE.LOCAL };
    }
    if (lowerTrimmed === exports.RUNTIME_MODE.WORKTREE) {
        return { mode: exports.RUNTIME_MODE.WORKTREE };
    }
    // Check for "ssh <host>" format
    if (lowerTrimmed.startsWith(exports.SSH_RUNTIME_PREFIX)) {
        const host = trimmed.substring(exports.SSH_RUNTIME_PREFIX.length).trim();
        if (!host)
            return null; // "ssh " without host is invalid
        return { mode: exports.RUNTIME_MODE.SSH, host };
    }
    // Plain "ssh" without host is invalid
    if (lowerTrimmed === exports.RUNTIME_MODE.SSH) {
        return null;
    }
    // Check for "docker <image>" format
    if (lowerTrimmed.startsWith(exports.DOCKER_RUNTIME_PREFIX)) {
        const image = trimmed.substring(exports.DOCKER_RUNTIME_PREFIX.length).trim();
        if (!image)
            return null; // "docker " without image is invalid
        return { mode: exports.RUNTIME_MODE.DOCKER, image };
    }
    // Plain "docker" without image is invalid
    if (lowerTrimmed === exports.RUNTIME_MODE.DOCKER) {
        return null;
    }
    // Check for "devcontainer <configPath>" format (config path is optional)
    if (lowerTrimmed.startsWith(exports.DEVCONTAINER_RUNTIME_PREFIX)) {
        const configPath = trimmed.substring(exports.DEVCONTAINER_RUNTIME_PREFIX.length).trim();
        return { mode: exports.RUNTIME_MODE.DEVCONTAINER, configPath };
    }
    if (lowerTrimmed === exports.RUNTIME_MODE.DEVCONTAINER) {
        return { mode: exports.RUNTIME_MODE.DEVCONTAINER, configPath: "" };
    }
    // Try to parse as a plain mode (local/worktree/devcontainer)
    const modeResult = schemas_1.RuntimeModeSchema.safeParse(lowerTrimmed);
    if (modeResult.success) {
        const mode = modeResult.data;
        if (mode === "local")
            return { mode: "local" };
        if (mode === "worktree")
            return { mode: "worktree" };
        if (mode === "devcontainer")
            return { mode: "devcontainer", configPath: "" };
        // ssh/docker without args handled above
    }
    // Unrecognized - return null
    return null;
}
/**
 * Build runtime string for storage/IPC from parsed runtime.
 * Returns: "ssh <host>" for SSH, "docker <image>" for Docker, "local" for local, undefined for worktree (default)
 */
function buildRuntimeString(parsed) {
    switch (parsed.mode) {
        case exports.RUNTIME_MODE.SSH:
            return `${exports.SSH_RUNTIME_PREFIX}${parsed.host}`;
        case exports.RUNTIME_MODE.DOCKER:
            return `${exports.DOCKER_RUNTIME_PREFIX}${parsed.image}`;
        case exports.RUNTIME_MODE.LOCAL:
            return "local";
        case exports.RUNTIME_MODE.DEVCONTAINER: {
            const configPath = parsed.configPath.trim();
            return configPath.length > 0
                ? `${exports.DEVCONTAINER_RUNTIME_PREFIX}${configPath}`
                : exports.RUNTIME_MODE.DEVCONTAINER;
        }
        case exports.RUNTIME_MODE.WORKTREE:
            // Worktree is default, no string needed
            return undefined;
    }
}
/**
 * Convert ParsedRuntime to RuntimeConfig for workspace creation.
 * This preserves all fields (like shareCredentials for Docker) that would be lost
 * in string serialization via buildRuntimeString + parseRuntimeString.
 */
function buildRuntimeConfig(parsed) {
    switch (parsed.mode) {
        case exports.RUNTIME_MODE.SSH:
            return {
                type: exports.RUNTIME_MODE.SSH,
                host: parsed.host.trim(),
                srcBaseDir: "~/unix", // Default remote base directory (tilde resolved by backend)
                lattice: parsed.lattice,
            };
        case exports.RUNTIME_MODE.DOCKER:
            return {
                type: exports.RUNTIME_MODE.DOCKER,
                image: parsed.image.trim(),
                shareCredentials: parsed.shareCredentials,
            };
        case exports.RUNTIME_MODE.LOCAL:
            return { type: exports.RUNTIME_MODE.LOCAL };
        case exports.RUNTIME_MODE.DEVCONTAINER:
            return {
                type: exports.RUNTIME_MODE.DEVCONTAINER,
                configPath: parsed.configPath.trim(),
                shareCredentials: parsed.shareCredentials,
            };
        case exports.RUNTIME_MODE.WORKTREE:
            // Worktree uses system default config
            return undefined;
    }
}
/**
 * Type guard to check if a runtime config is SSH
 */
function isSSHRuntime(config) {
    return config?.type === "ssh";
}
/**
 * Type guard to check if a runtime config is Docker
 */
function isDockerRuntime(config) {
    return config?.type === "docker";
}
/**
 * Type guard to check if a runtime config is Devcontainer
 */
function isDevcontainerRuntime(config) {
    return config?.type === "devcontainer";
}
/**
 * Type guard to check if a runtime config uses worktree semantics.
 * This includes both explicit "worktree" type AND legacy "local" with srcBaseDir.
 */
function isWorktreeRuntime(config) {
    if (!config)
        return false;
    if (config.type === "worktree")
        return true;
    // Legacy: "local" with srcBaseDir is treated as worktree
    if (config.type === "local" && "srcBaseDir" in config && config.srcBaseDir)
        return true;
    return false;
}
/**
 * Type guard to check if a runtime config is project-dir local (no isolation)
 */
function isLocalProjectRuntime(config) {
    if (!config)
        return false;
    // "local" without srcBaseDir is project-dir runtime
    return config.type === "local" && !("srcBaseDir" in config && config.srcBaseDir);
}
/**
 * Type guard to check if a runtime config has srcBaseDir (worktree-style runtimes).
 * This narrows the type to allow safe access to srcBaseDir.
 */
function hasSrcBaseDir(config) {
    if (!config)
        return false;
    return "srcBaseDir" in config && typeof config.srcBaseDir === "string";
}
/**
 * Helper to safely get srcBaseDir from a runtime config.
 * Returns undefined for project-dir local configs.
 */
function getSrcBaseDir(config) {
    if (!config)
        return undefined;
    if (hasSrcBaseDir(config))
        return config.srcBaseDir;
    return undefined;
}
/**
 * Helper to extract devcontainer configs from availability status.
 * Returns empty array if not a devcontainer availability or not available.
 */
function getDevcontainerConfigs(status) {
    if (status.available && "configs" in status) {
        return status.configs;
    }
    return [];
}
/**
 * Helper to check if availability has devcontainer configs.
 */
function hasDevcontainerConfigs(status) {
    return status.available && "configs" in status;
}
//# sourceMappingURL=runtime.js.map