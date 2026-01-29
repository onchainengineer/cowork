import { existsSync, renameSync, symlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

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
export function migrateLegacyUnixHome(): void {
  const oldPath = join(homedir(), LEGACY_UNIX_DIR_NAME);
  const newPath = join(homedir(), UNIX_DIR_NAME);

  // If .unix exists, we're done (already migrated or fresh install)
  if (existsSync(newPath)) {
    return;
  }

  // If .unix exists, move it and create symlink for backward compatibility
  if (existsSync(oldPath)) {
    renameSync(oldPath, newPath);
    symlinkSync(newPath, oldPath, "dir");
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
export function getUnixHome(): string {
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
  return join(homedir(), baseName + suffix);
}

/**
 * Get the directory where workspace git worktrees are stored.
 * Example: ~/.lattice/src/my-project/feature-branch
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getUnixSrcDir(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "src");
}

/**
 * Get the directory where session chat histories are stored.
 * Example: ~/.lattice/sessions/workspace-id/chat.jsonl
 *
 * @param rootDir - Optional root directory (defaults to getUnixHome())
 */
export function getUnixSessionsDir(rootDir?: string): string {
  const root = rootDir ?? getUnixHome();
  return join(root, "sessions");
}

/**
 * Get the directory where plan files are stored.
 * Example: ~/.lattice/plans/workspace-id.md
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
 * Example: ~/.lattice/projects/my-project
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
