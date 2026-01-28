"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILE_SIZE = void 0;
exports.validatePlanModeAccess = validatePlanModeAccess;
exports.generateDiff = generateDiff;
exports.isPlanFilePath = isPlanFilePath;
exports.validateFileSize = validateFileSize;
exports.validateNoRedundantPrefix = validateNoRedundantPrefix;
exports.validatePathInCwd = validatePathInCwd;
exports.validateAndCorrectPath = validateAndCorrectPath;
const path = __importStar(require("path"));
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const diff_1 = require("diff");
const SSHRuntime_1 = require("../../../node/runtime/SSHRuntime");
/**
 * Maximum file size for file operations (1MB)
 * Files larger than this should be processed with system tools like grep, sed, etc.
 */
exports.MAX_FILE_SIZE = 1024 * 1024; // 1MB
/**
 * Validate file path for plan mode restrictions.
 * Returns an error if:
 * - Editing plan file outside plan mode (read-only)
 * - Editing non-plan file in plan mode
 * - Path is outside cwd (for non-plan files)
 *
 * Returns null if validation passes.
 */
async function validatePlanModeAccess(filePath, config) {
    // Plan file is always read-only outside the plan agent.
    // This is especially important for SSH runtimes, where cwd validation is intentionally skipped.
    if ((await isPlanFilePath(filePath, config)) && !config.planFileOnly) {
        return {
            success: false,
            error: `Plan file is read-only outside the plan agent: ${filePath}`,
        };
    }
    // Plan-agent restriction: only allow editing the plan file (and require exact string match).
    if (config.planFileOnly && config.planFilePath) {
        if (filePath !== config.planFilePath) {
            if (await isPlanFilePath(filePath, config)) {
                return {
                    success: false,
                    error: `In the plan agent, you must use the exact plan file path from the instructions: ${config.planFilePath} (attempted: ${filePath}; this resolves to the plan file but absolute/alternate paths are not allowed)`,
                };
            }
            return {
                success: false,
                error: `In the plan agent, only the plan file can be edited. You must use the exact plan file path: ${config.planFilePath} (attempted: ${filePath})`,
            };
        }
        // Skip cwd validation for plan file - it may be outside workspace
    }
    else {
        // Standard cwd validation for non-plan-mode edits
        const pathValidation = validatePathInCwd(filePath, config.cwd, config.runtime);
        if (pathValidation) {
            return {
                success: false,
                error: pathValidation.error,
            };
        }
    }
    return null;
}
/**
 * Compute a 6-character hexadecimal lease from file content.
 * The lease changes when file content is modified.
 * Uses a deterministic hash so leases are consistent across processes.
 */
/**
 * Generate a unified diff between old and new content using jsdiff.
 * Uses createPatch with context of 3 lines.
 *
 * @param filePath - The file path being edited (used in diff header)
 * @param oldContent - The original file content
 * @param newContent - The modified file content
 * @returns Unified diff string
 */
function generateDiff(filePath, oldContent, newContent) {
    return (0, diff_1.createPatch)(filePath, oldContent, newContent, "", "", { context: 3 });
}
/**
 * Check if a file path is the configured plan file (any mode).
 * Uses runtime.resolvePath to properly expand tildes for comparison.
 *
 * Why mode-agnostic: the plan file is useful context in both plan + exec modes,
 * but should only be writable in plan mode.
 *
 * @param targetPath - The path being accessed (may contain ~ or be absolute)
 * @param config - Tool configuration containing planFilePath
 * @returns true if this is the configured plan file
 */
async function isPlanFilePath(targetPath, config) {
    if (!config.planFilePath) {
        return false;
    }
    // Resolve both paths to absolute form for proper comparison.
    // This handles cases where one path uses ~ and the other is fully expanded.
    const [resolvedTarget, resolvedPlan] = await Promise.all([
        config.runtime.resolvePath(targetPath),
        config.runtime.resolvePath(config.planFilePath),
    ]);
    return resolvedTarget === resolvedPlan;
}
/**
 * Validates that a file size is within the allowed limit.
 * Returns an error object if the file is too large, null if valid.
 *
 * @param stats - File stats from fs.stat()
 * @returns Error object if file is too large, null if valid
 */
function validateFileSize(stats) {
    if (stats.size > exports.MAX_FILE_SIZE) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const maxMB = (exports.MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);
        return {
            error: `File is too large (${sizeMB}MB). The maximum file size for file operations is ${maxMB}MB. Please use system tools like grep, sed, awk, or split the file into smaller chunks.`,
        };
    }
    return null;
}
/**
 * Validates that a file path doesn't contain redundant workspace prefix.
 * If the path contains the cwd prefix, returns the corrected relative path and a warning.
 * This helps save tokens by encouraging relative paths.
 *
 * Works for both local and SSH runtimes by using runtime.normalizePath()
 * for consistent path handling across different runtime types.
 *
 * @param filePath - The file path to validate
 * @param cwd - The working directory
 * @param runtime - The runtime to use for path normalization
 * @returns Object with corrected path and warning if redundant prefix found, null if valid
 */
function validateNoRedundantPrefix(filePath, cwd, runtime) {
    // Only check absolute paths (start with /) - relative paths are fine
    // This works for both local and SSH since both use Unix-style paths
    if (!filePath.startsWith("/")) {
        return null;
    }
    // Use runtime's normalizePath to ensure consistent handling across local and SSH
    // Normalize the cwd to get canonical form (removes trailing slashes, etc.)
    const normalizedCwd = runtime.normalizePath(".", cwd);
    // For absolute paths, we can't use normalizePath directly (it resolves relative paths)
    // so just clean up trailing slashes manually
    const normalizedPath = filePath.replace(/\/+$/, "");
    const cleanCwd = normalizedCwd.replace(/\/+$/, "");
    // Check if the absolute path starts with the cwd
    // Use startsWith + check for path separator to avoid partial matches
    // e.g., /workspace/project should match /workspace/project/src but not /workspace/project2
    if (normalizedPath === cleanCwd || normalizedPath.startsWith(cleanCwd + "/")) {
        // Calculate what the relative path would be
        const relativePath = normalizedPath === cleanCwd ? "." : normalizedPath.substring(cleanCwd.length + 1);
        return {
            correctedPath: relativePath,
            warning: `Note: Using relative paths like '${relativePath}' instead of '${filePath}' saves tokens. The path has been auto-corrected for you.`,
        };
    }
    return null;
}
/**
 * Validates that a file path is within the allowed working directory.
 * Returns an error object if the path is outside cwd (and any optional allowlisted roots),
 * null if valid.
 *
 * @param filePath - The file path to validate (can be relative or absolute)
 * @param cwd - The working directory that file operations are restricted to
 * @param runtime - The runtime (used to detect SSH - TODO: make path validation runtime-aware)
 * @param extraAllowedDirs - Additional absolute directories that are allowlisted for access.
 * @returns Error object if invalid, null if valid
 */
function validatePathInCwd(filePath, cwd, runtime, extraAllowedDirs = []) {
    // TODO: Make path validation runtime-aware instead of skipping for SSH.
    // For now, skip local path validation for SSH runtimes since:
    // 1. Node's path module doesn't understand remote paths (~/unix/branch)
    // 2. The runtime's own file operations will fail on invalid paths anyway
    if (runtime instanceof SSHRuntime_1.SSHRuntime) {
        return null;
    }
    const trimmedExtraAllowedDirs = extraAllowedDirs
        .map((dir) => dir.trim())
        .filter((dir) => dir.length > 0);
    // extraAllowedDirs are an internal allowlist (e.g., stream-scoped runtimeTempDir).
    // For safety, require absolute paths so misconfiguration doesn't widen access.
    for (const dir of trimmedExtraAllowedDirs) {
        (0, assert_1.default)(path.isAbsolute(dir), `extraAllowedDir must be an absolute path: '${dir}'`);
    }
    const filePathIsAbsolute = path.isAbsolute(filePath);
    // Only allow extraAllowedDirs when the caller provides an absolute path.
    // This prevents relative-path escapes (e.g., ../...) from bypassing cwd restrictions.
    // Resolve the path (handles relative paths and normalizes)
    const resolvedPath = filePathIsAbsolute ? path.resolve(filePath) : path.resolve(cwd, filePath);
    const allowedRoots = [cwd, ...(filePathIsAbsolute ? trimmedExtraAllowedDirs : [])].map((dir) => path.resolve(dir));
    // Check if resolved path is within any allowed root.
    // Use path.relative to check if we need to go "up" from the root to reach the file.
    const isWithinAllowedRoot = allowedRoots.some((root) => {
        const relativePath = path.relative(root, resolvedPath);
        return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    });
    if (!isWithinAllowedRoot) {
        return {
            error: `File operations are restricted to the workspace directory (${cwd}). The path '${filePath}' resolves outside this directory. If you need to modify files outside the workspace, please ask the user for permission first.`,
        };
    }
    return null;
}
/**
 * Validates and auto-corrects redundant path prefixes in file paths.
 * Returns the corrected path and an optional warning message.
 *
 * This is a convenience wrapper around validateNoRedundantPrefix that handles
 * the common pattern of auto-correcting paths and returning warnings.
 *
 * @param filePath - The file path to validate (may be modified if redundant prefix found)
 * @param cwd - The working directory
 * @param runtime - The runtime to use for path normalization
 * @returns Object with correctedPath and optional warning
 */
function validateAndCorrectPath(filePath, cwd, runtime) {
    const redundantPrefixValidation = validateNoRedundantPrefix(filePath, cwd, runtime);
    if (redundantPrefixValidation) {
        return {
            correctedPath: redundantPrefixValidation.correctedPath,
            warning: redundantPrefixValidation.warning,
        };
    }
    return { correctedPath: filePath };
}
//# sourceMappingURL=fileCommon.js.map