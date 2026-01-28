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
const bun_test_1 = require("bun:test");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fsPromises = __importStar(require("fs/promises"));
const node_child_process_1 = require("node:child_process");
const WorktreeManager_1 = require("./WorktreeManager");
function initGitRepo(projectPath) {
    (0, node_child_process_1.execSync)("git init -b main", { cwd: projectPath, stdio: "ignore" });
    (0, node_child_process_1.execSync)('git config user.email "test@example.com"', { cwd: projectPath, stdio: "ignore" });
    (0, node_child_process_1.execSync)('git config user.name "test"', { cwd: projectPath, stdio: "ignore" });
    // Ensure tests don't hang when developers have global commit signing enabled.
    (0, node_child_process_1.execSync)("git config commit.gpgsign false", { cwd: projectPath, stdio: "ignore" });
    (0, node_child_process_1.execSync)("bash -lc 'echo \"hello\" > README.md'", { cwd: projectPath, stdio: "ignore" });
    (0, node_child_process_1.execSync)("git add README.md", { cwd: projectPath, stdio: "ignore" });
    (0, node_child_process_1.execSync)('git commit -m "init"', { cwd: projectPath, stdio: "ignore" });
}
function createNullInitLogger() {
    return {
        logStep: (_message) => undefined,
        logStdout: (_line) => undefined,
        logStderr: (_line) => undefined,
        logComplete: (_exitCode) => undefined,
    };
}
(0, bun_test_1.describe)("WorktreeManager constructor", () => {
    (0, bun_test_1.it)("should expand tilde in srcBaseDir", () => {
        const manager = new WorktreeManager_1.WorktreeManager("~/workspace");
        const workspacePath = manager.getWorkspacePath("/home/user/project", "branch");
        // The workspace path should use the expanded home directory
        const expected = path.join(os.homedir(), "workspace", "project", "branch");
        (0, bun_test_1.expect)(workspacePath).toBe(expected);
    });
    (0, bun_test_1.it)("should handle absolute paths without expansion", () => {
        const manager = new WorktreeManager_1.WorktreeManager("/absolute/path");
        const workspacePath = manager.getWorkspacePath("/home/user/project", "branch");
        const expected = path.join("/absolute/path", "project", "branch");
        (0, bun_test_1.expect)(workspacePath).toBe(expected);
    });
    (0, bun_test_1.it)("should handle bare tilde", () => {
        const manager = new WorktreeManager_1.WorktreeManager("~");
        const workspacePath = manager.getWorkspacePath("/home/user/project", "branch");
        const expected = path.join(os.homedir(), "project", "branch");
        (0, bun_test_1.expect)(workspacePath).toBe(expected);
    });
});
(0, bun_test_1.describe)("WorktreeManager.deleteWorkspace", () => {
    (0, bun_test_1.it)("deletes non-agent branches when removing worktrees (force)", async () => {
        const rootDir = await fsPromises.realpath(await fsPromises.mkdtemp(path.join(os.tmpdir(), "worktree-manager-delete-")));
        try {
            const projectPath = path.join(rootDir, "repo");
            await fsPromises.mkdir(projectPath, { recursive: true });
            initGitRepo(projectPath);
            const srcBaseDir = path.join(rootDir, "src");
            await fsPromises.mkdir(srcBaseDir, { recursive: true });
            const manager = new WorktreeManager_1.WorktreeManager(srcBaseDir);
            const initLogger = createNullInitLogger();
            const branchName = "feature_aaaaaaaaaa";
            const createResult = await manager.createWorkspace({
                projectPath,
                branchName,
                trunkBranch: "main",
                initLogger,
            });
            (0, bun_test_1.expect)(createResult.success).toBe(true);
            if (!createResult.success)
                return;
            if (!createResult.workspacePath) {
                throw new Error("Expected workspacePath from createWorkspace");
            }
            const workspacePath = createResult.workspacePath;
            // Make the branch unmerged (so -d would fail); force delete should still delete it.
            (0, node_child_process_1.execSync)("bash -lc 'echo \"change\" >> README.md'", {
                cwd: workspacePath,
                stdio: "ignore",
            });
            (0, node_child_process_1.execSync)("git add README.md", { cwd: workspacePath, stdio: "ignore" });
            (0, node_child_process_1.execSync)('git commit -m "change"', { cwd: workspacePath, stdio: "ignore" });
            const deleteResult = await manager.deleteWorkspace(projectPath, branchName, true);
            (0, bun_test_1.expect)(deleteResult.success).toBe(true);
            const after = (0, node_child_process_1.execSync)(`git branch --list "${branchName}"`, {
                cwd: projectPath,
                stdio: ["ignore", "pipe", "ignore"],
            })
                .toString()
                .trim();
            (0, bun_test_1.expect)(after).toBe("");
        }
        finally {
            await fsPromises.rm(rootDir, { recursive: true, force: true });
        }
    }, 20_000);
    (0, bun_test_1.it)("deletes merged branches when removing worktrees (safe delete)", async () => {
        const rootDir = await fsPromises.realpath(await fsPromises.mkdtemp(path.join(os.tmpdir(), "worktree-manager-delete-")));
        try {
            const projectPath = path.join(rootDir, "repo");
            await fsPromises.mkdir(projectPath, { recursive: true });
            initGitRepo(projectPath);
            const srcBaseDir = path.join(rootDir, "src");
            await fsPromises.mkdir(srcBaseDir, { recursive: true });
            const manager = new WorktreeManager_1.WorktreeManager(srcBaseDir);
            const initLogger = createNullInitLogger();
            const branchName = "feature_merge_aaaaaaaaaa";
            const createResult = await manager.createWorkspace({
                projectPath,
                branchName,
                trunkBranch: "main",
                initLogger,
            });
            (0, bun_test_1.expect)(createResult.success).toBe(true);
            if (!createResult.success)
                return;
            if (!createResult.workspacePath) {
                throw new Error("Expected workspacePath from createWorkspace");
            }
            const workspacePath = createResult.workspacePath;
            // Commit on the workspace branch.
            (0, node_child_process_1.execSync)("bash -lc 'echo \"merged-change\" >> README.md'", {
                cwd: workspacePath,
                stdio: "ignore",
            });
            (0, node_child_process_1.execSync)("git add README.md", { cwd: workspacePath, stdio: "ignore" });
            (0, node_child_process_1.execSync)('git commit -m "merged-change"', {
                cwd: workspacePath,
                stdio: "ignore",
            });
            // Merge into main so `git branch -d` succeeds.
            (0, node_child_process_1.execSync)(`git merge "${branchName}"`, { cwd: projectPath, stdio: "ignore" });
            const deleteResult = await manager.deleteWorkspace(projectPath, branchName, false);
            (0, bun_test_1.expect)(deleteResult.success).toBe(true);
            const after = (0, node_child_process_1.execSync)(`git branch --list "${branchName}"`, {
                cwd: projectPath,
                stdio: ["ignore", "pipe", "ignore"],
            })
                .toString()
                .trim();
            (0, bun_test_1.expect)(after).toBe("");
        }
        finally {
            await fsPromises.rm(rootDir, { recursive: true, force: true });
        }
    }, 20_000);
    (0, bun_test_1.it)("does not delete protected branches", async () => {
        const rootDir = await fsPromises.realpath(await fsPromises.mkdtemp(path.join(os.tmpdir(), "worktree-manager-delete-")));
        try {
            const projectPath = path.join(rootDir, "repo");
            await fsPromises.mkdir(projectPath, { recursive: true });
            initGitRepo(projectPath);
            // Move the main worktree off main so we can add a separate worktree on main.
            (0, node_child_process_1.execSync)("git checkout -b other", { cwd: projectPath, stdio: "ignore" });
            const srcBaseDir = path.join(rootDir, "src");
            await fsPromises.mkdir(srcBaseDir, { recursive: true });
            const manager = new WorktreeManager_1.WorktreeManager(srcBaseDir);
            const initLogger = createNullInitLogger();
            const branchName = "main";
            const createResult = await manager.createWorkspace({
                projectPath,
                branchName,
                trunkBranch: "main",
                initLogger,
            });
            (0, bun_test_1.expect)(createResult.success).toBe(true);
            if (!createResult.success)
                return;
            if (!createResult.workspacePath) {
                throw new Error("Expected workspacePath from createWorkspace");
            }
            const workspacePath = createResult.workspacePath;
            const deleteResult = await manager.deleteWorkspace(projectPath, branchName, true);
            (0, bun_test_1.expect)(deleteResult.success).toBe(true);
            // The worktree directory should be removed.
            let worktreeExists = true;
            try {
                await fsPromises.access(workspacePath);
            }
            catch {
                worktreeExists = false;
            }
            (0, bun_test_1.expect)(worktreeExists).toBe(false);
            // But protected branches (like main) should never be deleted.
            const after = (0, node_child_process_1.execSync)(`git branch --list "${branchName}"`, {
                cwd: projectPath,
                stdio: ["ignore", "pipe", "ignore"],
            })
                .toString()
                .trim();
            (0, bun_test_1.expect)(after).toBe("main");
        }
        finally {
            await fsPromises.rm(rootDir, { recursive: true, force: true });
        }
    }, 20_000);
});
//# sourceMappingURL=WorktreeManager.test.js.map