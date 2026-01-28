"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const fileCommon_1 = require("./fileCommon");
const runtimeFactory_1 = require("../../../node/runtime/runtimeFactory");
(0, bun_test_1.describe)("fileCommon", () => {
    (0, bun_test_1.describe)("validateFileSize", () => {
        (0, bun_test_1.it)("should return null for files within size limit", () => {
            const stats = {
                size: 1024, // 1KB
                modifiedTime: new Date(),
                isDirectory: false,
            };
            (0, bun_test_1.expect)((0, fileCommon_1.validateFileSize)(stats)).toBeNull();
        });
        (0, bun_test_1.it)("should return null for files at exactly the limit", () => {
            const stats = {
                size: fileCommon_1.MAX_FILE_SIZE,
                modifiedTime: new Date(),
                isDirectory: false,
            };
            (0, bun_test_1.expect)((0, fileCommon_1.validateFileSize)(stats)).toBeNull();
        });
        (0, bun_test_1.it)("should return error for files exceeding size limit", () => {
            const stats = {
                size: fileCommon_1.MAX_FILE_SIZE + 1,
                modifiedTime: new Date(),
                isDirectory: false,
            };
            const result = (0, fileCommon_1.validateFileSize)(stats);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("too large");
            (0, bun_test_1.expect)(result?.error).toContain("system tools");
        });
        (0, bun_test_1.it)("should include size information in error message", () => {
            const stats = {
                size: fileCommon_1.MAX_FILE_SIZE * 2, // 2MB
                modifiedTime: new Date(),
                isDirectory: false,
            };
            const result = (0, fileCommon_1.validateFileSize)(stats);
            (0, bun_test_1.expect)(result?.error).toContain("2.00MB");
            (0, bun_test_1.expect)(result?.error).toContain("1.00MB");
        });
        (0, bun_test_1.it)("should suggest alternative tools in error message", () => {
            const stats = {
                size: fileCommon_1.MAX_FILE_SIZE + 1,
                modifiedTime: new Date(),
                isDirectory: false,
            };
            const result = (0, fileCommon_1.validateFileSize)(stats);
            (0, bun_test_1.expect)(result?.error).toContain("grep");
            (0, bun_test_1.expect)(result?.error).toContain("sed");
        });
    });
    (0, bun_test_1.describe)("validatePathInCwd", () => {
        const cwd = "/workspace/project";
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: cwd });
        (0, bun_test_1.it)("should allow relative paths within cwd", () => {
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("src/file.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("./src/file.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("file.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should allow absolute paths within extraAllowedDirs", () => {
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("/tmp/test.txt", cwd, runtime, ["/tmp"])).toBeNull();
        });
        (0, bun_test_1.it)("should reject absolute paths outside cwd and extraAllowedDirs", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("/etc/passwd", cwd, runtime, ["/tmp"]);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("restricted to the workspace directory");
        });
        (0, bun_test_1.it)("should allow absolute paths within cwd", () => {
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("/workspace/project/src/file.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("/workspace/project/file.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should reject paths that go up and outside cwd with ..", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("../outside.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("restricted to the workspace directory");
            (0, bun_test_1.expect)(result?.error).toContain("/workspace/project");
        });
        (0, bun_test_1.it)("should reject paths that go multiple levels up", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("../../outside.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("restricted to the workspace directory");
        });
        (0, bun_test_1.it)("should reject paths that go down then up outside cwd", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("src/../../outside.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("restricted to the workspace directory");
        });
        (0, bun_test_1.it)("should reject absolute paths outside cwd", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("/etc/passwd", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("restricted to the workspace directory");
        });
        (0, bun_test_1.it)("should reject absolute paths in different directory tree", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("/home/user/file.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("restricted to the workspace directory");
        });
        (0, bun_test_1.it)("should handle paths with trailing slashes", () => {
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("src/", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should handle nested paths correctly", () => {
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("src/components/Button/index.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("./src/components/Button/index.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should provide helpful error message mentioning to ask user", () => {
            const result = (0, fileCommon_1.validatePathInCwd)("../outside.ts", cwd, runtime);
            (0, bun_test_1.expect)(result?.error).toContain("ask the user for permission");
        });
        (0, bun_test_1.it)("should work with cwd that has trailing slash", () => {
            const cwdWithSlash = "/workspace/project/";
            (0, bun_test_1.expect)((0, fileCommon_1.validatePathInCwd)("src/file.ts", cwdWithSlash, runtime)).toBeNull();
            const result = (0, fileCommon_1.validatePathInCwd)("../outside.ts", cwdWithSlash, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
        });
    });
    (0, bun_test_1.describe)("validateNoRedundantPrefix", () => {
        const cwd = "/workspace/project";
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: cwd });
        (0, bun_test_1.it)("should allow relative paths", () => {
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("src/file.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("./src/file.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("file.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should auto-correct absolute paths that contain the cwd prefix", () => {
            const result = (0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project/src/file.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.correctedPath).toBe("src/file.ts");
            (0, bun_test_1.expect)(result?.warning).toContain("Using relative paths");
            (0, bun_test_1.expect)(result?.warning).toContain("saves tokens");
            (0, bun_test_1.expect)(result?.warning).toContain("auto-corrected");
        });
        (0, bun_test_1.it)("should auto-correct absolute paths at the cwd root", () => {
            const result = (0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project/file.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.correctedPath).toBe("file.ts");
            (0, bun_test_1.expect)(result?.warning).toContain("auto-corrected");
        });
        (0, bun_test_1.it)("should allow absolute paths outside cwd (they will be caught by validatePathInCwd)", () => {
            // This validation only catches redundant prefixes, not paths outside cwd
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("/etc/passwd", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("/home/user/file.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should handle paths with ..", () => {
            // Relative paths with .. are fine for this check
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("../outside.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("src/../../outside.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should work with cwd that has trailing slash", () => {
            const cwdWithSlash = "/workspace/project/";
            const result = (0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project/src/file.ts", cwdWithSlash, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.correctedPath).toBe("src/file.ts");
            (0, bun_test_1.expect)(result?.warning).toContain("auto-corrected");
        });
        (0, bun_test_1.it)("should handle nested paths correctly", () => {
            const result = (0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project/src/components/Button/index.ts", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.correctedPath).toBe("src/components/Button/index.ts");
            (0, bun_test_1.expect)(result?.warning).toContain("auto-corrected");
        });
        (0, bun_test_1.it)("should auto-correct path that equals cwd exactly", () => {
            const result = (0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project", cwd, runtime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.correctedPath).toBe(".");
            (0, bun_test_1.expect)(result?.warning).toContain("auto-corrected");
        });
        (0, bun_test_1.it)("should not match partial directory names", () => {
            // /workspace/project2 should NOT match /workspace/project
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project2/file.ts", cwd, runtime)).toBeNull();
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("/workspace/project-old/file.ts", cwd, runtime)).toBeNull();
        });
        (0, bun_test_1.it)("should work with SSH runtime", () => {
            const sshRuntime = (0, runtimeFactory_1.createRuntime)({
                type: "ssh",
                host: "user@localhost",
                srcBaseDir: "/home/user/unix",
                identityFile: "/tmp/fake-key",
            });
            const sshCwd = "/home/user/unix/project/branch";
            // Should auto-correct absolute paths with redundant prefix on SSH too
            const result = (0, fileCommon_1.validateNoRedundantPrefix)("/home/user/unix/project/branch/src/file.ts", sshCwd, sshRuntime);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.correctedPath).toBe("src/file.ts");
            (0, bun_test_1.expect)(result?.warning).toContain("auto-corrected");
            // Should allow relative paths on SSH
            (0, bun_test_1.expect)((0, fileCommon_1.validateNoRedundantPrefix)("src/file.ts", sshCwd, sshRuntime)).toBeNull();
        });
    });
    (0, bun_test_1.describe)("validatePlanModeAccess", () => {
        const planFilePath = "~/.unix/plans/plan.md";
        const resolvedPlanFilePath = "/home/user/.unix/plans/plan.md";
        const mockRuntime = {
            resolvePath: (targetPath) => {
                if (targetPath === planFilePath) {
                    return Promise.resolve(resolvedPlanFilePath);
                }
                if (targetPath === resolvedPlanFilePath) {
                    return Promise.resolve(resolvedPlanFilePath);
                }
                if (targetPath === "src/main.ts") {
                    return Promise.resolve("/home/user/project/src/main.ts");
                }
                return Promise.resolve(targetPath);
            },
        };
        const config = {
            cwd: "/home/user/project",
            runtime: mockRuntime,
            runtimeTempDir: "/tmp",
            planFileOnly: true,
            planFilePath,
        };
        (0, bun_test_1.it)("should allow editing when filePath is exactly planFilePath", async () => {
            (0, bun_test_1.expect)(await (0, fileCommon_1.validatePlanModeAccess)(planFilePath, config)).toBeNull();
        });
        (0, bun_test_1.it)("should reject alternate paths that resolve to the plan file", async () => {
            const result = await (0, fileCommon_1.validatePlanModeAccess)(resolvedPlanFilePath, config);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("exact plan file path");
            (0, bun_test_1.expect)(result?.error).toContain(planFilePath);
            (0, bun_test_1.expect)(result?.error).toContain(resolvedPlanFilePath);
            (0, bun_test_1.expect)(result?.error).toContain("resolves to the plan file");
        });
        (0, bun_test_1.it)("should reject non-plan files in plan mode", async () => {
            const result = await (0, fileCommon_1.validatePlanModeAccess)("src/main.ts", config);
            (0, bun_test_1.expect)(result).not.toBeNull();
            (0, bun_test_1.expect)(result?.error).toContain("only the plan file can be edited");
            (0, bun_test_1.expect)(result?.error).toContain("exact plan file path");
            (0, bun_test_1.expect)(result?.error).toContain(planFilePath);
            (0, bun_test_1.expect)(result?.error).toContain("src/main.ts");
        });
    });
});
//# sourceMappingURL=fileCommon.test.js.map