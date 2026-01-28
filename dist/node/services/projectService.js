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
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const ui_1 = require("../../common/constants/ui");
const sections_1 = require("../../common/utils/sections");
const archive_1 = require("../../common/utils/archive");
const crypto_1 = require("crypto");
const pathUtils_1 = require("../../node/utils/pathUtils");
const git_1 = require("../../node/git");
const result_1 = require("../../common/types/result");
const fsPromises = __importStar(require("fs/promises"));
const disposableExec_1 = require("../../node/utils/disposableExec");
const fileCompletionsIndex_1 = require("../../node/services/fileCompletionsIndex");
const log_1 = require("../../node/services/log");
const path = __importStar(require("path"));
const paths_1 = require("../../common/constants/paths");
const tildeExpansion_1 = require("../../node/runtime/tildeExpansion");
/**
 * List directory contents for the DirectoryPickerModal.
 * Returns a FileTreeNode where:
 * - name and path are the resolved absolute path of the requested directory
 * - children are the immediate subdirectories (not recursive)
 */
async function listDirectory(requestedPath) {
    // Expand ~ to home directory (path.resolve doesn't handle tilde)
    const expanded = requestedPath === "~" || requestedPath.startsWith("~/") || requestedPath.startsWith("~\\")
        ? (0, tildeExpansion_1.expandTilde)(requestedPath)
        : requestedPath;
    const normalizedRoot = path.resolve(expanded || ".");
    const entries = await fsPromises.readdir(normalizedRoot, { withFileTypes: true });
    const children = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
        const entryPath = path.join(normalizedRoot, entry.name);
        return {
            name: entry.name,
            path: entryPath,
            isDirectory: true,
            children: [],
        };
    });
    return {
        name: normalizedRoot,
        path: normalizedRoot,
        isDirectory: true,
        children,
    };
}
const FILE_COMPLETIONS_CACHE_TTL_MS = 10_000;
class ProjectService {
    config;
    fileCompletionsCache = new Map();
    directoryPicker;
    constructor(config) {
        this.config = config;
    }
    setDirectoryPicker(picker) {
        this.directoryPicker = picker;
    }
    async pickDirectory() {
        if (!this.directoryPicker)
            return null;
        return this.directoryPicker();
    }
    async create(projectPath) {
        try {
            // Validate input
            if (!projectPath || projectPath.trim().length === 0) {
                return (0, result_1.Err)("Project path cannot be empty");
            }
            // Resolve the path:
            // - Bare names like "my-project" → ~/.unix/projects/my-project
            // - Paths with ~ → expand to home directory
            // - Absolute/relative paths → resolve normally
            const isBareProjectName = projectPath.length > 0 &&
                !projectPath.includes("/") &&
                !projectPath.includes("\\") &&
                !projectPath.startsWith("~");
            let normalizedPath;
            if (isBareProjectName) {
                // Bare project name - put in default projects directory
                normalizedPath = path.join((0, paths_1.getMuxProjectsDir)(), projectPath);
            }
            else if (projectPath === "~" ||
                projectPath.startsWith("~/") ||
                projectPath.startsWith("~\\")) {
                // Tilde expansion - uses expandTilde to respect UNIX_ROOT for ~/.unix paths
                normalizedPath = path.resolve((0, tildeExpansion_1.expandTilde)(projectPath));
            }
            else {
                normalizedPath = path.resolve(projectPath);
            }
            let existingStat = null;
            try {
                existingStat = await fsPromises.stat(normalizedPath);
            }
            catch (error) {
                const err = error;
                if (err.code !== "ENOENT") {
                    throw error;
                }
            }
            if (existingStat && !existingStat.isDirectory()) {
                return (0, result_1.Err)("Project path is not a directory");
            }
            const config = this.config.loadConfigOrDefault();
            if (config.projects.has(normalizedPath)) {
                return (0, result_1.Err)("Project already exists");
            }
            // Create the directory if it doesn't exist (like mkdir -p)
            await fsPromises.mkdir(normalizedPath, { recursive: true });
            const projectConfig = { workspaces: [] };
            config.projects.set(normalizedPath, projectConfig);
            await this.config.saveConfig(config);
            return (0, result_1.Ok)({ projectConfig, normalizedPath });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to create project: ${message}`);
        }
    }
    async remove(projectPath) {
        try {
            const config = this.config.loadConfigOrDefault();
            const projectConfig = config.projects.get(projectPath);
            if (!projectConfig) {
                return (0, result_1.Err)("Project not found");
            }
            if (projectConfig.workspaces.length > 0) {
                return (0, result_1.Err)(`Cannot remove project with active workspaces. Please remove all ${projectConfig.workspaces.length} workspace(s) first.`);
            }
            config.projects.delete(projectPath);
            await this.config.saveConfig(config);
            try {
                await this.config.updateProjectSecrets(projectPath, []);
            }
            catch (error) {
                log_1.log.error(`Failed to clean up secrets for project ${projectPath}:`, error);
            }
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to remove project: ${message}`);
        }
    }
    list() {
        try {
            const config = this.config.loadConfigOrDefault();
            return Array.from(config.projects.entries());
        }
        catch (error) {
            log_1.log.error("Failed to list projects:", error);
            return [];
        }
    }
    async listBranches(projectPath) {
        if (typeof projectPath !== "string" || projectPath.trim().length === 0) {
            throw new Error("Project path is required to list branches");
        }
        try {
            const validation = await (0, pathUtils_1.validateProjectPath)(projectPath);
            if (!validation.valid) {
                throw new Error(validation.error ?? "Invalid project path");
            }
            const normalizedPath = validation.expandedPath;
            // Non-git repos return empty branches - they're restricted to local runtime only
            if (!(await (0, pathUtils_1.isGitRepository)(normalizedPath))) {
                return { branches: [], recommendedTrunk: null };
            }
            const branches = await (0, git_1.listLocalBranches)(normalizedPath);
            // Empty branches means the repo is unborn (git init but no commits yet)
            // Return empty branches - frontend will show the git init banner since no branches exist
            // After user creates a commit, branches will populate
            if (branches.length === 0) {
                return { branches: [], recommendedTrunk: null };
            }
            const recommendedTrunk = await (0, git_1.detectDefaultTrunkBranch)(normalizedPath, branches);
            return { branches, recommendedTrunk };
        }
        catch (error) {
            log_1.log.error("Failed to list branches:", error);
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
    /**
     * Initialize a git repository in the project directory.
     * Runs `git init` and creates an initial commit so branches exist.
     * Also handles "unborn" repos (git init already run but no commits yet).
     */
    async gitInit(projectPath) {
        if (typeof projectPath !== "string" || projectPath.trim().length === 0) {
            return (0, result_1.Err)("Project path is required");
        }
        try {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                const validation = await (0, pathUtils_1.validateProjectPath)(projectPath);
                if (!validation.valid) {
                    return (0, result_1.Err)(validation.error ?? "Invalid project path");
                }
                const normalizedPath = validation.expandedPath;
                const isGitRepo = await (0, pathUtils_1.isGitRepository)(normalizedPath);
                if (isGitRepo) {
                    // Check if repo is "unborn" (git init but no commits yet)
                    const branches = await (0, git_1.listLocalBranches)(normalizedPath);
                    if (branches.length > 0) {
                        return (0, result_1.Err)("Directory is already a git repository with commits");
                    }
                    // Repo exists but is unborn - just create the initial commit
                }
                else {
                    const env_2 = { stack: [], error: void 0, hasError: false };
                    try {
                        // Initialize git repository with main as default branch
                        const initProc = __addDisposableResource(env_2, (0, disposableExec_1.execAsync)(`git -C "${normalizedPath}" init -b main`), false);
                        await initProc.result;
                    }
                    catch (e_1) {
                        env_2.error = e_1;
                        env_2.hasError = true;
                    }
                    finally {
                        __disposeResources(env_2);
                    }
                }
                // Create an initial empty commit so the branch exists and worktree/SSH can work
                // Without a commit, the repo is "unborn" and has no branches
                // Use -c flags to set identity only for this commit (don't persist to repo config)
                const commitProc = __addDisposableResource(env_1, (0, disposableExec_1.execAsync)(`git -C "${normalizedPath}" -c user.name="unix" -c user.email="unix@localhost" commit --allow-empty -m "Initial commit"`), false);
                await commitProc.result;
                // Invalidate file completions cache since the repo state changed
                this.fileCompletionsCache.delete(normalizedPath);
                return (0, result_1.Ok)(undefined);
            }
            catch (e_2) {
                env_1.error = e_2;
                env_1.hasError = true;
            }
            finally {
                __disposeResources(env_1);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log_1.log.error("Failed to initialize git repository:", error);
            return (0, result_1.Err)(`Failed to initialize git repository: ${message}`);
        }
    }
    async getFileCompletions(projectPath, query, limit) {
        const resolvedLimit = limit ?? 20;
        if (typeof projectPath !== "string" || projectPath.trim().length === 0) {
            return { paths: [] };
        }
        const validation = await (0, pathUtils_1.validateProjectPath)(projectPath);
        if (!validation.valid) {
            return { paths: [] };
        }
        const normalizedPath = validation.expandedPath;
        let cacheEntry = this.fileCompletionsCache.get(normalizedPath);
        if (!cacheEntry) {
            cacheEntry = { index: fileCompletionsIndex_1.EMPTY_FILE_COMPLETIONS_INDEX, fetchedAt: 0 };
            this.fileCompletionsCache.set(normalizedPath, cacheEntry);
        }
        const now = Date.now();
        const isStale = cacheEntry.fetchedAt === 0 || now - cacheEntry.fetchedAt > FILE_COMPLETIONS_CACHE_TTL_MS;
        if (isStale && !cacheEntry.refreshing) {
            cacheEntry.refreshing = (async () => {
                try {
                    const env_3 = { stack: [], error: void 0, hasError: false };
                    try {
                        if (!(await (0, pathUtils_1.isGitRepository)(normalizedPath))) {
                            cacheEntry.index = fileCompletionsIndex_1.EMPTY_FILE_COMPLETIONS_INDEX;
                            return;
                        }
                        const proc = __addDisposableResource(env_3, (0, disposableExec_1.execAsync)(`git -C "${normalizedPath}" ls-files -co --exclude-standard`), false);
                        const { stdout } = await proc.result;
                        const files = stdout
                            .split("\n")
                            .map((line) => line.trim())
                            .filter((line) => line.length > 0)
                            // File @mentions are whitespace-delimited (extractAtMentions uses /@(\\S+)/), so
                            // suggestions containing spaces would be inserted incorrectly (e.g. "@foo bar.ts").
                            .filter((filePath) => !/\s/.test(filePath));
                        cacheEntry.index = (0, fileCompletionsIndex_1.buildFileCompletionsIndex)(files);
                    }
                    catch (e_3) {
                        env_3.error = e_3;
                        env_3.hasError = true;
                    }
                    finally {
                        __disposeResources(env_3);
                    }
                }
                catch (error) {
                    log_1.log.debug("getFileCompletions: failed to list files", {
                        projectPath: normalizedPath,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
                finally {
                    cacheEntry.fetchedAt = Date.now();
                    cacheEntry.refreshing = undefined;
                }
            })();
        }
        if (cacheEntry.fetchedAt === 0 && cacheEntry.refreshing) {
            await cacheEntry.refreshing;
        }
        return { paths: (0, fileCompletionsIndex_1.searchFileCompletions)(cacheEntry.index, query, resolvedLimit) };
    }
    getSecrets(projectPath) {
        try {
            return this.config.getProjectSecrets(projectPath);
        }
        catch (error) {
            log_1.log.error("Failed to get project secrets:", error);
            return [];
        }
    }
    async listDirectory(path) {
        try {
            const tree = await listDirectory(path);
            return { success: true, data: tree };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async createDirectory(requestedPath) {
        try {
            // Expand ~ to home directory
            const expanded = requestedPath === "~" || requestedPath.startsWith("~/") || requestedPath.startsWith("~\\")
                ? (0, tildeExpansion_1.expandTilde)(requestedPath)
                : requestedPath;
            const normalizedPath = path.resolve(expanded);
            await fsPromises.mkdir(normalizedPath, { recursive: true });
            return (0, result_1.Ok)({ normalizedPath });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to create directory: ${message}`);
        }
    }
    async updateSecrets(projectPath, secrets) {
        try {
            await this.config.updateProjectSecrets(projectPath, secrets);
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to update project secrets: ${message}`);
        }
    }
    /**
     * Get idle compaction hours setting for a project.
     * Returns null if disabled or project not found.
     */
    getIdleCompactionHours(projectPath) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            return project?.idleCompactionHours ?? null;
        }
        catch (error) {
            log_1.log.error("Failed to get idle compaction hours:", error);
            return null;
        }
    }
    /**
     * Set idle compaction hours for a project.
     * Pass null to disable idle compaction.
     */
    async setIdleCompactionHours(projectPath, hours) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project) {
                return (0, result_1.Err)(`Project not found: ${projectPath}`);
            }
            project.idleCompactionHours = hours;
            await this.config.saveConfig(config);
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to set idle compaction hours: ${message}`);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Section Management
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * List all sections for a project, sorted by linked-list order.
     */
    listSections(projectPath) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project)
                return [];
            return (0, sections_1.sortSectionsByLinkedList)(project.sections ?? []);
        }
        catch (error) {
            log_1.log.error("Failed to list sections:", error);
            return [];
        }
    }
    /**
     * Create a new section in a project.
     */
    async createSection(projectPath, name, color) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project) {
                return (0, result_1.Err)(`Project not found: ${projectPath}`);
            }
            const sections = project.sections ?? [];
            const section = {
                id: (0, crypto_1.randomBytes)(4).toString("hex"),
                name,
                color: color ?? ui_1.DEFAULT_SECTION_COLOR,
                nextId: null, // new section is last
            };
            // Find current tail (nextId is null/undefined) and point it to new section
            const sorted = (0, sections_1.sortSectionsByLinkedList)(sections);
            if (sorted.length > 0) {
                const tail = sorted[sorted.length - 1];
                tail.nextId = section.id;
            }
            project.sections = [...sections, section];
            await this.config.saveConfig(config);
            return (0, result_1.Ok)(section);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to create section: ${message}`);
        }
    }
    /**
     * Update section name and/or color.
     */
    async updateSection(projectPath, sectionId, updates) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project) {
                return (0, result_1.Err)(`Project not found: ${projectPath}`);
            }
            const sections = project.sections ?? [];
            const sectionIndex = sections.findIndex((s) => s.id === sectionId);
            if (sectionIndex === -1) {
                return (0, result_1.Err)(`Section not found: ${sectionId}`);
            }
            const section = sections[sectionIndex];
            if (updates.name !== undefined)
                section.name = updates.name;
            if (updates.color !== undefined)
                section.color = updates.color;
            await this.config.saveConfig(config);
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to update section: ${message}`);
        }
    }
    /**
     * Remove a section. Only archived workspaces can remain in the section;
     * active workspaces block removal. Archived workspaces become unsectioned.
     */
    async removeSection(projectPath, sectionId) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project) {
                return (0, result_1.Err)(`Project not found: ${projectPath}`);
            }
            const sections = project.sections ?? [];
            const sectionIndex = sections.findIndex((s) => s.id === sectionId);
            if (sectionIndex === -1) {
                return (0, result_1.Err)(`Section not found: ${sectionId}`);
            }
            // Check for active (non-archived) workspaces in this section
            const workspacesInSection = project.workspaces.filter((w) => w.sectionId === sectionId);
            const activeWorkspaces = workspacesInSection.filter((w) => !(0, archive_1.isWorkspaceArchived)(w.archivedAt, w.unarchivedAt));
            if (activeWorkspaces.length > 0) {
                return (0, result_1.Err)(`Cannot remove section: ${activeWorkspaces.length} active workspace(s) still assigned. ` +
                    `Archive or move workspaces first.`);
            }
            // Remove sectionId from archived workspaces in this section
            for (const workspace of workspacesInSection) {
                workspace.sectionId = undefined;
            }
            // Remove the section
            project.sections = sections.filter((s) => s.id !== sectionId);
            await this.config.saveConfig(config);
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to remove section: ${message}`);
        }
    }
    /**
     * Reorder sections by providing the full ordered list of section IDs.
     */
    async reorderSections(projectPath, sectionIds) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project) {
                return (0, result_1.Err)(`Project not found: ${projectPath}`);
            }
            const sections = project.sections ?? [];
            const sectionMap = new Map(sections.map((s) => [s.id, s]));
            // Validate all IDs exist
            for (const id of sectionIds) {
                if (!sectionMap.has(id)) {
                    return (0, result_1.Err)(`Section not found: ${id}`);
                }
            }
            // Update nextId pointers based on array order
            for (let i = 0; i < sectionIds.length; i++) {
                const section = sectionMap.get(sectionIds[i]);
                section.nextId = i < sectionIds.length - 1 ? sectionIds[i + 1] : null;
            }
            await this.config.saveConfig(config);
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to reorder sections: ${message}`);
        }
    }
    /**
     * Assign a workspace to a section (or remove from section with null).
     */
    async assignWorkspaceToSection(projectPath, workspaceId, sectionId) {
        try {
            const config = this.config.loadConfigOrDefault();
            const project = config.projects.get(projectPath);
            if (!project) {
                return (0, result_1.Err)(`Project not found: ${projectPath}`);
            }
            // Validate section exists if not null
            if (sectionId !== null) {
                const sections = project.sections ?? [];
                if (!sections.some((s) => s.id === sectionId)) {
                    return (0, result_1.Err)(`Section not found: ${sectionId}`);
                }
            }
            // Find and update workspace
            const workspace = project.workspaces.find((w) => w.id === workspaceId);
            if (!workspace) {
                return (0, result_1.Err)(`Workspace not found: ${workspaceId}`);
            }
            workspace.sectionId = sectionId ?? undefined;
            await this.config.saveConfig(config);
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to assign workspace to section: ${message}`);
        }
    }
}
exports.ProjectService = ProjectService;
//# sourceMappingURL=projectService.js.map