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
const bun_test_1 = require("bun:test");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const file_read_1 = require("./file_read");
const testHelpers_1 = require("./testHelpers");
// Mock ToolCallOptions for testing
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
// Helper to create file_read tool with test configuration
// Returns both tool and disposable temp directory
function createTestFileReadTool(options) {
    const tempDir = new testHelpers_1.TestTempDir("test-file-read");
    const config = (0, testHelpers_1.createTestToolConfig)(options?.cwd ?? process.cwd());
    config.runtimeTempDir = tempDir.path; // Override runtimeTempDir to use test's disposable temp dir
    const tool = (0, file_read_1.createFileReadTool)(config);
    return {
        tool,
        runtimeTempDir: tempDir.path,
        [Symbol.dispose]() {
            tempDir[Symbol.dispose]();
        },
    };
}
(0, bun_test_1.describe)("file_read tool", () => {
    let testDir;
    let testFilePath;
    (0, bun_test_1.beforeEach)(async () => {
        // Create a temporary directory for test files
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "fileRead-test-"));
        testFilePath = path.join(testDir, "test.txt");
    });
    (0, bun_test_1.afterEach)(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("should read entire file with line numbers", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "line one\nline two\nline three";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_1, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(3);
                (0, bun_test_1.expect)(result.content).toBe("1\tline one\n2\tline two\n3\tline three");
                (0, bun_test_1.expect)(result.file_size).toBeGreaterThan(0);
            }
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    });
    (0, bun_test_1.it)("should read file with offset", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "line1\nline2\nline3\nline4\nline5";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_2, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
                offset: 3, // Start from line 3
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(3);
                (0, bun_test_1.expect)(result.content).toBe("3\tline3\n4\tline4\n5\tline5");
            }
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    (0, bun_test_1.it)("should read file with limit", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "line1\nline2\nline3\nline4\nline5";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_3, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
                limit: 2, // Read only first 2 lines
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(2);
                (0, bun_test_1.expect)(result.content).toBe("1\tline1\n2\tline2");
            }
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, bun_test_1.it)("should read file with offset and limit", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "line1\nline2\nline3\nline4\nline5";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_4, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
                offset: 2, // Start from line 2
                limit: 2, // Read 2 lines
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(2);
                (0, bun_test_1.expect)(result.content).toBe("2\tline2\n3\tline3");
            }
        }
        catch (e_4) {
            env_4.error = e_4;
            env_4.hasError = true;
        }
        finally {
            __disposeResources(env_4);
        }
    });
    (0, bun_test_1.it)("should handle single line file", async () => {
        const env_5 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "single line";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_5, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(1);
                (0, bun_test_1.expect)(result.content).toBe("1\tsingle line");
            }
        }
        catch (e_5) {
            env_5.error = e_5;
            env_5.hasError = true;
        }
        finally {
            __disposeResources(env_5);
        }
    });
    (0, bun_test_1.it)("should handle empty file", async () => {
        const env_6 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            await fs.writeFile(testFilePath, "");
            const testEnv = __addDisposableResource(env_6, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(0);
                (0, bun_test_1.expect)(result.content).toBe("");
            }
        }
        catch (e_6) {
            env_6.error = e_6;
            env_6.hasError = true;
        }
        finally {
            __disposeResources(env_6);
        }
    });
    (0, bun_test_1.it)("should fail when file does not exist", async () => {
        const env_7 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const testEnv = __addDisposableResource(env_7, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "nonexistent.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toMatch(/File not found|Failed to stat.*ENOENT/);
            }
        }
        catch (e_7) {
            env_7.error = e_7;
            env_7.hasError = true;
        }
        finally {
            __disposeResources(env_7);
        }
    });
    (0, bun_test_1.it)("should fail when offset is invalid", async () => {
        const env_8 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "line1\nline2";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_8, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
                offset: 10, // Beyond file length
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("beyond file length");
            }
        }
        catch (e_8) {
            env_8.error = e_8;
            env_8.hasError = true;
        }
        finally {
            __disposeResources(env_8);
        }
    });
    (0, bun_test_1.it)("should truncate lines longer than 1024 bytes", async () => {
        const env_9 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup - create a line with more than 1024 bytes
            const longLine = "x".repeat(2000);
            const content = `short line\n${longLine}\nanother short line`;
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_9, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(3);
                const lines = result.content.split("\n");
                (0, bun_test_1.expect)(lines[0]).toBe("1\tshort line");
                (0, bun_test_1.expect)(lines[1]).toContain("... [truncated]");
                (0, bun_test_1.expect)(Buffer.byteLength(lines[1], "utf-8")).toBeLessThan(1100); // Should be around 1024 + prefix + truncation marker
                (0, bun_test_1.expect)(lines[2]).toBe("3\tanother short line");
            }
        }
        catch (e_9) {
            env_9.error = e_9;
            env_9.hasError = true;
        }
        finally {
            __disposeResources(env_9);
        }
    });
    (0, bun_test_1.it)("should fail when reading more than 1000 lines", async () => {
        const env_10 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup - create a file with 1001 lines
            const lines = Array.from({ length: 1001 }, (_, i) => `line${i + 1}`);
            const content = lines.join("\n");
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_10, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("1000 lines");
                (0, bun_test_1.expect)(result.error).toContain("read less at a time");
            }
        }
        catch (e_10) {
            env_10.error = e_10;
            env_10.hasError = true;
        }
        finally {
            __disposeResources(env_10);
        }
    });
    (0, bun_test_1.it)("should fail when total output exceeds 16KB", async () => {
        const env_11 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup - create lines that together exceed 16KB
            // Each line is about 200 bytes, so 100 lines will exceed 16KB
            const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}:${"x".repeat(200)}`);
            const content = lines.join("\n");
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_11, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("16384 bytes");
                (0, bun_test_1.expect)(result.error).toContain("read less at a time");
            }
        }
        catch (e_11) {
            env_11.error = e_11;
            env_11.hasError = true;
        }
        finally {
            __disposeResources(env_11);
        }
    });
    (0, bun_test_1.it)("should allow reading with limit to stay under 1000 lines", async () => {
        const env_12 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup - create a file with 1001 lines
            const lines = Array.from({ length: 1001 }, (_, i) => `line${i + 1}`);
            const content = lines.join("\n");
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_12, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "test.txt", // Use relative path
                limit: 500, // Read only 500 lines
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.lines_read).toBe(500);
            }
        }
        catch (e_12) {
            env_12.error = e_12;
            env_12.hasError = true;
        }
        finally {
            __disposeResources(env_12);
        }
    });
    (0, bun_test_1.it)("should auto-correct absolute paths containing the workspace directory", async () => {
        const env_13 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const content = "test content";
            await fs.writeFile(testFilePath, content);
            const testEnv = __addDisposableResource(env_13, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: testFilePath, // Absolute path containing cwd prefix
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert - Should succeed with auto-correction warning
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.warning).toContain("auto-corrected");
                (0, bun_test_1.expect)(result.warning).toContain("test.txt"); // Should mention the relative path
                (0, bun_test_1.expect)(result.content).toContain("test content");
            }
        }
        catch (e_13) {
            env_13.error = e_13;
            env_13.hasError = true;
        }
        finally {
            __disposeResources(env_13);
        }
    });
    (0, bun_test_1.it)("should reject reading files outside cwd using ..", async () => {
        // Setup - create a file in testDir
        const content = "secret content";
        await fs.writeFile(testFilePath, content);
        // Create a subdirectory
        const subDir = path.join(testDir, "subdir");
        await fs.mkdir(subDir);
        // Try to read file outside cwd by going up
        const tool = (0, file_read_1.createFileReadTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: subDir,
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: testDir,
        });
        const args = {
            file_path: "../test.txt", // This goes outside subDir back to testDir
        };
        // Execute
        const result = (await tool.execute(args, mockToolCallOptions));
        // Assert
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("restricted to the workspace directory");
            (0, bun_test_1.expect)(result.error).toContain("ask the user for permission");
        }
    });
    (0, bun_test_1.it)("should allow reading files from runtimeTempDir", async () => {
        const env_14 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_14, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const tmpFilePath = path.join(testEnv.runtimeTempDir, "bash-full.txt");
            await fs.writeFile(tmpFilePath, "lineA\nlineB");
            const result = (await tool.execute({ file_path: tmpFilePath }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.content).toBe("1\tlineA\n2\tlineB");
            }
        }
        catch (e_14) {
            env_14.error = e_14;
            env_14.hasError = true;
        }
        finally {
            __disposeResources(env_14);
        }
    });
    (0, bun_test_1.it)("should reject reading absolute paths outside cwd", async () => {
        const env_15 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup
            const testEnv = __addDisposableResource(env_15, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "/etc/passwd", // Absolute path outside cwd
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("restricted to the workspace directory");
            }
        }
        catch (e_15) {
            env_15.error = e_15;
            env_15.hasError = true;
        }
        finally {
            __disposeResources(env_15);
        }
    });
    (0, bun_test_1.it)("should hint plan file path when in plan mode and reading outside cwd", async () => {
        const planDir = await fs.mkdtemp(path.join(os.tmpdir(), "planFile-plan-hint-"));
        const planPath = path.join(planDir, "plan.md");
        try {
            await fs.writeFile(planPath, "# Plan\n");
            const tool = (0, file_read_1.createFileReadTool)({
                ...(0, testHelpers_1.getTestDeps)(),
                cwd: testDir,
                runtime: new LocalRuntime_1.LocalRuntime(testDir),
                runtimeTempDir: testDir,
                planFileOnly: true,
                planFilePath: planPath,
            });
            const result = (await tool.execute({ file_path: "/etc/passwd" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("restricted to the workspace directory");
                (0, bun_test_1.expect)(result.error).toContain("use the exact plan file path string as provided");
                (0, bun_test_1.expect)(result.error).toContain(planPath);
            }
        }
        finally {
            await fs.rm(planDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("should allow reading files with relative paths within cwd", async () => {
        const env_16 = { stack: [], error: void 0, hasError: false };
        try {
            // Setup - create a subdirectory and file
            const subDir = path.join(testDir, "subdir");
            await fs.mkdir(subDir);
            const subFilePath = path.join(subDir, "test.txt");
            const content = "content in subdir";
            await fs.writeFile(subFilePath, content);
            // Read using relative path from cwd
            const testEnv = __addDisposableResource(env_16, createTestFileReadTool({ cwd: testDir }), false);
            const tool = testEnv.tool;
            const args = {
                file_path: "subdir/test.txt",
            };
            // Execute
            const result = (await tool.execute(args, mockToolCallOptions));
            // Assert
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.content).toContain("content in subdir");
            }
        }
        catch (e_16) {
            env_16.error = e_16;
            env_16.hasError = true;
        }
        finally {
            __disposeResources(env_16);
        }
    });
    (0, bun_test_1.it)("should allow reading the configured plan file outside cwd in exec mode", async () => {
        const planDir = await fs.mkdtemp(path.join(os.tmpdir(), "planFile-exec-read-"));
        const planPath = path.join(planDir, "plan.md");
        try {
            const planContent = "# Plan\n\n- Step 1";
            await fs.writeFile(planPath, planContent);
            const tool = (0, file_read_1.createFileReadTool)({
                ...(0, testHelpers_1.getTestDeps)(),
                cwd: testDir,
                runtime: new LocalRuntime_1.LocalRuntime(testDir),
                runtimeTempDir: testDir,
                planFilePath: planPath,
            });
            const result = (await tool.execute({ file_path: planPath }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.content).toContain("# Plan");
            }
        }
        finally {
            await fs.rm(planDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=file_read.test.js.map