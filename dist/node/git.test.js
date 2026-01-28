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
const globals_1 = require("@jest/globals");
const git_1 = require("./git");
const config_1 = require("./config");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
// eslint-disable-next-line local/no-unsafe-child-process -- Test file needs direct exec access for setup
const execAsync = (0, util_1.promisify)(child_process_1.exec);
(0, globals_1.describe)("createWorktree", () => {
    let tempGitRepo;
    let config;
    let defaultTrunk;
    (0, globals_1.beforeAll)(async () => {
        // Create a temporary git repository for testing
        tempGitRepo = await fs.mkdtemp(path.join(os.tmpdir(), "unix-git-test-"));
        await execAsync(`git init`, { cwd: tempGitRepo });
        await execAsync(`git config user.email "test@example.com"`, { cwd: tempGitRepo });
        await execAsync(`git config user.name "Test User"`, { cwd: tempGitRepo });
        await execAsync(`git config commit.gpgsign false`, { cwd: tempGitRepo });
        await execAsync(`echo "test" > README.md`, { cwd: tempGitRepo });
        await execAsync(`git add .`, { cwd: tempGitRepo });
        await execAsync(`git commit -m "Initial commit"`, { cwd: tempGitRepo });
        // Create a branch with a slash in the name (like "docs/bash-timeout-ux")
        await execAsync(`git branch docs/bash-timeout-ux`, { cwd: tempGitRepo });
        // Create a config instance for testing
        const testConfigPath = path.join(tempGitRepo, "test-config.json");
        config = new config_1.Config(testConfigPath);
        defaultTrunk = await (0, git_1.detectDefaultTrunkBranch)(tempGitRepo);
    });
    (0, globals_1.afterAll)(async () => {
        // Cleanup temp repo
        try {
            await fs.rm(tempGitRepo, { recursive: true, force: true });
        }
        catch (error) {
            console.warn("Failed to cleanup temp git repo:", error);
        }
    });
    (0, globals_1.test)("should correctly detect branch does not exist when name is prefix of existing branch", async () => {
        // This tests the bug fix: "docs" is a prefix of "docs/bash-timeout-ux"
        // The old code would use .includes() which would match "remotes/origin/docs/bash-timeout-ux"
        // and incorrectly think "docs" exists, then try: git worktree add <path> "docs"
        // which fails with "invalid reference: docs"
        //
        // The fixed code correctly detects "docs" doesn't exist and tries: git worktree add -b "docs" <path>
        // However, Git itself won't allow creating "docs" when "docs/bash-timeout-ux" exists
        // due to ref namespace conflicts, so this will fail with a different, more informative error.
        const result = await (0, git_1.createWorktree)(config, tempGitRepo, "docs", {
            trunkBranch: defaultTrunk,
        });
        // Should fail, but with a ref lock error (not "invalid reference")
        (0, globals_1.expect)(result.success).toBe(false);
        (0, globals_1.expect)(result.error).toContain("cannot lock ref");
        (0, globals_1.expect)(result.error).toContain("docs/bash-timeout-ux");
        // The old buggy code would have failed with "invalid reference: docs"
        (0, globals_1.expect)(result.error).not.toContain("invalid reference");
    });
    (0, globals_1.test)("should use existing branch when exact match exists", async () => {
        // Create a branch first
        await execAsync(`git branch existing-branch`, { cwd: tempGitRepo });
        const result = await (0, git_1.createWorktree)(config, tempGitRepo, "existing-branch", {
            trunkBranch: defaultTrunk,
        });
        // Should succeed by using the existing branch
        (0, globals_1.expect)(result.success).toBe(true);
        (0, globals_1.expect)(result.path).toBeDefined();
        // Verify the worktree was created
        const { stdout } = await execAsync(`git worktree list`, { cwd: tempGitRepo });
        (0, globals_1.expect)(stdout).toContain("existing-branch");
    });
    (0, globals_1.test)("listLocalBranches should return sorted branch names", async () => {
        const uniqueSuffix = Date.now().toString(36);
        const newBranches = [`zz-${uniqueSuffix}`, `aa-${uniqueSuffix}`, `mid/${uniqueSuffix}`];
        for (const branch of newBranches) {
            await execAsync(`git branch ${branch}`, { cwd: tempGitRepo });
        }
        const branches = await (0, git_1.listLocalBranches)(tempGitRepo);
        for (const branch of newBranches) {
            (0, globals_1.expect)(branches).toContain(branch);
        }
        for (let i = 1; i < branches.length; i += 1) {
            (0, globals_1.expect)(branches[i - 1].localeCompare(branches[i])).toBeLessThanOrEqual(0);
        }
    });
});
(0, globals_1.describe)("cleanStaleLock", () => {
    let tempDir;
    (0, globals_1.beforeAll)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-lock-test-"));
        await fs.mkdir(path.join(tempDir, ".git"));
    });
    (0, globals_1.afterAll)(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    (0, globals_1.test)("removes lock file older than threshold", async () => {
        const lockPath = path.join(tempDir, ".git", "index.lock");
        // Create a lock file with old mtime
        await fs.writeFile(lockPath, "lock");
        const oldTime = Date.now() - 10000; // 10 seconds ago
        fsSync.utimesSync(lockPath, oldTime / 1000, oldTime / 1000);
        (0, git_1.cleanStaleLock)(tempDir);
        // Lock should be removed
        (0, globals_1.expect)(fsSync.existsSync(lockPath)).toBe(false);
    });
    (0, globals_1.test)("does not remove recent lock file", async () => {
        const lockPath = path.join(tempDir, ".git", "index.lock");
        // Create a fresh lock file (now)
        await fs.writeFile(lockPath, "lock");
        (0, git_1.cleanStaleLock)(tempDir);
        // Lock should still exist (it's too recent)
        (0, globals_1.expect)(fsSync.existsSync(lockPath)).toBe(true);
        // Cleanup
        await fs.unlink(lockPath);
    });
    (0, globals_1.test)("does nothing when no lock exists", () => {
        // Should not throw
        (0, git_1.cleanStaleLock)(tempDir);
    });
});
//# sourceMappingURL=git.test.js.map