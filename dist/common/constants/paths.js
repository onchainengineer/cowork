"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyUnixHome = migrateLegacyUnixHome;
exports.getUnixHome = getUnixHome;
exports.getUnixSrcDir = getUnixSrcDir;
exports.getUnixSessionsDir = getUnixSessionsDir;
exports.getMuxPlansDir = getMuxPlansDir;
exports.getMuxConfigFile = getMuxConfigFile;
exports.getMuxProvidersFile = getMuxProvidersFile;
exports.getMuxSecretsFile = getMuxSecretsFile;
exports.getMuxProjectsDir = getMuxProjectsDir;
exports.getMuxExtensionMetadataPath = getMuxExtensionMetadataPath;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const LEGACY_UNIX_DIR_NAME = ".unix";
const UNIX_DIR_NAME = ".lattice";
/**
 * Migrate from the legacy ~/.unix directory into ~/.lattice for rebranded installs.
 * Called on startup to preserve data created by earlier releases.
 *
 * If .lattice exists, nothing happens (already migrated).
 * If .unix exists but .lattice doesn't, moves .unix → .lattice and creates symlink.
 * This ensures old scripts/tools referencing ~/.unix continue working.
 */
function migrateLegacyUnixHome() {
    const oldPath = (0, path_1.join)((0, os_1.homedir)(), LEGACY_UNIX_DIR_NAME);
    const newPath = (0, path_1.join)((0, os_1.homedir)(), UNIX_DIR_NAME);
    // If .unix exists, we're done (already migrated or fresh install)
    if ((0, fs_1.existsSync)(newPath)) {
        return;
    }
    // If .unix exists, move it and create symlink for backward compatibility
    if ((0, fs_1.existsSync)(oldPath)) {
        (0, fs_1.renameSync)(oldPath, newPath);
        (0, fs_1.symlinkSync)(newPath, oldPath, "dir");
    }
    // If neither exists, nothing to do (will be created on first use)
}
/**
 * Get the root directory for all Lattice configuration and data.
 * Can be overridden with LATTICE_ROOT (preferred) or UNIX_ROOT (legacy) env var.
 * Appends '-dev' suffix when NODE_ENV=development (explicit dev mode).
 *
 * This is a getter function to support test mocking of os.homedir().
 *
 * Note: This file is only used by main process code, but lives in constants/
 * for organizational purposes. The process.env access is safe.
 */
function getUnixHome() {
    // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
    if (process.env.LATTICE_ROOT) {
        // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
        return process.env.LATTICE_ROOT;
    }
    // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
    if (process.env.UNIX_ROOT) {
        // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
        return process.env.UNIX_ROOT;
    }
    const baseName = UNIX_DIR_NAME;
    // Use -dev suffix only when explicitly in development mode
    // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
    const suffix = process.env.NODE_ENV === "development" ? "-dev" : "";
    return (0, path_1.join)((0, os_1.homedir)(), baseName + suffix);
}
/**
 * Get the directory where workspace git worktrees are stored.
 * Example: ~/.lattice/src/my-project/feature-branch
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getUnixSrcDir(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "src");
}
/**
 * Get the directory where session chat histories are stored.
 * Example: ~/.lattice/sessions/workspace-id/chat.jsonl
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getUnixSessionsDir(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "sessions");
}
/**
 * Get the directory where plan files are stored.
 * Example: ~/.lattice/plans/workspace-id.md
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getMuxPlansDir(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "plans");
}
/**
 * Get the main configuration file path.
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getMuxConfigFile(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "config.json");
}
/**
 * Get the providers configuration file path.
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getMuxProvidersFile(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "providers.jsonc");
}
/**
 * Get the secrets file path.
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getMuxSecretsFile(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "secrets.json");
}
/**
 * Get the default directory for new projects created with bare names.
 * Example: ~/.lattice/projects/my-project
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getMuxProjectsDir(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "projects");
}
/**
 * Get the extension metadata file path (shared with VS Code extension).
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
function getMuxExtensionMetadataPath(rootDir) {
    const root = rootDir ?? getUnixHome();
    return (0, path_1.join)(root, "extensionMetadata.json");
}
//# sourceMappingURL=paths.js.map