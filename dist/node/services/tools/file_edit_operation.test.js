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
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const file_edit_operation_1 = require("./file_edit_operation");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const testHelpers_1 = require("./testHelpers");
const TEST_CWD = "/tmp";
function createConfig(runtime) {
    const config = (0, testHelpers_1.createTestToolConfig)(TEST_CWD);
    if (runtime) {
        config.runtime = runtime;
    }
    return config;
}
(0, globals_1.describe)("executeFileEditOperation", () => {
    (0, globals_1.test)("should return error when path validation fails", async () => {
        const result = await (0, file_edit_operation_1.executeFileEditOperation)({
            config: createConfig(),
            filePath: "../../etc/passwd",
            operation: () => ({ success: true, newContent: "", metadata: {} }),
        });
        (0, globals_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, globals_1.expect)(result.error).toContain("File operations are restricted to the workspace directory");
        }
    });
    (0, globals_1.test)("should use runtime.normalizePath for path resolution, not Node's path.resolve", async () => {
        // This test verifies that executeFileEditOperation uses runtime.normalizePath()
        // instead of path.resolve() for resolving file paths.
        //
        // Why this matters: path.resolve() uses LOCAL filesystem semantics (Node.js path module),
        // which normalizes paths differently than the remote filesystem expects.
        // For example, path.resolve() on Windows uses backslashes, and path normalization
        // can behave differently across platforms.
        const normalizePathCalls = [];
        const mockRuntime = {
            stat: globals_1.jest
                .fn()
                .mockResolvedValue({
                size: 100,
                modifiedTime: new Date(),
                isDirectory: false,
            }),
            readFile: globals_1.jest.fn().mockResolvedValue(new Uint8Array()),
            writeFile: globals_1.jest.fn().mockResolvedValue(undefined),
            normalizePath: globals_1.jest.fn((targetPath, basePath) => {
                normalizePathCalls.push({ targetPath, basePath });
                // Mock SSH-style path normalization
                if (targetPath.startsWith("/"))
                    return targetPath;
                return `${basePath}/${targetPath}`;
            }),
        };
        const testFilePath = "relative/path/to/file.txt";
        const testCwd = "/remote/workspace/dir";
        await (0, file_edit_operation_1.executeFileEditOperation)({
            config: {
                cwd: testCwd,
                runtime: mockRuntime,
                runtimeTempDir: "/tmp",
                ...(0, testHelpers_1.getTestDeps)(),
            },
            filePath: testFilePath,
            operation: () => ({ success: true, newContent: "test", metadata: {} }),
        });
        // Verify that runtime.normalizePath() was called for path resolution
        const normalizeCallForFilePath = normalizePathCalls.find((call) => call.targetPath === testFilePath);
        (0, globals_1.expect)(normalizeCallForFilePath).toBeDefined();
        if (normalizeCallForFilePath) {
            (0, globals_1.expect)(normalizeCallForFilePath.basePath).toBe(testCwd);
        }
    });
});
(0, globals_1.describe)("executeFileEditOperation plan mode enforcement", () => {
    (0, globals_1.test)("should block editing non-plan files when in plan mode", async () => {
        // This test verifies that when in plan mode with a planFilePath set,
        // attempting to edit any other file is blocked BEFORE trying to read/write
        const OTHER_FILE_PATH = "/home/user/project/src/main.ts";
        const PLAN_FILE_PATH = "/home/user/.unix/sessions/workspace-123/plan.md";
        const TEST_CWD = "/home/user/project";
        const readFileMock = globals_1.jest.fn();
        const mockRuntime = {
            stat: globals_1.jest
                .fn()
                .mockResolvedValue({
                size: 100,
                modifiedTime: new Date(),
                isDirectory: false,
            }),
            readFile: readFileMock,
            writeFile: globals_1.jest.fn(),
            normalizePath: globals_1.jest.fn((targetPath, _basePath) => {
                // For absolute paths, return as-is
                if (targetPath.startsWith("/"))
                    return targetPath;
                // For relative paths, join with base
                return `${_basePath}/${targetPath}`;
            }),
            resolvePath: globals_1.jest.fn((targetPath) => {
                // For absolute paths, return as-is
                if (targetPath.startsWith("/"))
                    return Promise.resolve(targetPath);
                // Return path as-is (mock doesn't need full resolution)
                return Promise.resolve(targetPath);
            }),
        };
        const result = await (0, file_edit_operation_1.executeFileEditOperation)({
            config: {
                cwd: TEST_CWD,
                runtime: mockRuntime,
                runtimeTempDir: "/tmp",
                planFileOnly: true,
                planFilePath: PLAN_FILE_PATH,
            },
            filePath: OTHER_FILE_PATH,
            operation: () => ({ success: true, newContent: "console.log('test')", metadata: {} }),
        });
        (0, globals_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, globals_1.expect)(result.error).toContain("In the plan agent, only the plan file can be edited");
            (0, globals_1.expect)(result.error).toContain(OTHER_FILE_PATH);
        }
        // Verify readFile was never called - we should fail before reaching file IO
        (0, globals_1.expect)(readFileMock).not.toHaveBeenCalled();
    });
    (0, globals_1.test)("should allow editing the plan file when in plan mode (integration)", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_1, new testHelpers_1.TestTempDir("plan-mode-test"), false);
            // Create the plan file in the temp directory
            const planPath = path.join(tempDir.path, "plan.md");
            await fs.writeFile(planPath, "# Original Plan\n");
            // CWD is separate from plan file location (simulates real setup)
            const workspaceCwd = path.join(tempDir.path, "workspace");
            await fs.mkdir(workspaceCwd);
            const result = await (0, file_edit_operation_1.executeFileEditOperation)({
                config: {
                    cwd: workspaceCwd,
                    runtime: new LocalRuntime_1.LocalRuntime(workspaceCwd),
                    runtimeTempDir: tempDir.path,
                    planFileOnly: true,
                    planFilePath: planPath,
                },
                filePath: planPath,
                operation: () => ({ success: true, newContent: "# Updated Plan\n", metadata: {} }),
            });
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(await fs.readFile(planPath, "utf-8")).toBe("# Updated Plan\n");
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    });
    (0, globals_1.test)("should allow editing any file when in exec mode (integration)", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_2, new testHelpers_1.TestTempDir("exec-mode-test"), false);
            const testFile = path.join(tempDir.path, "main.ts");
            await fs.writeFile(testFile, "const x = 1;\n");
            const result = await (0, file_edit_operation_1.executeFileEditOperation)({
                config: {
                    cwd: tempDir.path,
                    runtime: new LocalRuntime_1.LocalRuntime(tempDir.path),
                    runtimeTempDir: tempDir.path,
                    // No planFilePath in exec mode
                },
                filePath: testFile,
                operation: () => ({ success: true, newContent: "const x = 2;\n", metadata: {} }),
            });
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(await fs.readFile(testFile, "utf-8")).toBe("const x = 2;\n");
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    (0, globals_1.test)("should allow editing any file when mode is not set (integration)", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_3, new testHelpers_1.TestTempDir("no-mode-test"), false);
            const testFile = path.join(tempDir.path, "main.ts");
            await fs.writeFile(testFile, "const x = 1;\n");
            const result = await (0, file_edit_operation_1.executeFileEditOperation)({
                config: {
                    cwd: tempDir.path,
                    runtime: new LocalRuntime_1.LocalRuntime(tempDir.path),
                    runtimeTempDir: tempDir.path,
                    // mode is undefined
                },
                filePath: testFile,
                operation: () => ({ success: true, newContent: "const x = 2;\n", metadata: {} }),
            });
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(await fs.readFile(testFile, "utf-8")).toBe("const x = 2;\n");
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, globals_1.test)("should block editing the plan file outside plan mode (integration)", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_4, new testHelpers_1.TestTempDir("exec-plan-readonly-test"), false);
            const planPath = path.join(tempDir.path, "plan.md");
            await fs.writeFile(planPath, "# Plan\n");
            const workspaceCwd = path.join(tempDir.path, "workspace");
            await fs.mkdir(workspaceCwd);
            const result = await (0, file_edit_operation_1.executeFileEditOperation)({
                config: {
                    cwd: workspaceCwd,
                    runtime: new LocalRuntime_1.LocalRuntime(workspaceCwd),
                    runtimeTempDir: tempDir.path,
                    planFilePath: planPath,
                },
                filePath: planPath,
                operation: () => ({ success: true, newContent: "# Updated\n", metadata: {} }),
            });
            (0, globals_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, globals_1.expect)(result.error).toContain("read-only outside the plan agent");
            }
            // Verify file was not modified
            (0, globals_1.expect)(await fs.readFile(planPath, "utf-8")).toBe("# Plan\n");
        }
        catch (e_4) {
            env_4.error = e_4;
            env_4.hasError = true;
        }
        finally {
            __disposeResources(env_4);
        }
    });
    (0, globals_1.test)("should require exact plan file path string in plan mode", async () => {
        // If an alternate path resolves to the plan file, we still require using the exact
        // planFilePath string provided in the plan-mode instructions.
        const resolvePathCalls = [];
        const mockRuntime = {
            stat: globals_1.jest.fn(),
            readFile: globals_1.jest.fn(),
            writeFile: globals_1.jest.fn(),
            normalizePath: globals_1.jest.fn((targetPath, basePath) => {
                // Simulate: "../.unix/sessions/ws/plan.md" resolves to "/home/user/.unix/sessions/ws/plan.md"
                if (targetPath === "../.unix/sessions/ws/plan.md") {
                    return "/home/user/.unix/sessions/ws/plan.md";
                }
                if (targetPath === "/home/user/.unix/sessions/ws/plan.md") {
                    return "/home/user/.unix/sessions/ws/plan.md";
                }
                if (targetPath.startsWith("/"))
                    return targetPath;
                return `${basePath}/${targetPath}`;
            }),
            resolvePath: globals_1.jest.fn((targetPath) => {
                resolvePathCalls.push(targetPath);
                // Both paths resolve to the same absolute path
                if (targetPath === "../.unix/sessions/ws/plan.md") {
                    return Promise.resolve("/home/user/.unix/sessions/ws/plan.md");
                }
                if (targetPath === "/home/user/.unix/sessions/ws/plan.md") {
                    return Promise.resolve("/home/user/.unix/sessions/ws/plan.md");
                }
                if (targetPath.startsWith("/"))
                    return Promise.resolve(targetPath);
                return Promise.resolve(targetPath);
            }),
        };
        const result = await (0, file_edit_operation_1.executeFileEditOperation)({
            config: {
                cwd: "/home/user/project",
                runtime: mockRuntime,
                runtimeTempDir: "/tmp",
                planFileOnly: true,
                planFilePath: "/home/user/.unix/sessions/ws/plan.md",
            },
            filePath: "../.unix/sessions/ws/plan.md", // Alternate path to plan file
            operation: () => ({ success: true, newContent: "# Plan", metadata: {} }),
        });
        (0, globals_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, globals_1.expect)(result.error).toContain("exact plan file path");
            (0, globals_1.expect)(result.error).toContain("/home/user/.unix/sessions/ws/plan.md");
            (0, globals_1.expect)(result.error).toContain("../.unix/sessions/ws/plan.md");
            (0, globals_1.expect)(result.error).toContain("resolves to the plan file");
        }
        // We still resolve both paths to determine whether the attempted path is the plan file.
        (0, globals_1.expect)(resolvePathCalls).toContain("../.unix/sessions/ws/plan.md");
        (0, globals_1.expect)(resolvePathCalls).toContain("/home/user/.unix/sessions/ws/plan.md");
    });
});
//# sourceMappingURL=file_edit_operation.test.js.map