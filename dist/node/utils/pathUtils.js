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
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandTilde = expandTilde;
exports.stripTrailingSlashes = stripTrailingSlashes;
exports.validateProjectPath = validateProjectPath;
exports.isGitRepository = isGitRepository;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const paths_main_1 = require("./paths.main");
/**
 * Expand tilde (~) in paths to the user's home directory
 *
 * @param inputPath - Path that may contain tilde
 * @returns Path with tilde expanded to home directory
 *
 * @example
 * expandTilde("~/Documents") // => "/home/user/Documents"
 * expandTilde("~") // => "/home/user"
 * expandTilde("/absolute/path") // => "/absolute/path"
 */
function expandTilde(inputPath) {
    return paths_main_1.PlatformPaths.expandHome(inputPath);
}
/**
 * Strip trailing slashes from a path.
 * path.normalize() preserves a single trailing slash which breaks basename extraction.
 *
 * @param inputPath - Path that may have trailing slashes
 * @returns Path without trailing slashes
 *
 * @example
 * stripTrailingSlashes("/home/user/project/") // => "/home/user/project"
 * stripTrailingSlashes("/home/user/project//") // => "/home/user/project"
 */
function stripTrailingSlashes(inputPath) {
    return inputPath.replace(/[/\\]+$/, "");
}
/**
 * Validate that a project path exists and is a directory.
 * Git repository status is checked separately - non-git repos are valid
 * but will be restricted to local runtime only.
 * Automatically expands tilde and normalizes the path.
 *
 * @param inputPath - Path to validate (may contain tilde)
 * @returns Validation result with expanded path or error
 *
 * @example
 * await validateProjectPath("~/my-project")
 * // => { valid: true, expandedPath: "/home/user/my-project" }
 *
 * await validateProjectPath("~/nonexistent")
 * // => { valid: false, error: "Path does not exist: /home/user/nonexistent" }
 */
async function validateProjectPath(inputPath) {
    // Expand tilde if present
    const expandedPath = expandTilde(inputPath);
    // Normalize to resolve any .. or . in the path, then strip trailing slashes
    const normalizedPath = stripTrailingSlashes(path.normalize(expandedPath));
    // Check if path exists
    try {
        const stats = await fs.stat(normalizedPath);
        // Check if it's a directory
        if (!stats.isDirectory()) {
            return {
                valid: false,
                error: `Path is not a directory: ${normalizedPath}`,
            };
        }
    }
    catch (err) {
        if (err.code === "ENOENT") {
            return {
                valid: false,
                error: `Path does not exist: ${normalizedPath}`,
            };
        }
        throw err;
    }
    return {
        valid: true,
        expandedPath: normalizedPath,
    };
}
/**
 * Check if a path is a git repository
 *
 * @param projectPath - Path to check (should be already validated/normalized)
 * @returns true if the path contains a .git directory
 */
async function isGitRepository(projectPath) {
    const gitPath = path.join(projectPath, ".git");
    try {
        await fs.stat(gitPath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=pathUtils.js.map