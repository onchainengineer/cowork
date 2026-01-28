"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreeRuntime = void 0;
const initHook_1 = require("./initHook");
const LocalBaseRuntime_1 = require("./LocalBaseRuntime");
const errors_1 = require("../../common/utils/errors");
const WorktreeManager_1 = require("../../node/worktree/WorktreeManager");
/**
 * Worktree runtime implementation that executes commands and file operations
 * directly on the host machine using Node.js APIs.
 *
 * This runtime uses git worktrees for workspace isolation:
 * - Workspaces are created in {srcBaseDir}/{projectName}/{workspaceName}
 * - Each workspace is a git worktree with its own branch
 */
class WorktreeRuntime extends LocalBaseRuntime_1.LocalBaseRuntime {
    worktreeManager;
    constructor(srcBaseDir) {
        super();
        this.worktreeManager = new WorktreeManager_1.WorktreeManager(srcBaseDir);
    }
    getWorkspacePath(projectPath, workspaceName) {
        return this.worktreeManager.getWorkspacePath(projectPath, workspaceName);
    }
    async createWorkspace(params) {
        return this.worktreeManager.createWorkspace({
            projectPath: params.projectPath,
            branchName: params.branchName,
            trunkBranch: params.trunkBranch,
            initLogger: params.initLogger,
        });
    }
    async initWorkspace(params) {
        const { projectPath, branchName, workspacePath, initLogger, env, skipInitHook } = params;
        try {
            if (skipInitHook) {
                initLogger.logStep("Skipping .unix/init hook (disabled for this task)");
                initLogger.logComplete(0);
                return { success: true };
            }
            // Run .unix/init hook if it exists
            // Note: runInitHook calls logComplete() internally if hook exists
            const hookExists = await (0, initHook_1.checkInitHookExists)(projectPath);
            if (hookExists) {
                const muxEnv = { ...env, ...(0, initHook_1.getUnixEnv)(projectPath, "worktree", branchName) };
                await this.runInitHook(workspacePath, muxEnv, initLogger);
            }
            else {
                // No hook - signal completion immediately
                initLogger.logComplete(0);
            }
            return { success: true };
        }
        catch (error) {
            const errorMsg = (0, errors_1.getErrorMessage)(error);
            initLogger.logStderr(`Initialization failed: ${errorMsg}`);
            initLogger.logComplete(-1);
            return {
                success: false,
                error: errorMsg,
            };
        }
    }
    async renameWorkspace(projectPath, oldName, newName, _abortSignal) {
        // Note: _abortSignal ignored for local operations (fast, no need for cancellation)
        return this.worktreeManager.renameWorkspace(projectPath, oldName, newName);
    }
    async deleteWorkspace(projectPath, workspaceName, force, _abortSignal) {
        // Note: _abortSignal ignored for local operations (fast, no need for cancellation)
        return this.worktreeManager.deleteWorkspace(projectPath, workspaceName, force);
    }
    async forkWorkspace(params) {
        return this.worktreeManager.forkWorkspace(params);
    }
}
exports.WorktreeRuntime = WorktreeRuntime;
//# sourceMappingURL=WorktreeRuntime.js.map