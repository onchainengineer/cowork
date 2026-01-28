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
const bash_1 = require("./bash");
const toolLimits_1 = require("../../../common/constants/toolLimits");
const fs = __importStar(require("fs"));
const testHelpers_1 = require("./testHelpers");
const runtimeFactory_1 = require("../../../node/runtime/runtimeFactory");
const sshConnectionPool_1 = require("../../../node/runtime/sshConnectionPool");
// Type guard to narrow foreground success result (has note, no backgroundProcessId)
function isForegroundSuccess(result) {
    return result.success && !("backgroundProcessId" in result);
}
const backgroundProcessManager_1 = require("../../../node/services/backgroundProcessManager");
// Mock ToolCallOptions for testing
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
// Helper to create bash tool with test configuration
// Returns both tool and disposable temp directory
// Use with: using testEnv = createTestBashTool();
function createTestBashTool() {
    const tempDir = new testHelpers_1.TestTempDir("test-bash");
    const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
    config.runtimeTempDir = tempDir.path; // Override runtimeTempDir to use test's disposable temp dir
    const tool = (0, bash_1.createBashTool)(config);
    return {
        tool,
        [Symbol.dispose]() {
            tempDir[Symbol.dispose]();
        },
    };
}
(0, bun_test_1.describe)("bash tool", () => {
    (0, bun_test_1.it)("should execute a simple command successfully", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_1, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo hello",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("hello");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
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
    (0, bun_test_1.it)("should emit bash-output events when emitChatEvent is provided", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-live-output");
        const events = [];
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.emitChatEvent = (event) => {
            if (event.type === "bash-output") {
                events.push(event);
            }
        };
        const tool = (0, bash_1.createBashTool)(config);
        const args = {
            script: "echo out && echo err 1>&2",
            timeout_secs: 5,
            run_in_background: false,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(events.length).toBeGreaterThan(0);
        (0, bun_test_1.expect)(events.every((e) => e.workspaceId === config.workspaceId)).toBe(true);
        (0, bun_test_1.expect)(events.every((e) => e.toolCallId === mockToolCallOptions.toolCallId)).toBe(true);
        const stdoutText = events
            .filter((e) => !e.isError)
            .map((e) => e.text)
            .join("");
        const stderrText = events
            .filter((e) => e.isError)
            .map((e) => e.text)
            .join("");
        (0, bun_test_1.expect)(stdoutText).toContain("out");
        (0, bun_test_1.expect)(stderrText).toContain("err");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should handle multi-line output", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_2, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo line1 && echo line2 && echo line3",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("line1\nline2\nline3");
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
    (0, bun_test_1.it)("should report overflow when hard cap (300 lines) is exceeded", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_3, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                run_in_background: false,
                script: "for i in {1..400}; do echo line$i; done", // Exceeds 300 line hard cap
                timeout_secs: 5,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (isForegroundSuccess(result)) {
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.note).toContain("[OUTPUT OVERFLOW");
                (0, bun_test_1.expect)(result.note).toContain("Line count exceeded");
                (0, bun_test_1.expect)(result.note).toContain("300 lines");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
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
    (0, bun_test_1.it)("should save overflow output to temp file with short ID", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_4, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                run_in_background: false,
                script: "for i in {1..400}; do echo line$i; done", // Exceeds 300 line hard cap
                timeout_secs: 5,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (isForegroundSuccess(result)) {
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.note).toContain("[OUTPUT OVERFLOW");
                // Should contain specific overflow reason (one of the three types)
                (0, bun_test_1.expect)(result.note).toMatch(/Line count exceeded|Total output exceeded|exceeded per-line limit/);
                (0, bun_test_1.expect)(result.note).toContain("Full output");
                (0, bun_test_1.expect)(result.note).toContain("lines) saved to");
                (0, bun_test_1.expect)(result.note).toContain("bash-");
                (0, bun_test_1.expect)(result.note).toContain(".txt");
                (0, bun_test_1.expect)(result.note).toContain("File will be automatically cleaned up when stream ends");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
                // Extract file path from output message (handles both "lines saved to" and "lines) saved to")
                const match = /saved to (\/.+?\.txt)/.exec(result.note ?? "");
                (0, bun_test_1.expect)(match).toBeDefined();
                if (match) {
                    const overflowPath = match[1];
                    // Verify file has short ID format (bash-<8 hex chars>.txt)
                    const filename = overflowPath.split("/").pop();
                    (0, bun_test_1.expect)(filename).toMatch(/^bash-[0-9a-f]{8}\.txt$/);
                    // Verify file exists and read contents
                    (0, bun_test_1.expect)(fs.existsSync(overflowPath)).toBe(true);
                    // Verify file contains collected lines (at least 300, may be slightly more)
                    const fileContent = fs.readFileSync(overflowPath, "utf-8");
                    const fileLines = fileContent.split("\n").filter((l) => l.length > 0);
                    (0, bun_test_1.expect)(fileLines.length).toBeGreaterThanOrEqual(300);
                    (0, bun_test_1.expect)(fileContent).toContain("line1");
                    (0, bun_test_1.expect)(fileContent).toContain("line300");
                    // Clean up temp file
                    fs.unlinkSync(overflowPath);
                }
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
    (0, bun_test_1.it)("should report overflow quickly when hard cap is reached", async () => {
        const env_5 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_5, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            const args = {
                // This will generate 500 lines quickly - should report overflow at 300
                run_in_background: false,
                script: "for i in {1..500}; do echo line$i; done",
                timeout_secs: 5,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            const duration = performance.now() - startTime;
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (isForegroundSuccess(result)) {
                // Should complete quickly since we stop at 300 lines
                (0, bun_test_1.expect)(duration).toBeLessThan(4000);
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.note).toContain("[OUTPUT OVERFLOW");
                (0, bun_test_1.expect)(result.note).toContain("Line count exceeded");
                (0, bun_test_1.expect)(result.note).toContain("300 lines");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
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
    (0, bun_test_1.it)("should truncate overflow output when overflow_policy is 'truncate'", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-truncate");
        const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
        config.runtimeTempDir = tempDir.path;
        config.overflow_policy = "truncate";
        const tool = (0, bash_1.createBashTool)(config);
        const args = {
            // Generate ~1.5MB of output (1700 lines * 900 bytes) to exceed 1MB byte limit
            script: 'perl -e \'for (1..1700) { print "A" x 900 . "\\n" }\'',
            timeout_secs: 5,
            run_in_background: false,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        // With truncate policy and overflow, should succeed with truncated field
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success && "truncated" in result) {
            (0, bun_test_1.expect)(result.truncated).toBeDefined();
            if (result.truncated) {
                (0, bun_test_1.expect)(result.truncated.reason).toContain("exceed");
                // Should collect lines up to ~1MB (around 1150-1170 lines with 900 bytes each)
                (0, bun_test_1.expect)(result.truncated.totalLines).toBeGreaterThan(1000);
                (0, bun_test_1.expect)(result.truncated.totalLines).toBeLessThan(1300);
            }
        }
        // Should contain output that's around 1MB
        (0, bun_test_1.expect)(result.output?.length).toBeGreaterThan(1000000);
        (0, bun_test_1.expect)(result.output?.length).toBeLessThan(1100000);
        // Should NOT create temp file with truncate policy
        const files = fs.readdirSync(tempDir.path);
        const bashFiles = files.filter((f) => f.startsWith("bash-"));
        (0, bun_test_1.expect)(bashFiles.length).toBe(0);
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should reject single overlong line before storing it (IPC mode)", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-overlong-line");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
            overflow_policy: "truncate",
        });
        const args = {
            // Generate a single 2MB line (exceeds 1MB total limit)
            script: 'perl -e \'print "A" x 2000000 . "\\n"\'',
            timeout_secs: 5,
            run_in_background: false,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        // Should succeed but with truncation before storing the overlong line
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success && "truncated" in result) {
            (0, bun_test_1.expect)(result.truncated).toBeDefined();
            if (result.truncated) {
                (0, bun_test_1.expect)(result.truncated.reason).toContain("would exceed file preservation limit");
                // Should have 0 lines collected since the first line was too long
                (0, bun_test_1.expect)(result.truncated.totalLines).toBe(0);
            }
        }
        // CRITICAL: Output must NOT contain the 2MB line - should be empty or nearly empty
        (0, bun_test_1.expect)(result.output?.length ?? 0).toBeLessThan(100);
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should reject overlong line at boundary (IPC mode)", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-boundary");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
            overflow_policy: "truncate",
        });
        const args = {
            // First line: 500KB (within limit)
            // Second line: 600KB (would exceed 1MB when added)
            script: 'perl -e \'print "A" x 500000 . "\\n"; print "B" x 600000 . "\\n"\'',
            timeout_secs: 5,
            run_in_background: false,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success && "truncated" in result) {
            (0, bun_test_1.expect)(result.truncated).toBeDefined();
            if (result.truncated) {
                (0, bun_test_1.expect)(result.truncated.reason).toContain("would exceed");
                // Should have collected exactly 1 line (the 500KB line)
                (0, bun_test_1.expect)(result.truncated.totalLines).toBe(1);
            }
        }
        // Output should contain only the first line (~500KB), not the second line
        (0, bun_test_1.expect)(result.output?.length).toBeGreaterThanOrEqual(500000);
        (0, bun_test_1.expect)(result.output?.length).toBeLessThan(600000);
        // Verify content is only 'A's, not 'B's
        (0, bun_test_1.expect)(result.output).toContain("AAAA");
        (0, bun_test_1.expect)(result.output).not.toContain("BBBB");
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should use tmpfile policy by default when overflow_policy not specified", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-default");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
            // overflow_policy not specified - should default to tmpfile
        });
        const args = {
            run_in_background: false,
            script: "for i in {1..400}; do echo line$i; done",
            timeout_secs: 5,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (isForegroundSuccess(result)) {
            // Should use tmpfile behavior
            (0, bun_test_1.expect)(result.output).toBe("");
            (0, bun_test_1.expect)(result.note).toContain("[OUTPUT OVERFLOW");
            (0, bun_test_1.expect)(result.note).toContain("saved to");
            (0, bun_test_1.expect)(result.note).not.toContain("[OUTPUT TRUNCATED");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
            // Verify temp file was created in runtimeTempDir
            (0, bun_test_1.expect)(fs.existsSync(tempDir.path)).toBe(true);
            const files = fs.readdirSync(tempDir.path);
            const bashFiles = files.filter((f) => f.startsWith("bash-"));
            (0, bun_test_1.expect)(bashFiles.length).toBe(1);
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should preserve up to 100KB in temp file even after 16KB display limit", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-100kb");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
        });
        // Generate ~50KB of output (well over 16KB display limit, under 100KB file limit)
        // Each line is ~40 bytes: "line" + number (1-5 digits) + padding = ~40 bytes
        // 50KB / 40 bytes = ~1250 lines
        const args = {
            run_in_background: false,
            script: "for i in {1..1300}; do printf 'line%04d with some padding text here\\n' $i; done",
            timeout_secs: 5,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (isForegroundSuccess(result)) {
            // Should hit display limit and save to temp file
            (0, bun_test_1.expect)(result.output).toBe("");
            (0, bun_test_1.expect)(result.note).toContain("[OUTPUT OVERFLOW");
            (0, bun_test_1.expect)(result.note).toContain("saved to");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
            // Extract and verify temp file
            const match = /saved to (\/.*?\.txt)/.exec(result.note ?? "");
            (0, bun_test_1.expect)(match).toBeDefined();
            if (match) {
                const overflowPath = match[1];
                (0, bun_test_1.expect)(fs.existsSync(overflowPath)).toBe(true);
                // Verify file contains ALL lines collected (should be ~1300 lines, ~50KB)
                const fileContent = fs.readFileSync(overflowPath, "utf-8");
                const fileLines = fileContent.split("\n").filter((l) => l.length > 0);
                // Should have collected all 1300 lines (not stopped at display limit)
                (0, bun_test_1.expect)(fileLines.length).toBeGreaterThanOrEqual(1250);
                (0, bun_test_1.expect)(fileLines.length).toBeLessThanOrEqual(1350);
                // Verify file size is between 45KB and 55KB
                const fileStats = fs.statSync(overflowPath);
                (0, bun_test_1.expect)(fileStats.size).toBeGreaterThan(45 * 1024);
                (0, bun_test_1.expect)(fileStats.size).toBeLessThan(55 * 1024);
                // Clean up
                fs.unlinkSync(overflowPath);
            }
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should stop collection at 100KB file limit", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-100kb-limit");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
        });
        // Generate ~150KB of output (exceeds 100KB file limit)
        // Each line is ~100 bytes
        // 150KB / 100 bytes = ~1500 lines
        const args = {
            run_in_background: false,
            script: "for i in {1..1600}; do printf 'line%04d: '; printf 'x%.0s' {1..80}; echo; done",
            timeout_secs: 10,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (isForegroundSuccess(result)) {
            // Should hit file limit
            (0, bun_test_1.expect)(result.output).toBe("");
            (0, bun_test_1.expect)(result.note).toContain("file preservation limit");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
            // Extract and verify temp file
            const match = /saved to (\/.*?\.txt)/.exec(result.note ?? "");
            (0, bun_test_1.expect)(match).toBeDefined();
            if (match) {
                const overflowPath = match[1];
                (0, bun_test_1.expect)(fs.existsSync(overflowPath)).toBe(true);
                // Verify file is capped around 100KB (not 150KB)
                const fileStats = fs.statSync(overflowPath);
                (0, bun_test_1.expect)(fileStats.size).toBeLessThanOrEqual(105 * 1024); // Allow 5KB buffer
                (0, bun_test_1.expect)(fileStats.size).toBeGreaterThan(95 * 1024);
                // Clean up
                fs.unlinkSync(overflowPath);
            }
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should NOT kill process at display limit (16KB) - verify command completes naturally", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-no-kill-display");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
        });
        // Generate output that exceeds display limit but not file limit
        // Also includes a delay at the END to verify process wasn't killed early
        const args = {
            script: "for i in {1..500}; do printf 'line%04d with padding text\\n' $i; done; echo 'COMPLETION_MARKER'",
            timeout_secs: 5,
            run_in_background: false,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (isForegroundSuccess(result)) {
            // Should hit display limit
            (0, bun_test_1.expect)(result.note).toContain("display limit");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
            // Extract and verify temp file contains the completion marker
            const match = /saved to (\/.*?\.txt)/.exec(result.note ?? "");
            (0, bun_test_1.expect)(match).toBeDefined();
            if (match) {
                const overflowPath = match[1];
                const fileContent = fs.readFileSync(overflowPath, "utf-8");
                // CRITICAL: File must contain COMPLETION_MARKER, proving command ran to completion
                // If process was killed at display limit, this marker would be missing
                (0, bun_test_1.expect)(fileContent).toContain("COMPLETION_MARKER");
                // Clean up
                fs.unlinkSync(overflowPath);
            }
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should kill process immediately when single line exceeds per-line limit", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-per-line-kill");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
        });
        // Generate a single line exceeding 1KB limit, then try to output more
        const args = {
            run_in_background: false,
            script: "printf 'x%.0s' {1..2000}; echo; echo 'SHOULD_NOT_APPEAR'",
            timeout_secs: 5,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (isForegroundSuccess(result)) {
            // Should hit per-line limit (file truncation, not display)
            (0, bun_test_1.expect)(result.output).toBe("");
            (0, bun_test_1.expect)(result.note).toContain("per-line limit");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
            // Extract and verify temp file does NOT contain the second echo
            const match = /saved to (\/.*?\.txt)/.exec(result.note ?? "");
            (0, bun_test_1.expect)(match).toBeDefined();
            if (match) {
                const overflowPath = match[1];
                const fileContent = fs.readFileSync(overflowPath, "utf-8");
                // CRITICAL: File must NOT contain SHOULD_NOT_APPEAR
                // This proves process was killed immediately at per-line limit
                (0, bun_test_1.expect)(fileContent).not.toContain("SHOULD_NOT_APPEAR");
                // Clean up
                fs.unlinkSync(overflowPath);
            }
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should handle output just under 16KB without truncation", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-under-limit");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
        });
        // Generate ~15KB of output (just under 16KB display limit)
        // Each line is ~50 bytes, 15KB / 50 = 300 lines exactly (at the line limit)
        const args = {
            run_in_background: false,
            script: "for i in {1..299}; do printf 'line%04d with some padding text here now\\n' $i; done",
            timeout_secs: 5,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        // Should succeed without overflow (299 lines < 300 line limit)
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.output).toContain("line0001");
            (0, bun_test_1.expect)(result.output).toContain("line0299");
            // Should NOT have created a temp file
            const files = fs.readdirSync(tempDir.path);
            (0, bun_test_1.expect)(files.length).toBe(0);
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should trigger display truncation at exactly 300 lines", async () => {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-exact-limit");
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: process.cwd(),
            runtime: new LocalRuntime_1.LocalRuntime(process.cwd()),
            runtimeTempDir: tempDir.path,
        });
        // Generate exactly 300 lines (hits line limit exactly)
        const args = {
            run_in_background: false,
            script: "for i in {1..300}; do printf 'line%04d\\n' $i; done",
            timeout_secs: 5,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        // Should trigger display truncation at exactly 300 lines
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (isForegroundSuccess(result)) {
            (0, bun_test_1.expect)(result.output).toBe("");
            (0, bun_test_1.expect)(result.note).toContain("[OUTPUT OVERFLOW");
            (0, bun_test_1.expect)(result.note).toContain("300 lines");
            (0, bun_test_1.expect)(result.note).toContain("display limit");
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should interleave stdout and stderr", async () => {
        const env_6 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_6, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo stdout1 && echo stderr1 >&2 && echo stdout2 && echo stderr2 >&2",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                // Output should contain all lines interleaved
                (0, bun_test_1.expect)(result.output).toContain("stdout1");
                (0, bun_test_1.expect)(result.output).toContain("stderr1");
                (0, bun_test_1.expect)(result.output).toContain("stdout2");
                (0, bun_test_1.expect)(result.output).toContain("stderr2");
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
    (0, bun_test_1.it)("should handle command failure with exit code", async () => {
        const env_7 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_7, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "exit 42",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.exitCode).toBe(42);
                (0, bun_test_1.expect)(result.error).toContain("exited with code 42");
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
    (0, bun_test_1.it)("should timeout long-running commands", async () => {
        const env_8 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_8, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "while true; do sleep 0.1; done",
                timeout_secs: 1,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("timeout");
                (0, bun_test_1.expect)(result.exitCode).toBe(-1);
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
    (0, bun_test_1.it)("should handle empty output", async () => {
        const env_9 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_9, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "true",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
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
    (0, bun_test_1.it)("should complete instantly for grep-like commands (regression test)", async () => {
        const env_10 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_10, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            // This test catches the bug where readline interface close events
            // weren't firing, causing commands with minimal output to hang
            const args = {
                script: "echo 'test:first-child' | grep ':first-child'",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            const duration = performance.now() - startTime;
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toContain("first-child");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
                // Should complete in well under 1 second (give 2s buffer for slow machines)
                (0, bun_test_1.expect)(duration).toBeLessThan(2000);
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
    (0, bun_test_1.it)("should not hang on commands that read from stdin (cat test)", async () => {
        const env_11 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_11, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            // cat without input should complete immediately
            // This used to hang because stdin.close() would wait for acknowledgment
            // Fixed by using stdin.abort() for immediate closure
            const args = {
                script: "echo test | cat",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            const duration = performance.now() - startTime;
            // Should complete almost instantly (not wait for timeout)
            (0, bun_test_1.expect)(duration).toBeLessThan(4000);
            // cat with no input should succeed with empty output (stdin is closed)
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toContain("test");
                (0, bun_test_1.expect)(duration).toBeLessThan(2000);
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
    (0, bun_test_1.it)("should present stdin as a non-pipe for search tools", async () => {
        const env_12 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_12, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: 'python3 -c "import os,stat;mode=os.fstat(0).st_mode;print(stat.S_IFMT(mode)==stat.S_IFIFO)"',
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output.trim()).toBe("False");
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
    (0, bun_test_1.it)("should not hang on git rebase --continue", async () => {
        const env_13 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_13, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            // Extremely minimal case - just enough to trigger rebase --continue
            const script = `
      T=$(mktemp -d) && cd "$T"
      git init && git config user.email "t@t" && git config user.name "T" && git config commit.gpgsign false
      echo a > f && git add f && git commit -m a
      git checkout -b b && echo b > f && git commit -am b
      git checkout main && echo c > f && git commit -am c
      git rebase b || true
      echo resolved > f && git add f
      git rebase --continue
    `;
            const result = (await tool.execute({ script, timeout_secs: 5 }, mockToolCallOptions));
            const duration = performance.now() - startTime;
            (0, bun_test_1.expect)(duration).toBeLessThan(4000);
            (0, bun_test_1.expect)(result).toBeDefined();
        }
        catch (e_13) {
            env_13.error = e_13;
            env_13.hasError = true;
        }
        finally {
            __disposeResources(env_13);
        }
    });
    (0, bun_test_1.it)("should work with just script and timeout", async () => {
        const env_14 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_14, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo test",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("test");
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
    (0, bun_test_1.it)("should allow commands that don't start with cd", async () => {
        const env_15 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_15, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo 'cd' && echo test",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toContain("cd");
                (0, bun_test_1.expect)(result.output).toContain("test");
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
    (0, bun_test_1.it)("should complete quickly when background process is spawned", async () => {
        const env_16 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_16, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            const args = {
                // Background process that would block if we waited for it
                script: "while true; do sleep 1; done > /dev/null 2>&1 &",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            const duration = performance.now() - startTime;
            (0, bun_test_1.expect)(result.success).toBe(true);
            // Should complete in well under 1 second, not wait for infinite loop
            (0, bun_test_1.expect)(duration).toBeLessThan(2000);
        }
        catch (e_16) {
            env_16.error = e_16;
            env_16.hasError = true;
        }
        finally {
            __disposeResources(env_16);
        }
    });
    (0, bun_test_1.it)("should complete quickly with background process and PID echo", async () => {
        const env_17 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_17, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            const args = {
                // Spawn background process, echo its PID, then exit
                // Should not wait for the background process
                script: "while true; do sleep 1; done > /dev/null 2>&1 & echo $!",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            const duration = performance.now() - startTime;
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                // Should output the PID
                (0, bun_test_1.expect)(result.output).toMatch(/^\d+$/);
            }
            // Should complete quickly
            (0, bun_test_1.expect)(duration).toBeLessThan(2000);
        }
        catch (e_17) {
            env_17.error = e_17;
            env_17.hasError = true;
        }
        finally {
            __disposeResources(env_17);
        }
    });
    (0, bun_test_1.it)("should timeout background processes that don't complete", async () => {
        const env_18 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_18, createTestBashTool(), false);
            const tool = testEnv.tool;
            const startTime = performance.now();
            const args = {
                // Background process with output redirected but still blocking
                script: "while true; do sleep 0.1; done & wait",
                timeout_secs: 1,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            const duration = performance.now() - startTime;
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("timeout");
                (0, bun_test_1.expect)(duration).toBeLessThan(2000);
            }
        }
        catch (e_18) {
            env_18.error = e_18;
            env_18.hasError = true;
        }
        finally {
            __disposeResources(env_18);
        }
    });
    (0, bun_test_1.it)("should report overflow when line exceeds max line bytes", async () => {
        const env_19 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_19, createTestBashTool(), false);
            const tool = testEnv.tool;
            const longLine = "x".repeat(2000);
            const args = {
                script: `echo '${longLine}'`,
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (isForegroundSuccess(result)) {
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.note).toMatch(/exceeded per-line limit|OUTPUT OVERFLOW/);
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
            }
        }
        catch (e_19) {
            env_19.error = e_19;
            env_19.hasError = true;
        }
        finally {
            __disposeResources(env_19);
        }
    });
    (0, bun_test_1.it)("should report overflow when total bytes limit exceeded", async () => {
        const env_20 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_20, createTestBashTool(), false);
            const tool = testEnv.tool;
            const lineContent = "x".repeat(100);
            const numLines = Math.ceil(toolLimits_1.BASH_MAX_TOTAL_BYTES / 100) + 50;
            const args = {
                script: `for i in {1..${numLines}}; do echo '${lineContent}'; done`,
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (isForegroundSuccess(result)) {
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.note).toMatch(/Total output exceeded limit|OUTPUT OVERFLOW/);
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
            }
        }
        catch (e_20) {
            env_20.error = e_20;
            env_20.hasError = true;
        }
        finally {
            __disposeResources(env_20);
        }
    });
    (0, bun_test_1.it)("should report overflow when byte limit is reached", async () => {
        const env_21 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_21, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                run_in_background: false,
                script: `for i in {1..1000}; do echo 'This is line number '$i' with some content'; done`,
                timeout_secs: 5,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (isForegroundSuccess(result)) {
                (0, bun_test_1.expect)(result.output).toBe("");
                (0, bun_test_1.expect)(result.note).toMatch(/Total output exceeded limit|OUTPUT OVERFLOW/);
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
            }
        }
        catch (e_21) {
            env_21.error = e_21;
            env_21.hasError = true;
        }
        finally {
            __disposeResources(env_21);
        }
    });
    (0, bun_test_1.it)("should fail immediately when script is empty", async () => {
        const env_22 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_22, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Script parameter is empty");
                (0, bun_test_1.expect)(result.error).toContain("malformed tool call");
                (0, bun_test_1.expect)(result.exitCode).toBe(-1);
                (0, bun_test_1.expect)(result.wall_duration_ms).toBe(0);
            }
        }
        catch (e_22) {
            env_22.error = e_22;
            env_22.hasError = true;
        }
        finally {
            __disposeResources(env_22);
        }
    });
    (0, bun_test_1.it)("should fail immediately when script is only whitespace", async () => {
        const env_23 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_23, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "   \n\t  ",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Script parameter is empty");
                (0, bun_test_1.expect)(result.exitCode).toBe(-1);
                (0, bun_test_1.expect)(result.wall_duration_ms).toBe(0);
            }
        }
        catch (e_23) {
            env_23.error = e_23;
            env_23.hasError = true;
        }
        finally {
            __disposeResources(env_23);
        }
    });
    (0, bun_test_1.it)("should allow sleep command at start of script", async () => {
        const env_24 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_24, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "sleep 0.1; echo done",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("done");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
            }
        }
        catch (e_24) {
            env_24.error = e_24;
            env_24.hasError = true;
        }
        finally {
            __disposeResources(env_24);
        }
    });
    (0, bun_test_1.it)("should allow sleep in polling loops", async () => {
        const env_25 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_25, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "for i in 1 2 3; do echo $i; sleep 0.1; done",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toContain("1");
                (0, bun_test_1.expect)(result.output).toContain("2");
                (0, bun_test_1.expect)(result.output).toContain("3");
            }
        }
        catch (e_25) {
            env_25.error = e_25;
            env_25.hasError = true;
        }
        finally {
            __disposeResources(env_25);
        }
    });
    (0, bun_test_1.it)("should use default timeout (3s) when timeout_secs is undefined", async () => {
        const env_26 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_26, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo hello",
                timeout_secs: undefined,
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("hello");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
            }
        }
        catch (e_26) {
            env_26.error = e_26;
            env_26.hasError = true;
        }
        finally {
            __disposeResources(env_26);
        }
    });
    (0, bun_test_1.it)("should use default timeout (3s) when timeout_secs is omitted", async () => {
        const env_27 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_27, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo hello",
                // timeout_secs omitted entirely
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toBe("hello");
                (0, bun_test_1.expect)(result.exitCode).toBe(0);
            }
        }
        catch (e_27) {
            env_27.error = e_27;
            env_27.hasError = true;
        }
        finally {
            __disposeResources(env_27);
        }
    });
    // Note: Zero and negative timeout_secs are rejected by Zod schema validation
    // before reaching the execute function, so these cases are handled at the schema level
});
(0, bun_test_1.describe)("zombie process cleanup", () => {
    (0, bun_test_1.it)("should not create zombie processes when spawning background tasks", async () => {
        const env_28 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_28, createTestBashTool(), false);
            const tool = testEnv.tool;
            // Spawn a background sleep process that would become a zombie if not cleaned up
            // Use a unique marker to identify our test process
            const marker = `zombie-test-${Date.now()}`;
            const args = {
                script: `echo "${marker}"; sleep 100 & echo $!`,
                timeout_secs: 1,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            // Tool should complete successfully
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                const env_29 = { stack: [], error: void 0, hasError: false };
                try {
                    (0, bun_test_1.expect)(result.output).toContain(marker);
                    const lines = result.output.split("\n");
                    const bgPid = lines[1]; // Second line should be the background PID
                    // Give a moment for cleanup to happen
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    // Verify the background process was killed (process group cleanup)
                    const checkEnv = __addDisposableResource(env_29, createTestBashTool(), false);
                    const checkResult = (await checkEnv.tool.execute({
                        script: `ps -p ${bgPid} > /dev/null 2>&1 && echo "ALIVE" || echo "DEAD"`,
                        timeout_secs: 1,
                    }, mockToolCallOptions));
                    (0, bun_test_1.expect)(checkResult.success).toBe(true);
                    if (checkResult.success) {
                        (0, bun_test_1.expect)(checkResult.output).toBe("DEAD");
                    }
                }
                catch (e_28) {
                    env_29.error = e_28;
                    env_29.hasError = true;
                }
                finally {
                    __disposeResources(env_29);
                }
            }
        }
        catch (e_29) {
            env_28.error = e_29;
            env_28.hasError = true;
        }
        finally {
            __disposeResources(env_28);
        }
    });
    (0, bun_test_1.it)("should kill all processes when aborted via AbortController", async () => {
        const env_30 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_30, createTestBashTool(), false);
            const tool = testEnv.tool;
            // Create AbortController to simulate user interruption
            const abortController = new AbortController();
            // Use unique token to identify our test processes
            const token = (100 + Math.random() * 100).toFixed(4); // Unique duration for grep
            // Spawn a command that creates child processes (simulating cargo build)
            const args = {
                script: `
        # Simulate cargo spawning rustc processes
        for i in {1..5}; do
          (echo "child-\${i}"; exec sleep ${token}) &
          echo "SPAWNED:$!"
        done
        echo "ALL_SPAWNED"
        # Wait so we can abort while children are running
        exec sleep ${token}
      `,
                timeout_secs: 10,
                run_in_background: false,
                display_name: "test",
            };
            // Start the command
            const resultPromise = tool.execute(args, {
                ...mockToolCallOptions,
                abortSignal: abortController.signal,
            });
            // Wait for children to spawn
            await new Promise((resolve) => setTimeout(resolve, 500));
            // Abort the operation (simulating Ctrl+C)
            abortController.abort();
            // Wait for the result
            const result = await resultPromise;
            // Command should be aborted
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("aborted");
            }
            // Wait for all processes to be cleaned up (SIGKILL needs time to propagate in CI)
            // Retry with exponential backoff instead of fixed wait
            // Use ps + grep to avoid pgrep matching itself
            let remainingProcesses = -1;
            for (let attempt = 0; attempt < 5; attempt++) {
                const env_31 = { stack: [], error: void 0, hasError: false };
                try {
                    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
                    const checkEnv = __addDisposableResource(env_31, createTestBashTool(), false);
                    const checkResult = (await checkEnv.tool.execute({
                        script: `ps aux | grep "sleep ${token}" | grep -v grep | wc -l`,
                        timeout_secs: 1,
                    }, mockToolCallOptions));
                    (0, bun_test_1.expect)(checkResult.success).toBe(true);
                    if (checkResult.success) {
                        remainingProcesses = parseInt(checkResult.output.trim());
                        if (remainingProcesses === 0) {
                            break;
                        }
                    }
                }
                catch (e_30) {
                    env_31.error = e_30;
                    env_31.hasError = true;
                }
                finally {
                    __disposeResources(env_31);
                }
            }
            (0, bun_test_1.expect)(remainingProcesses).toBe(0);
        }
        catch (e_31) {
            env_30.error = e_31;
            env_30.hasError = true;
        }
        finally {
            __disposeResources(env_30);
        }
    });
    (0, bun_test_1.it)("should abort quickly when command produces continuous output", async () => {
        const env_32 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_32, createTestBashTool(), false);
            const tool = testEnv.tool;
            // Create AbortController to simulate user interruption
            const abortController = new AbortController();
            // Command that produces slow, continuous output
            // The key is it keeps running, so the abort happens while reader.read() is waiting
            const args = {
                script: `
        # Produce continuous output slowly (prevents hitting truncation limits)
        for i in {1..1000}; do
          echo "Output line $i"
          sleep 0.1
        done
      `,
                timeout_secs: 120,
                run_in_background: false,
                display_name: "test",
            };
            // Start the command
            const resultPromise = tool.execute(args, {
                ...mockToolCallOptions,
                abortSignal: abortController.signal,
            });
            // Wait for output to start (give it time to produce a few lines)
            await new Promise((resolve) => setTimeout(resolve, 250));
            // Abort the operation while it's still producing output
            const abortTime = Date.now();
            abortController.abort();
            // Wait for the result with a timeout to detect hangs
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Test timeout - tool did not abort quickly")), 5000));
            const result = (await Promise.race([resultPromise, timeoutPromise]));
            const duration = Date.now() - abortTime;
            // Command should be aborted
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                // Error should mention abort or indicate the process was killed
                const errorText = result.error.toLowerCase();
                (0, bun_test_1.expect)(errorText.includes("abort") ||
                    errorText.includes("killed") ||
                    errorText.includes("signal") ||
                    result.exitCode === -1).toBe(true);
            }
            // CRITICAL: Tool should return quickly after abort (< 2s)
            // This is the regression test - without checking abort signal in consumeStream(),
            // the tool hangs until the streams close (which can take a long time)
            (0, bun_test_1.expect)(duration).toBeLessThan(2000);
        }
        catch (e_32) {
            env_32.error = e_32;
            env_32.hasError = true;
        }
        finally {
            __disposeResources(env_32);
        }
    });
});
(0, bun_test_1.describe)("muxEnv environment variables", () => {
    (0, bun_test_1.it)("should inject UNIX_ environment variables when muxEnv is provided", async () => {
        const env_33 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_33, new testHelpers_1.TestTempDir("test-unix-env"), false);
            const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
            config.runtimeTempDir = tempDir.path;
            config.muxEnv = {
                UNIX_PROJECT_PATH: "/test/project/path",
                UNIX_RUNTIME: "worktree",
                UNIX_WORKSPACE_NAME: "feature-branch",
            };
            const tool = (0, bash_1.createBashTool)(config);
            const args = {
                script: 'echo "PROJECT:$UNIX_PROJECT_PATH RUNTIME:$UNIX_RUNTIME WORKSPACE:$UNIX_WORKSPACE_NAME"',
                timeout_secs: 5,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.output).toContain("PROJECT:/test/project/path");
                (0, bun_test_1.expect)(result.output).toContain("RUNTIME:worktree");
                (0, bun_test_1.expect)(result.output).toContain("WORKSPACE:feature-branch");
            }
        }
        catch (e_33) {
            env_33.error = e_33;
            env_33.hasError = true;
        }
        finally {
            __disposeResources(env_33);
        }
    });
    (0, bun_test_1.it)("should allow secrets to override muxEnv", async () => {
        const env_34 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_34, new testHelpers_1.TestTempDir("test-unix-env-override"), false);
            const config = (0, testHelpers_1.createTestToolConfig)(process.cwd());
            config.runtimeTempDir = tempDir.path;
            config.muxEnv = {
                UNIX_PROJECT_PATH: "/unix/path",
                CUSTOM_VAR: "from-unix",
            };
            config.secrets = {
                CUSTOM_VAR: "from-secrets",
            };
            const tool = (0, bash_1.createBashTool)(config);
            const args = {
                script: 'echo "UNIX:$UNIX_PROJECT_PATH CUSTOM:$CUSTOM_VAR"',
                timeout_secs: 5,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                // UNIX_PROJECT_PATH from muxEnv should be present
                (0, bun_test_1.expect)(result.output).toContain("UNIX:/unix/path");
                // Secrets should override muxEnv when there's a conflict
                (0, bun_test_1.expect)(result.output).toContain("CUSTOM:from-secrets");
            }
        }
        catch (e_34) {
            env_34.error = e_34;
            env_34.hasError = true;
        }
        finally {
            __disposeResources(env_34);
        }
    });
});
(0, bun_test_1.describe)("SSH runtime redundant cd detection", () => {
    // Helper to create bash tool with SSH runtime configuration
    // Note: These tests check redundant cd detection logic only - they don't actually execute via SSH
    function createTestBashToolWithSSH(cwd) {
        const tempDir = new testHelpers_1.TestTempDir("test-bash-ssh");
        const sshConfig = {
            type: "ssh",
            host: "test-host",
            srcBaseDir: "/remote/base",
        };
        const sshRuntime = (0, runtimeFactory_1.createRuntime)(sshConfig);
        // Pre-mark connection as healthy to skip actual SSH probe in tests
        sshConnectionPool_1.sshConnectionPool.markHealthy(sshConfig);
        const tool = (0, bash_1.createBashTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd,
            runtime: sshRuntime,
            runtimeTempDir: tempDir.path,
        });
        return {
            tool,
            [Symbol.dispose]() {
                tempDir[Symbol.dispose]();
            },
        };
    }
    (0, bun_test_1.it)("should reject redundant cd when command cds to working directory", async () => {
        const env_35 = { stack: [], error: void 0, hasError: false };
        try {
            const remoteCwd = "/remote/workspace/project/branch";
            const testEnv = __addDisposableResource(env_35, createTestBashToolWithSSH(remoteCwd), false);
            const tool = testEnv.tool;
            const args = {
                script: "cd /remote/workspace/project/branch && echo test",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            // Should reject the redundant cd
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Redundant cd to working directory");
                (0, bun_test_1.expect)(result.error).toContain("no cd needed");
                (0, bun_test_1.expect)(result.exitCode).toBe(-1);
            }
        }
        catch (e_35) {
            env_35.error = e_35;
            env_35.hasError = true;
        }
        finally {
            __disposeResources(env_35);
        }
    });
    (0, bun_test_1.it)("should not treat cd to a different directory as redundant", () => {
        // Only testing normalization here - SSH execution would hang (no real host).
        const remoteCwd = "/remote/workspace/project/branch";
        const sshRuntime = (0, runtimeFactory_1.createRuntime)({
            type: "ssh",
            host: "test-host",
            srcBaseDir: "/remote/base",
        });
        const normalizedTarget = sshRuntime.normalizePath("/tmp", remoteCwd);
        const normalizedCwd = sshRuntime.normalizePath(".", remoteCwd);
        (0, bun_test_1.expect)(normalizedTarget).not.toBe(normalizedCwd);
    });
});
(0, bun_test_1.describe)("bash tool - tool_env", () => {
    (0, bun_test_1.it)("should source .unix/tool_env before running script", async () => {
        const env_36 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_36, new testHelpers_1.TestTempDir("test-bash-tool-env"), false);
            const unixDir = `${tempDir.path}/.unix`;
            fs.mkdirSync(unixDir, { recursive: true });
            fs.writeFileSync(`${unixDir}/tool_env`, "export UNIX_TEST_VAR=from_tool_env");
            const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
            config.runtimeTempDir = tempDir.path;
            const tool = (0, bash_1.createBashTool)(config);
            const args = {
                script: "echo $UNIX_TEST_VAR",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.output).toBe("from_tool_env");
        }
        catch (e_36) {
            env_36.error = e_36;
            env_36.hasError = true;
        }
        finally {
            __disposeResources(env_36);
        }
    });
    (0, bun_test_1.it)("should fail with clear error if tool_env sourcing fails", async () => {
        const env_37 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_37, new testHelpers_1.TestTempDir("test-bash-tool-env-fail"), false);
            const unixDir = `${tempDir.path}/.unix`;
            fs.mkdirSync(unixDir, { recursive: true });
            // Fail `source` without terminating the parent shell.
            fs.writeFileSync(`${unixDir}/tool_env`, "return 1");
            const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
            config.runtimeTempDir = tempDir.path;
            const tool = (0, bash_1.createBashTool)(config);
            const args = {
                script: "echo should_not_run",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.exitCode).toBe(1);
            (0, bun_test_1.expect)(result.output).toContain("failed to source");
        }
        catch (e_37) {
            env_37.error = e_37;
            env_37.hasError = true;
        }
        finally {
            __disposeResources(env_37);
        }
    });
    (0, bun_test_1.it)("should run script normally when no tool_env exists", async () => {
        const env_38 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_38, new testHelpers_1.TestTempDir("test-bash-no-tool-env"), false);
            const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
            config.runtimeTempDir = tempDir.path;
            const tool = (0, bash_1.createBashTool)(config);
            const args = {
                script: "echo normal_execution",
                timeout_secs: 5,
                run_in_background: false,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.output).toBe("normal_execution");
        }
        catch (e_38) {
            env_38.error = e_38;
            env_38.hasError = true;
        }
        finally {
            __disposeResources(env_38);
        }
    });
});
(0, bun_test_1.describe)("bash tool - background execution", () => {
    (0, bun_test_1.it)("should reject background mode when manager not available", async () => {
        const env_39 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_39, createTestBashTool(), false);
            const tool = testEnv.tool;
            const args = {
                script: "echo test",
                timeout_secs: 5,
                run_in_background: true,
                display_name: "test",
            };
            const result = (await tool.execute(args, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Background execution is only available for AI tool calls");
            }
        }
        catch (e_39) {
            env_39.error = e_39;
            env_39.hasError = true;
        }
        finally {
            __disposeResources(env_39);
        }
    });
    (0, bun_test_1.it)("should accept timeout with background mode for auto-termination", async () => {
        const manager = new backgroundProcessManager_1.BackgroundProcessManager("/tmp/unix-test-bg");
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg");
        const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
        config.backgroundProcessManager = manager;
        const tool = (0, bash_1.createBashTool)(config);
        const args = {
            script: "echo test",
            timeout_secs: 5,
            run_in_background: true,
            display_name: "test-timeout-bg",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        // Background with timeout should succeed - timeout is used for auto-termination
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success && "backgroundProcessId" in result) {
            (0, bun_test_1.expect)(result.backgroundProcessId).toBe("test-timeout-bg");
        }
        await manager.terminateAll();
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should start background process and return process ID", async () => {
        const manager = new backgroundProcessManager_1.BackgroundProcessManager("/tmp/unix-test-bg");
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg");
        const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
        config.backgroundProcessManager = manager;
        const tool = (0, bash_1.createBashTool)(config);
        const args = {
            script: "echo hello",
            timeout_secs: 5,
            run_in_background: true,
            display_name: "test",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success && "backgroundProcessId" in result) {
            (0, bun_test_1.expect)(result.backgroundProcessId).toBeDefined();
            // Process ID is now the display name directly
            (0, bun_test_1.expect)(result.backgroundProcessId).toBe("test");
        }
        else {
            throw new Error("Expected background process ID in result");
        }
        tempDir[Symbol.dispose]();
    });
    (0, bun_test_1.it)("should inject muxEnv environment variables in background mode", async () => {
        const manager = new backgroundProcessManager_1.BackgroundProcessManager("/tmp/unix-test-bg");
        const tempDir = new testHelpers_1.TestTempDir("test-bash-bg-unix-env");
        const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
        config.backgroundProcessManager = manager;
        config.muxEnv = {
            UNIX_MODEL_STRING: "openai:gpt-5.2",
            UNIX_THINKING_LEVEL: "medium",
        };
        const tool = (0, bash_1.createBashTool)(config);
        const args = {
            script: 'echo "MODEL:$UNIX_MODEL_STRING THINKING:$UNIX_THINKING_LEVEL"',
            timeout_secs: 5,
            run_in_background: true,
            display_name: "test-unix-env-bg",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success && "backgroundProcessId" in result) {
            const outputResult = await manager.getOutput(result.backgroundProcessId, undefined, undefined, 2);
            (0, bun_test_1.expect)(outputResult.success).toBe(true);
            if (outputResult.success) {
                (0, bun_test_1.expect)(outputResult.output).toContain("MODEL:openai:gpt-5.2");
                (0, bun_test_1.expect)(outputResult.output).toContain("THINKING:medium");
            }
        }
        else {
            throw new Error("Expected background process ID in result");
        }
        await manager.terminateAll();
        tempDir[Symbol.dispose]();
    });
});
//# sourceMappingURL=bash.test.js.map