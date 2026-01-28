"use strict";
/**
 * Tests for code_execution tool
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const code_execution_1 = require("./code_execution");
const quickjsRuntime_1 = require("../../../node/services/ptc/quickjsRuntime");
const toolBridge_1 = require("../../../node/services/ptc/toolBridge");
const zod_1 = require("zod");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
/**
 * Realistic mock result shapes matching actual tool result schemas.
 */
const mockResults = {
    file_read: {
        success: true,
        content: "mock file content",
        file_size: 100,
        modifiedTime: "2025-01-01T00:00:00Z",
        lines_read: 5,
    },
    bash: {
        success: true,
        output: "mock output",
        exitCode: 0,
        wall_duration_ms: 10,
    },
};
// Create a mock tool for testing - accepts sync functions
function createMockTool(name, schema, executeFn) {
    const defaultResult = mockResults[name];
    const tool = {
        description: `Mock ${name} tool`,
        inputSchema: schema,
        execute: executeFn
            ? (args) => Promise.resolve(executeFn(args))
            : () => Promise.resolve(defaultResult ?? { success: true }),
    };
    return tool;
}
(0, bun_test_1.describe)("createCodeExecutionTool", () => {
    const runtimeFactory = new quickjsRuntime_1.QuickJSRuntimeFactory();
    (0, bun_test_1.describe)("tool creation", () => {
        (0, bun_test_1.it)("creates tool with description containing available tools", async () => {
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
                bash: createMockTool("bash", zod_1.z.object({ script: zod_1.z.string() }), () => ({ output: "ok" })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const desc = tool.description ?? "";
            // Description now contains TypeScript definitions instead of prose
            (0, bun_test_1.expect)(desc).toContain("function file_read");
            (0, bun_test_1.expect)(desc).toContain("function bash");
        });
        (0, bun_test_1.it)("excludes UI-specific tools from description", async () => {
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
                todo_write: createMockTool("todo_write", zod_1.z.object({ todos: zod_1.z.array(zod_1.z.string()) }), () => ({
                    success: true,
                })),
                status_set: createMockTool("status_set", zod_1.z.object({ message: zod_1.z.string() }), () => ({
                    success: true,
                })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const desc = tool.description ?? "";
            // Description now contains TypeScript definitions
            (0, bun_test_1.expect)(desc).toContain("function file_read");
            (0, bun_test_1.expect)(desc).not.toContain("function todo_write");
            (0, bun_test_1.expect)(desc).not.toContain("function status_set");
        });
        (0, bun_test_1.it)("excludes provider-native tools without execute function", async () => {
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
                web_search: {
                    description: "Provider-native search",
                    inputSchema: zod_1.z.object({ query: zod_1.z.string() }),
                    // No execute function - provider handles this
                },
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const desc = tool.description ?? "";
            // Description now contains TypeScript definitions
            (0, bun_test_1.expect)(desc).toContain("function file_read");
            (0, bun_test_1.expect)(desc).not.toContain("function web_search");
        });
    });
    (0, bun_test_1.describe)("static analysis", () => {
        (0, bun_test_1.it)("rejects code with syntax errors", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: "const x = {" }, // Unclosed brace
            mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
        });
        (0, bun_test_1.it)("includes line numbers for syntax errors with invalid tokens", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            // Invalid token @ on line 2 - parser detects it on the exact line
            const result = (await tool.execute({ code: "const x = 1;\nconst y = @;\nconst z = 3;" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
            (0, bun_test_1.expect)(result.error).toContain("(line 2)");
        });
        (0, bun_test_1.it)("rejects code using unavailable globals", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: "const env = process.env" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
            (0, bun_test_1.expect)(result.error).toContain("process");
        });
        (0, bun_test_1.it)("includes line numbers for unavailable globals", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: "const x = 1;\nconst y = 2;\nconst env = process.env" }, // process on line 3
            mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("(line 3)");
        });
        (0, bun_test_1.it)("rejects code using require()", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: 'const fs = require("fs")' }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
            (0, bun_test_1.expect)(result.error).toContain("require");
        });
        (0, bun_test_1.it)("includes line and column numbers for type errors", async () => {
            const mockTools = {
                bash: createMockTool("bash", zod_1.z.object({ script: zod_1.z.string() })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({ code: "const x = 1;\nconst result =unix.bash({ scriptz: 'ls' });" }, // typo on line 2
            mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
            (0, bun_test_1.expect)(result.error).toContain("scriptz");
            (0, bun_test_1.expect)(result.error).toContain("(line 2, col");
        });
        (0, bun_test_1.it)("includes line and column for calling non-existent tools", async () => {
            const mockTools = {
                bash: createMockTool("bash", zod_1.z.object({ script: zod_1.z.string() })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({ code: "const x = 1;\nconst y = 2;\nmux.nonexistent({ arg: 1 });" }, // line 3
            mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
            (0, bun_test_1.expect)(result.error).toContain("(line 3, col");
        });
    });
    (0, bun_test_1.describe)("code execution", () => {
        (0, bun_test_1.it)("executes simple code and returns result", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: "return 1 + 2" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.result).toBe(3);
        });
        (0, bun_test_1.it)("captures console.log output", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: 'console.log("hello", 123); return "done"' }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.result).toBe("done");
            (0, bun_test_1.expect)(result.consoleOutput).toHaveLength(1);
            (0, bun_test_1.expect)(result.consoleOutput[0].level).toBe("log");
            (0, bun_test_1.expect)(result.consoleOutput[0].args).toEqual(["hello", 123]);
        });
        (0, bun_test_1.it)("records tool execution time", async () => {
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}));
            const result = (await tool.execute({ code: "return 42" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.duration_ms).toBeGreaterThanOrEqual(0);
        });
    });
    (0, bun_test_1.describe)("tool bridge integration", () => {
        (0, bun_test_1.it)("calls bridged tools and returns results", async () => {
            const mockExecute = (0, bun_test_1.mock)((args) => {
                const { filePath } = args;
                return {
                    success: true,
                    content: `Content of ${filePath}`,
                    file_size: 100,
                    modifiedTime: "2025-01-01T00:00:00Z",
                    lines_read: 1,
                };
            });
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), mockExecute),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({ code: 'returnunix.file_read({ filePath: "test.txt" })' }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.result).toMatchObject({
                content: "Content of test.txt",
                success: true,
            });
            (0, bun_test_1.expect)(mockExecute).toHaveBeenCalledTimes(1);
        });
        (0, bun_test_1.it)("records tool calls in result", async () => {
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({ code: 'unix.file_read({ filePath: "a.txt" }); return "done"' }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.toolCalls).toHaveLength(1);
            (0, bun_test_1.expect)(result.toolCalls[0].toolName).toBe("file_read");
            (0, bun_test_1.expect)(result.toolCalls[0].args).toEqual({ filePath: "a.txt" });
            (0, bun_test_1.expect)(result.toolCalls[0].result).toMatchObject({
                content: "mock file content",
                success: true,
            });
            (0, bun_test_1.expect)(result.toolCalls[0].duration_ms).toBeGreaterThanOrEqual(0);
        });
        (0, bun_test_1.it)("validates tool arguments against schema", async () => {
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({ code: "returnunix.file_read({ wrongField: 123 })" }, mockToolCallOptions));
            // Now caught by TypeScript type validation at compile time, not runtime
            (0, bun_test_1.expect)(result.success).toBe(false);
            // Error message contains TypeScript diagnostic (e.g., "filePath" required)
            (0, bun_test_1.expect)(result.error).toContain("Code analysis failed");
        });
        (0, bun_test_1.it)("handles tool execution errors gracefully", async () => {
            const mockTools = {
                failing_tool: createMockTool("failing_tool", zod_1.z.object({}), () => {
                    throw new Error("Tool failed!");
                }),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({ code: "returnunix.failing_tool({})" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("Tool failed!");
            // Should still record the failed tool call
            (0, bun_test_1.expect)(result.toolCalls).toHaveLength(1);
            (0, bun_test_1.expect)(result.toolCalls[0].error).toContain("Tool failed!");
        });
        (0, bun_test_1.it)("returns partial results when execution fails mid-way", async () => {
            let callCount = 0;
            const mockTools = {
                counter: createMockTool("counter", zod_1.z.object({}), () => {
                    callCount++;
                    if (callCount === 2) {
                        throw new Error("Second call failed");
                    }
                    return { count: callCount };
                }),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const result = (await tool.execute({
                code: `
           unix.counter({});
           unix.counter({}); // This one fails
           unix.counter({}); // Never reached
            return "done";
          `,
            }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.toolCalls).toHaveLength(2);
            (0, bun_test_1.expect)(result.toolCalls[0].result).toEqual({ count: 1 });
            (0, bun_test_1.expect)(result.toolCalls[1].error).toContain("Second call failed");
        });
    });
    (0, bun_test_1.describe)("event streaming", () => {
        (0, bun_test_1.it)("emits events for tool calls", async () => {
            const events = [];
            const onEvent = (event) => events.push(event);
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools), onEvent);
            await tool.execute({ code: 'returnunix.file_read({ filePath: "test.txt" })' }, mockToolCallOptions);
            const toolCallEvents = events.filter((e) => e.type === "tool-call-start" || e.type === "tool-call-end");
            (0, bun_test_1.expect)(toolCallEvents).toHaveLength(2);
            (0, bun_test_1.expect)(toolCallEvents[0].type).toBe("tool-call-start");
            (0, bun_test_1.expect)(toolCallEvents[1].type).toBe("tool-call-end");
        });
        (0, bun_test_1.it)("emits events for console output", async () => {
            const events = [];
            const onEvent = (event) => events.push(event);
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge({}), onEvent);
            await tool.execute({ code: 'console.log("test"); console.warn("warning"); return 1' }, mockToolCallOptions);
            const consoleEvents = events.filter((e) => e.type === "console");
            (0, bun_test_1.expect)(consoleEvents).toHaveLength(2);
            (0, bun_test_1.expect)(consoleEvents[0].level).toBe("log");
            (0, bun_test_1.expect)(consoleEvents[1].level).toBe("warn");
        });
    });
    (0, bun_test_1.describe)("abort handling", () => {
        (0, bun_test_1.it)("aborts execution when signal is triggered", async () => {
            const mockTools = {
                slow_tool: createMockTool("slow_tool", zod_1.z.object({}), async () => {
                    // Simulate slow operation
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    return { done: true };
                }),
            };
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const abortController = new AbortController();
            // Abort immediately
            abortController.abort();
            const result = (await tool.execute({ code: "returnunix.slow_tool({})" }, { toolCallId: "test-1", messages: [], abortSignal: abortController.signal }));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toContain("abort");
        });
    });
    (0, bun_test_1.describe)("type caching", () => {
        (0, bun_test_1.it)("returns consistent types for same tool set", async () => {
            (0, code_execution_1.clearTypeCaches)();
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
            };
            const tool1 = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const tool2 = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const desc1 = tool1.description ?? "";
            const desc2 = tool2.description ?? "";
            (0, bun_test_1.expect)(desc1).toBe(desc2);
            (0, bun_test_1.expect)(desc1).toContain("function file_read");
        });
        (0, bun_test_1.it)("regenerates types when tool set changes", async () => {
            (0, code_execution_1.clearTypeCaches)();
            const tools1 = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
            };
            const tools2 = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
                bash: createMockTool("bash", zod_1.z.object({ script: zod_1.z.string() }), () => ({
                    output: "ok",
                })),
            };
            const tool1 = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools1));
            const tool2 = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(tools2));
            const desc1 = tool1.description ?? "";
            const desc2 = tool2.description ?? "";
            (0, bun_test_1.expect)(desc1).not.toBe(desc2);
            (0, bun_test_1.expect)(desc1).not.toContain("function bash");
            (0, bun_test_1.expect)(desc2).toContain("function bash");
        });
        (0, bun_test_1.it)("clearTypeCaches forces regeneration", async () => {
            const mockTools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), () => ({
                    content: "test",
                })),
            };
            // First call to populate cache
            await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            // Clear and verify new generation works
            (0, code_execution_1.clearTypeCaches)();
            const tool = await (0, code_execution_1.createCodeExecutionTool)(runtimeFactory, new toolBridge_1.ToolBridge(mockTools));
            const desc = tool.description ?? "";
            (0, bun_test_1.expect)(desc).toContain("function file_read");
        });
    });
});
//# sourceMappingURL=code_execution.test.js.map