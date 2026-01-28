"use strict";
/**
 * Tests for ToolBridge
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const toolBridge_1 = require("./toolBridge");
const zod_1 = require("zod");
// Helper to create a mock runtime for testing
function createMockRuntime(overrides = {}) {
    const defaultResult = {
        success: true,
        result: undefined,
        toolCalls: [],
        consoleOutput: [],
        duration_ms: 0,
    };
    return {
        eval: (0, bun_test_1.mock)(() => Promise.resolve(defaultResult)),
        registerFunction: (0, bun_test_1.mock)((_name, _fn) => undefined),
        registerObject: (0, bun_test_1.mock)((_name, _obj) => undefined),
        setLimits: (0, bun_test_1.mock)((_limits) => undefined),
        onEvent: (0, bun_test_1.mock)((_handler) => undefined),
        abort: (0, bun_test_1.mock)(() => undefined),
        getAbortSignal: (0, bun_test_1.mock)(() => undefined),
        dispose: (0, bun_test_1.mock)(() => undefined),
        [Symbol.dispose]: (0, bun_test_1.mock)(() => undefined),
        ...overrides,
    };
}
// Create a mock tool for testing - executeFn can be sync, will be wrapped
function createMockTool(name, schema, executeFn) {
    const tool = {
        description: `Mock ${name} tool`,
        inputSchema: schema,
        ...(executeFn ? { execute: (args) => Promise.resolve(executeFn(args)) } : {}),
    };
    return tool;
}
(0, bun_test_1.describe)("ToolBridge", () => {
    (0, bun_test_1.describe)("constructor", () => {
        (0, bun_test_1.it)("filters out excluded tools", () => {
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({}), () => ({})),
                code_execution: createMockTool("code_execution", zod_1.z.object({}), () => ({})),
                ask_user_question: createMockTool("ask_user_question", zod_1.z.object({}), () => ({})),
                propose_plan: createMockTool("propose_plan", zod_1.z.object({}), () => ({})),
                todo_write: createMockTool("todo_write", zod_1.z.object({}), () => ({})),
                todo_read: createMockTool("todo_read", zod_1.z.object({}), () => ({})),
                status_set: createMockTool("status_set", zod_1.z.object({}), () => ({})),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            const names = bridge.getBridgeableToolNames();
            (0, bun_test_1.expect)(names).toEqual(["file_read"]);
            (0, bun_test_1.expect)(names).not.toContain("code_execution");
            (0, bun_test_1.expect)(names).not.toContain("ask_user_question");
            (0, bun_test_1.expect)(names).not.toContain("propose_plan");
            (0, bun_test_1.expect)(names).not.toContain("todo_write");
            (0, bun_test_1.expect)(names).not.toContain("todo_read");
            (0, bun_test_1.expect)(names).not.toContain("status_set");
        });
        (0, bun_test_1.it)("filters out tools without execute function", () => {
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({}), () => ({})),
                web_search: createMockTool("web_search", zod_1.z.object({})), // No execute
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            const names = bridge.getBridgeableToolNames();
            (0, bun_test_1.expect)(names).toEqual(["file_read"]);
            (0, bun_test_1.expect)(names).not.toContain("web_search");
        });
    });
    (0, bun_test_1.describe)("getBridgeableToolNames", () => {
        (0, bun_test_1.it)("returns list of bridgeable tool names", () => {
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({}), () => ({})),
                bash: createMockTool("bash", zod_1.z.object({}), () => ({})),
                web_fetch: createMockTool("web_fetch", zod_1.z.object({}), () => ({})),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            const names = bridge.getBridgeableToolNames();
            (0, bun_test_1.expect)(names).toHaveLength(3);
            (0, bun_test_1.expect)(names).toContain("file_read");
            (0, bun_test_1.expect)(names).toContain("bash");
            (0, bun_test_1.expect)(names).toContain("web_fetch");
        });
    });
    (0, bun_test_1.describe)("register", () => {
        (0, bun_test_1.it)("registers tools under unix namespace", () => {
            const mockRegisterObject = (0, bun_test_1.mock)((_name, _obj) => undefined);
            const mockRuntime = createMockRuntime({ registerObject: mockRegisterObject });
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({}), () => ({})),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            bridge.register(mockRuntime);
            (0, bun_test_1.expect)(mockRegisterObject).toHaveBeenCalledTimes(1);
            const call = mockRegisterObject.mock.calls[0];
            const [name, obj] = call;
            (0, bun_test_1.expect)(name).toBe("unix");
            (0, bun_test_1.expect)(typeof obj).toBe("object");
            (0, bun_test_1.expect)(typeof obj.file_read).toBe("function");
        });
        (0, bun_test_1.it)("validates arguments before executing tool", async () => {
            const mockExecute = (0, bun_test_1.mock)(() => ({ result: "ok" }));
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), mockExecute),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            // Create a simple mock runtime that captures registered functions
            let registeredMux = {};
            const mockRegisterObject = (0, bun_test_1.mock)((name, obj) => {
                if (name === "unix")
                    registeredMux = obj;
                return undefined;
            });
            const mockRuntime = createMockRuntime({ registerObject: mockRegisterObject });
            bridge.register(mockRuntime);
            // Call with invalid args - should throw
            // Type assertion needed because Record indexing returns T | undefined for ESLint
            const fileRead = registeredMux.file_read;
            try {
                await fileRead({ wrongField: "test" });
                bun_test_1.expect.unreachable("Should have thrown");
            }
            catch (e) {
                (0, bun_test_1.expect)(String(e)).toContain("Invalid arguments for file_read");
            }
            // Call with valid args - should succeed
            await fileRead({ filePath: "test.txt" });
            (0, bun_test_1.expect)(mockExecute).toHaveBeenCalledTimes(1);
        });
        (0, bun_test_1.it)("serializes non-JSON values", async () => {
            // Tool that returns a non-plain object (with circular reference)
            const circularObj = { a: 1 };
            circularObj.self = circularObj;
            const mockExecute = (0, bun_test_1.mock)(() => circularObj);
            const tools = {
                circular: createMockTool("circular", zod_1.z.object({}), mockExecute),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            let registeredMux = {};
            const mockRegisterObject = (0, bun_test_1.mock)((name, obj) => {
                if (name === "unix")
                    registeredMux = obj;
                return undefined;
            });
            const mockRuntime = createMockRuntime({ registerObject: mockRegisterObject });
            bridge.register(mockRuntime);
            const result = await registeredMux.circular({});
            (0, bun_test_1.expect)(result).toEqual({ error: "Result not JSON-serializable" });
        });
        (0, bun_test_1.it)("uses runtime abort signal for tool cancellation", async () => {
            const mockExecute = (0, bun_test_1.mock)((_args) => ({ result: "ok" }));
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), mockExecute),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            let registeredMux = {};
            const mockRegisterObject = (0, bun_test_1.mock)((name, obj) => {
                if (name === "unix")
                    registeredMux = obj;
                return undefined;
            });
            // Provide an abort signal via getAbortSignal
            const abortController = new AbortController();
            const mockRuntime = createMockRuntime({
                registerObject: mockRegisterObject,
                getAbortSignal: () => abortController.signal,
            });
            bridge.register(mockRuntime);
            await registeredMux.file_read({ filePath: "test.txt" });
            (0, bun_test_1.expect)(mockExecute).toHaveBeenCalledTimes(1);
        });
        (0, bun_test_1.it)("throws if runtime abort signal is already aborted", async () => {
            const mockExecute = (0, bun_test_1.mock)(() => ({ result: "ok" }));
            const tools = {
                file_read: createMockTool("file_read", zod_1.z.object({ filePath: zod_1.z.string() }), mockExecute),
            };
            const bridge = new toolBridge_1.ToolBridge(tools);
            let registeredMux = {};
            const mockRegisterObject = (0, bun_test_1.mock)((name, obj) => {
                if (name === "unix")
                    registeredMux = obj;
                return undefined;
            });
            // Pre-abort the signal
            const abortController = new AbortController();
            abortController.abort();
            const mockRuntime = createMockRuntime({
                registerObject: mockRegisterObject,
                getAbortSignal: () => abortController.signal,
            });
            bridge.register(mockRuntime);
            // Type assertion needed because Record indexing returns T | undefined for ESLint
            const fileRead = registeredMux.file_read;
            try {
                await fileRead({ filePath: "test.txt" });
                bun_test_1.expect.unreachable("Should have thrown");
            }
            catch (e) {
                (0, bun_test_1.expect)(String(e)).toContain("Execution aborted");
            }
            (0, bun_test_1.expect)(mockExecute).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=toolBridge.test.js.map