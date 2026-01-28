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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const config_1 = require("../../node/config");
const projectService_1 = require("./projectService");
(0, bun_test_1.describe)("ProjectService", () => {
    let tempDir;
    let config;
    let service;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "projectservice-test-"));
        config = new config_1.Config(tempDir);
        service = new projectService_1.ProjectService(config);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.describe)("listDirectory", () => {
        (0, bun_test_1.it)("returns root node with the actual requested path, not empty string", async () => {
            // Create test directory structure
            const testDir = path.join(tempDir, "test-project");
            await fs.mkdir(testDir);
            await fs.mkdir(path.join(testDir, "subdir1"));
            await fs.mkdir(path.join(testDir, "subdir2"));
            await fs.writeFile(path.join(testDir, "file.txt"), "test");
            const result = await service.listDirectory(testDir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            // Critical regression test: root.path must be the actual path, not ""
            // This was broken when buildFileTree() was used, which always returns path: ""
            (0, bun_test_1.expect)(result.data.path).toBe(testDir);
            (0, bun_test_1.expect)(result.data.name).toBe(testDir);
            (0, bun_test_1.expect)(result.data.isDirectory).toBe(true);
        });
        (0, bun_test_1.it)("returns only immediate subdirectories as children", async () => {
            const testDir = path.join(tempDir, "nested");
            await fs.mkdir(testDir);
            await fs.mkdir(path.join(testDir, "child1"));
            await fs.mkdir(path.join(testDir, "child1", "grandchild")); // nested
            await fs.mkdir(path.join(testDir, "child2"));
            await fs.writeFile(path.join(testDir, "file.txt"), "test"); // file, not dir
            const result = await service.listDirectory(testDir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            // Should only have child1 and child2, not grandchild or file.txt
            (0, bun_test_1.expect)(result.data.children.length).toBe(2);
            const childNames = result.data.children.map((c) => c.name).sort();
            (0, bun_test_1.expect)(childNames).toEqual(["child1", "child2"]);
        });
        (0, bun_test_1.it)("children have correct full paths", async () => {
            const testDir = path.join(tempDir, "paths-test");
            await fs.mkdir(testDir);
            await fs.mkdir(path.join(testDir, "mysubdir"));
            const result = await service.listDirectory(testDir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            (0, bun_test_1.expect)(result.data.children.length).toBe(1);
            const child = result.data.children[0];
            (0, bun_test_1.expect)(child.name).toBe("mysubdir");
            (0, bun_test_1.expect)(child.path).toBe(path.join(testDir, "mysubdir"));
            (0, bun_test_1.expect)(child.isDirectory).toBe(true);
        });
        (0, bun_test_1.it)("resolves relative paths to absolute", async () => {
            // Create a subdir in tempDir
            const subdir = path.join(tempDir, "relative-test");
            await fs.mkdir(subdir);
            const result = await service.listDirectory(subdir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            // Should be resolved to absolute path
            (0, bun_test_1.expect)(path.isAbsolute(result.data.path)).toBe(true);
            (0, bun_test_1.expect)(result.data.path).toBe(subdir);
        });
        (0, bun_test_1.it)("handles empty directory", async () => {
            const emptyDir = path.join(tempDir, "empty");
            await fs.mkdir(emptyDir);
            const result = await service.listDirectory(emptyDir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            (0, bun_test_1.expect)(result.data.path).toBe(emptyDir);
            (0, bun_test_1.expect)(result.data.children).toEqual([]);
        });
        (0, bun_test_1.it)("handles '.' path by resolving to current working directory", async () => {
            // Save cwd and change to tempDir for this test
            const originalCwd = process.cwd();
            // Use realpath to resolve symlinks (e.g., /var -> /private/var on macOS)
            const realTempDir = await fs.realpath(tempDir);
            process.chdir(realTempDir);
            try {
                const result = await service.listDirectory(".");
                (0, bun_test_1.expect)(result.success).toBe(true);
                if (!result.success)
                    throw new Error("Expected success");
                (0, bun_test_1.expect)(result.data.path).toBe(realTempDir);
                (0, bun_test_1.expect)(path.isAbsolute(result.data.path)).toBe(true);
            }
            finally {
                process.chdir(originalCwd);
            }
        });
        (0, bun_test_1.it)("returns error for non-existent directory", async () => {
            const result = await service.listDirectory(path.join(tempDir, "does-not-exist"));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (result.success)
                throw new Error("Expected failure");
            (0, bun_test_1.expect)(result.error).toContain("ENOENT");
        });
        (0, bun_test_1.it)("expands ~ to home directory", async () => {
            const result = await service.listDirectory("~");
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            (0, bun_test_1.expect)(result.data.path).toBe(os.homedir());
        });
        (0, bun_test_1.it)("expands ~/subpath to home directory subpath", async () => {
            const result = await service.listDirectory("~/.");
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (!result.success)
                throw new Error("Expected success");
            (0, bun_test_1.expect)(result.data.path).toBe(os.homedir());
        });
    });
    (0, bun_test_1.describe)("gitInit", () => {
        (0, bun_test_1.it)("initializes git repo in non-git directory with initial commit", async () => {
            const testDir = path.join(tempDir, "new-project");
            await fs.mkdir(testDir);
            const result = await service.gitInit(testDir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            // Verify .git directory was created
            const gitDir = path.join(testDir, ".git");
            const stat = await fs.stat(gitDir);
            (0, bun_test_1.expect)(stat.isDirectory()).toBe(true);
            // Verify a branch exists (main) after the initial commit
            const branchResult = await service.listBranches(testDir);
            (0, bun_test_1.expect)(branchResult.branches).toContain("main");
            (0, bun_test_1.expect)(branchResult.recommendedTrunk).toBe("main");
        });
        (0, bun_test_1.it)("succeeds for unborn git repo (git init but no commits)", async () => {
            const testDir = path.join(tempDir, "unborn-git");
            await fs.mkdir(testDir);
            // Create an unborn repo (git init without commits)
            (0, child_process_1.execSync)("git init -b main", { cwd: testDir, stdio: "ignore" });
            const result = await service.gitInit(testDir);
            (0, bun_test_1.expect)(result.success).toBe(true);
            // Verify branch exists after the commit
            const branchResult = await service.listBranches(testDir);
            (0, bun_test_1.expect)(branchResult.branches).toContain("main");
        });
        (0, bun_test_1.it)("returns error for git repo with existing commits", async () => {
            const testDir = path.join(tempDir, "existing-git");
            await fs.mkdir(testDir);
            // Create a repo with a commit
            (0, child_process_1.execSync)("git init -b main", { cwd: testDir, stdio: "ignore" });
            (0, child_process_1.execSync)('git -c user.name="test" -c user.email="test@test" commit --allow-empty -m "test"', {
                cwd: testDir,
                stdio: "ignore",
            });
            const result = await service.gitInit(testDir);
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (result.success)
                throw new Error("Expected failure");
            (0, bun_test_1.expect)(result.error).toContain("already a git repository");
        });
        (0, bun_test_1.it)("returns error for empty project path", async () => {
            const result = await service.gitInit("");
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (result.success)
                throw new Error("Expected failure");
            (0, bun_test_1.expect)(result.error).toContain("required");
        });
        (0, bun_test_1.it)("returns error for non-existent directory", async () => {
            const result = await service.gitInit("/non-existent-path-12345");
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (result.success)
                throw new Error("Expected failure");
            (0, bun_test_1.expect)(result.error).toContain("does not exist");
        });
    });
});
//# sourceMappingURL=projectService.test.js.map