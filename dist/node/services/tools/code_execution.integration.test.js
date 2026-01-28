"use strict";
/**
 * Integration tests for code_execution tool with real tools
 *
 * These tests prove the full end-to-end flow: code_execution -> QuickJS sandbox -> real tools -> real filesystem.
 * Unlike unit tests, these use real LocalRuntime and actual file operations.
 *
 * Run with: bun test src/node/services/tools/code_execution.integration.test.ts
 */
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
const code_execution_1 = require("./code_execution");
const file_read_1 = require("./file_read");
const bash_1 = require("./bash");
const quickjsRuntime_1 = require("../../../node/services/ptc/quickjsRuntime");
const toolBridge_1 = require("../../../node/services/ptc/toolBridge");
const testHelpers_1 = require("./testHelpers");
const zod_1 = require("zod");
const mockToolCallOptions = {
    toolCallId: "integration-test-call",
    messages: [],
};
(0, bun_test_1.describe)("code_execution integration tests", () => {
    const runtimeFactory = new quickjsRuntime_1.QuickJSRuntimeFactory();
    let testDir;
    let toolConfig;
    (0, bun_test_1.beforeEach)(async () => {
        // Create a temp directory for each test
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "ptc-integration-"));
        toolConfig = (0, testHelpers_1.createTestToolConfig)(testDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });
    (0, bun_test_1.describe)("file_read through sandbox", () => {
        (0, bun_test_1.it)("reads a real file viaunix.file_read()", async () => {
            // Create a real file
            const testContent = "hello from integration test\nline two\nline three";
            await fs.writeFile(path.join(testDir, "test.txt"), testContent);
            // Create real file_read tool
            const fileReadTool = (0, file_read_1.createFileReadTool)(toolConfig);
            const tools = { file_read: fileReadTool };
            // Track events
            const events = [];
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools), (e) => events.push(e));
            // Execute code that reads the file
            const code = `
        const result =unix.file_read({ file_path: "test.txt" });
        return result;
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            // Verify the result contains the file content
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.success).toBe(true);
            // The result should be the file_read response
            const fileReadResult = result.result;
            (0, bun_test_1.expect)(fileReadResult.success).toBe(true);
            (0, bun_test_1.expect)(fileReadResult.content).toContain("hello from integration test");
            (0, bun_test_1.expect)(fileReadResult.lines_read).toBe(3);
            // Verify tool call event was emitted
            const toolCallEndEvents = events.filter((e) => e.type === "tool-call-end");
            (0, bun_test_1.expect)(toolCallEndEvents.length).toBe(1);
            (0, bun_test_1.expect)(toolCallEndEvents[0].toolName).toBe("file_read");
            (0, bun_test_1.expect)(toolCallEndEvents[0].error).toBeUndefined();
        }, { timeout: 20_000 });
        (0, bun_test_1.it)("handles file not found gracefully", async () => {
            const fileReadTool = (0, file_read_1.createFileReadTool)(toolConfig);
            const tools = { file_read: fileReadTool };
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools));
            const code = `
        const result =unix.file_read({ file_path: "nonexistent.txt" });
        return result;
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            // file_read returns success: false for missing files, not an exception
            const fileReadResult = result.result;
            (0, bun_test_1.expect)(fileReadResult.success).toBe(false);
            // Error contains ENOENT or stat failure message
            (0, bun_test_1.expect)(fileReadResult.error).toMatch(/ENOENT|stat/i);
        }, { timeout: 20_000 });
    });
    (0, bun_test_1.describe)("bash through sandbox", () => {
        (0, bun_test_1.it)("executes a real bash command viaunix.bash()", async () => {
            // Create real bash tool
            const tempDir = new testHelpers_1.TestTempDir("ptc-bash-integration");
            const bashConfig = {
                ...toolConfig,
                ...(0, testHelpers_1.getTestDeps)(),
                runtimeTempDir: tempDir.path,
            };
            const bashTool = (0, bash_1.createBashTool)(bashConfig);
            const tools = { bash: bashTool };
            const events = [];
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools), (e) => events.push(e));
            // Execute a simple echo command
            const code = `
        const result =unix.bash({
          script: "echo 'hello from sandbox'",
          timeout_secs: 5,
          run_in_background: false,
          display_name: "test echo"
        });
        return result;
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            const bashResult = result.result;
            (0, bun_test_1.expect)(bashResult.success).toBe(true);
            (0, bun_test_1.expect)(bashResult.output).toContain("hello from sandbox");
            // Verify event
            const toolCallEndEvents = events.filter((e) => e.type === "tool-call-end");
            (0, bun_test_1.expect)(toolCallEndEvents.length).toBe(1);
            (0, bun_test_1.expect)(toolCallEndEvents[0].toolName).toBe("bash");
            tempDir[Symbol.dispose]();
        });
        (0, bun_test_1.it)("creates a file via bash and reads it via file_read", async () => {
            // This test proves multiple tools can work together in a single sandbox execution
            const tempDir = new testHelpers_1.TestTempDir("ptc-multi-tool-integration");
            const bashConfig = {
                ...toolConfig,
                ...(0, testHelpers_1.getTestDeps)(),
                runtimeTempDir: tempDir.path,
            };
            const bashTool = (0, bash_1.createBashTool)(bashConfig);
            const fileReadTool = (0, file_read_1.createFileReadTool)(toolConfig);
            const tools = {
                bash: bashTool,
                file_read: fileReadTool,
            };
            const events = [];
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools), (e) => events.push(e));
            // Code that creates a file with bash, then reads it with file_read
            const code = `
        // Create a file using bash
        const bashResult =unix.bash({
          script: "echo 'created by sandbox' > sandbox_created.txt",
          timeout_secs: 5,
          run_in_background: false,
          display_name: "create file"
        });
        
        if (!bashResult.success) {
          return { error: "bash failed", bashResult };
        }
        
        // Read the file we just created
        const readResult =unix.file_read({ file_path: "sandbox_created.txt" });
        
        return {
          bashResult,
          readResult,
          fileWasCreated: readResult.success && readResult.content.includes("created by sandbox")
        };
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            const combinedResult = result.result;
            (0, bun_test_1.expect)(combinedResult.bashResult.success).toBe(true);
            (0, bun_test_1.expect)(combinedResult.readResult.success).toBe(true);
            (0, bun_test_1.expect)(combinedResult.fileWasCreated).toBe(true);
            // Verify both tool calls were recorded
            const toolCallEndEvents = events.filter((e) => e.type === "tool-call-end");
            (0, bun_test_1.expect)(toolCallEndEvents.length).toBe(2);
            (0, bun_test_1.expect)(toolCallEndEvents.map((e) => e.toolName).sort()).toEqual(["bash", "file_read"]);
            // Verify file actually exists on disk
            const fileExists = await fs
                .access(path.join(testDir, "sandbox_created.txt"))
                .then(() => true)
                .catch(() => false);
            (0, bun_test_1.expect)(fileExists).toBe(true);
            tempDir[Symbol.dispose]();
        });
    });
    (0, bun_test_1.describe)("error handling", () => {
        (0, bun_test_1.it)("returns validation error for invalid tool arguments", async () => {
            const fileReadTool = (0, file_read_1.createFileReadTool)(toolConfig);
            const tools = { file_read: fileReadTool };
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools));
            // Call file_read without required file_path argument
            const code = `
        const result =unix.file_read({});
        return result;
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            // Tool bridge validation throws, which causes sandbox execution to fail
            // The error is propagated to the PTCExecutionResult
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("file_path");
        });
        (0, bun_test_1.it)("handles tool execution exceptions gracefully", async () => {
            // Create a tool that throws
            const throwingTool = {
                description: "A tool that throws",
                inputSchema: zod_1.z.object({}),
                execute: () => {
                    throw new Error("Intentional test error");
                },
            };
            const tools = { throwing_tool: throwingTool };
            const events = [];
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools), (e) => events.push(e));
            const code = `
        const result =unix.throwing_tool({});
        return result;
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            // Tool exception causes sandbox execution to fail
            // The error is propagated to the PTCExecutionResult
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Intentional test error");
            // Event should record failure
            const toolCallEndEvents = events.filter((e) => e.type === "tool-call-end");
            (0, bun_test_1.expect)(toolCallEndEvents.length).toBe(1);
            (0, bun_test_1.expect)(toolCallEndEvents[0].error).toContain("Intentional test error");
        });
    });
    (0, bun_test_1.describe)("console logging", () => {
        (0, bun_test_1.it)("captures console.log from sandbox code", async () => {
            const fileReadTool = (0, file_read_1.createFileReadTool)(toolConfig);
            const tools = { file_read: fileReadTool };
            const events = [];
            const codeExecutionTool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools), (e) => events.push(e));
            const code = `
        console.log("debug message from sandbox");
        console.warn("warning message");
        console.error("error message");
        return "done";
      `;
            const result = (await codeExecutionTool.execute({ code }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            // Verify console events
            const consoleEvents = events.filter((e) => e.type === "console");
            (0, bun_test_1.expect)(consoleEvents.length).toBe(3);
            (0, bun_test_1.expect)(consoleEvents.map((e) => e.level)).toEqual([
                "log",
                "warn",
                "error",
            ]);
        });
    });
});
//# sourceMappingURL=code_execution.integration.test.js.map