import { existsSync, renameSync, symlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const LEGACY_UNIX_DIR_NAME = ".cmux";
const UNIX_DIR_NAME = ".unix";

/**
 * Migrate from the legacy ~/.cmux directory into ~/.unix for rebranded installs.
 * Called on startup to preserve data created by earlier releases.
 *
 * If .unix exists, nothing happens (already migrated).
 * If .cmux exists but .unix doesn't, moves .cmux → .unix and creates symlink.
 * This ensures old scripts/tools referencing ~/.cmux continue working.
 */
export function migrateLegacyUnixHome(): void {
  const oldPath = join(homedir(), LEGACY_UNIX_DIR_NAME);
  const newPath = join(homedir(), UNIX_DIR_NAME);

  // If .unix exists, we're done (already migrated or fresh install)
  if (existsSync(newPath)) {
    return;
  }

  // If .cmux exists, move it and create symlink for backward compatibility
  if (existsSync(oldPath)) {
    renameSync(oldPath, newPath);
    symlinkSync(newPath, oldPath, "dir");
  }

  // If neither exists, nothing to do (will be created on first use)
}

/**
 * Get the root directory for all unix configuration and data.
 * Can be overridden with UNIX_ROOT environment variable.
 * Appends '-dev' suffix when NODE_ENV=development (explicit dev mode).
 *
 * This is a getter function to support test mocking of os.homedir().
 *
 * Note: This file is only used by main process code, but lives in constants/
 * for organizational purposes. The process.env access is safe.
 */
export function getUnixHome(): string {
  // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
  if (process.env.UNIX_ROOT) {
    // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
    return process.env.UNIX_ROOT;
  }

  const baseName = UNIX_DIR_NAME;
  // Use -dev suffix only when explicitly in development mode
  // eslint-disable-next-line no-restricted-syntax, no-restricted-globals
  const suffix = process.env.NODE_ENV === "development" ? "-dev" : "";
  return join(homedir(), baseName + suffix);
}

/**
 * Get the directory where workspace git worktrees are stored.
 * Example: ~/.unix/src/my-project/feature-branch
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getUnixSrcDir(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "src");
}

/**
 * Get the directory where session chat histories are stored.
 * Example: ~/.unix/sessions/workspace-id/chat.jsonl
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getUnixSessionsDir(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "sessions");
}

/**
 * Get the directory where plan files are stored.
 * Example: ~/.unix/plans/workspace-id.md
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getMuxPlansDir(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "plans");
}

/**
 * Get the main configuration file path.
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getMuxConfigFile(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "config.json");
}

/**
 * Get the providers configuration file path.
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getMuxProvidersFile(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "providers.jsonc");
}

/**
 * Get the secrets file path.
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getMuxSecretsFile(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "secrets.json");
}

/**
 * Get the default directory for new projects created with bare names.
 * Example: ~/.unix/projects/my-project
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getMuxProjectsDir(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "projects");
}

/**
 * Get the extension metadata file path (shared with VS Code extension).
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getMuxExtensionMetadataPath(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "extensionMetadata.json");
}
