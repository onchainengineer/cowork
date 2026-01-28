"use strict";
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
const task_await_1 = require("./task_await");
const testHelpers_1 = require("./testHelpers");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
(0, bun_test_1.describe)("task_await tool", () => {
    (0, bun_test_1.it)("returns completed results for all awaited tasks", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_1, new testHelpers_1.TestTempDir("test-task-await-tool"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const taskService = {
                listActiveDescendantAgentTaskIds: (0, bun_test_1.mock)(() => ["t1", "t2"]),
                isDescendantAgentTask: (0, bun_test_1.mock)(() => true),
                waitForAgentReport: (0, bun_test_1.mock)((taskId) => Promise.resolve({ reportMarkdown: `report:${taskId}`, title: `title:${taskId}` })),
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ task_ids: ["t1", "t2"] }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({
                results: [
                    { status: "completed", taskId: "t1", reportMarkdown: "report:t1", title: "title:t1" },
                    { status: "completed", taskId: "t2", reportMarkdown: "report:t2", title: "title:t2" },
                ],
            });
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    });
    (0, bun_test_1.it)("supports filterDescendantAgentTaskIds without losing this binding", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_2, new testHelpers_1.TestTempDir("test-task-await-tool-this-binding"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const waitForAgentReport = (0, bun_test_1.mock)(() => Promise.resolve({ reportMarkdown: "ok" }));
            const isDescendantAgentTask = (0, bun_test_1.mock)(() => true);
            const taskService = {
                filterDescendantAgentTaskIds: function (ancestorWorkspaceId, taskIds) {
                    (0, bun_test_1.expect)(this).toBe(taskService);
                    (0, bun_test_1.expect)(ancestorWorkspaceId).toBe("parent-workspace");
                    (0, bun_test_1.expect)(taskIds).toEqual(["t1"]);
                    return taskIds;
                },
                listActiveDescendantAgentTaskIds: (0, bun_test_1.mock)(() => []),
                isDescendantAgentTask,
                waitForAgentReport,
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ task_ids: ["t1"] }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({
                results: [{ status: "completed", taskId: "t1", reportMarkdown: "ok", title: undefined }],
            });
            (0, bun_test_1.expect)(isDescendantAgentTask).toHaveBeenCalledTimes(0);
            (0, bun_test_1.expect)(waitForAgentReport).toHaveBeenCalledTimes(1);
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    (0, bun_test_1.it)("marks invalid_scope without calling waitForAgentReport", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_3, new testHelpers_1.TestTempDir("test-task-await-tool-invalid-scope"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const isDescendantAgentTask = (0, bun_test_1.mock)((ancestorId, taskId) => {
                (0, bun_test_1.expect)(ancestorId).toBe("parent-workspace");
                return taskId !== "other";
            });
            const waitForAgentReport = (0, bun_test_1.mock)(() => Promise.resolve({ reportMarkdown: "ok" }));
            const taskService = {
                listActiveDescendantAgentTaskIds: (0, bun_test_1.mock)(() => []),
                isDescendantAgentTask,
                waitForAgentReport,
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ task_ids: ["child", "other"] }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({
                results: [
                    { status: "completed", taskId: "child", reportMarkdown: "ok", title: undefined },
                    { status: "invalid_scope", taskId: "other" },
                ],
            });
            (0, bun_test_1.expect)(waitForAgentReport).toHaveBeenCalledTimes(1);
            (0, bun_test_1.expect)(waitForAgentReport).toHaveBeenCalledWith("child", bun_test_1.expect.any(Object));
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, bun_test_1.it)("defaults to waiting on all active descendant tasks when task_ids is omitted", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_4, new testHelpers_1.TestTempDir("test-task-await-tool-descendants"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const listActiveDescendantAgentTaskIds = (0, bun_test_1.mock)(() => ["t1"]);
            const isDescendantAgentTask = (0, bun_test_1.mock)(() => true);
            const waitForAgentReport = (0, bun_test_1.mock)(() => Promise.resolve({ reportMarkdown: "ok" }));
            const taskService = {
                listActiveDescendantAgentTaskIds,
                isDescendantAgentTask,
                waitForAgentReport,
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({}, mockToolCallOptions));
            (0, bun_test_1.expect)(listActiveDescendantAgentTaskIds).toHaveBeenCalledWith("parent-workspace");
            (0, bun_test_1.expect)(result).toEqual({
                results: [{ status: "completed", taskId: "t1", reportMarkdown: "ok", title: undefined }],
            });
        }
        catch (e_4) {
            env_4.error = e_4;
            env_4.hasError = true;
        }
        finally {
            __disposeResources(env_4);
        }
    });
    (0, bun_test_1.it)("maps wait errors to running/not_found/error statuses", async () => {
        const env_5 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_5, new testHelpers_1.TestTempDir("test-task-await-tool-errors"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const waitForAgentReport = (0, bun_test_1.mock)((taskId) => {
                if (taskId === "timeout") {
                    return Promise.reject(new Error("Timed out waiting for agent_report"));
                }
                if (taskId === "missing") {
                    return Promise.reject(new Error("Task not found"));
                }
                return Promise.reject(new Error("Boom"));
            });
            const taskService = {
                listActiveDescendantAgentTaskIds: (0, bun_test_1.mock)(() => []),
                isDescendantAgentTask: (0, bun_test_1.mock)(() => true),
                getAgentTaskStatus: (0, bun_test_1.mock)((taskId) => (taskId === "timeout" ? "running" : null)),
                waitForAgentReport,
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ task_ids: ["timeout", "missing", "boom"] }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({
                results: [
                    { status: "running", taskId: "timeout" },
                    { status: "not_found", taskId: "missing" },
                    { status: "error", taskId: "boom", error: "Boom" },
                ],
            });
        }
        catch (e_5) {
            env_5.error = e_5;
            env_5.hasError = true;
        }
        finally {
            __disposeResources(env_5);
        }
    });
    (0, bun_test_1.it)("treats timeout_secs=0 as non-blocking for agent tasks", async () => {
        const env_6 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_6, new testHelpers_1.TestTempDir("test-task-await-tool-timeout-zero"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const waitForAgentReport = (0, bun_test_1.mock)(() => {
                throw new Error("waitForAgentReport should not be called for timeout_secs=0");
            });
            const getAgentTaskStatus = (0, bun_test_1.mock)(() => "running");
            const taskService = {
                listActiveDescendantAgentTaskIds: (0, bun_test_1.mock)(() => ["t1"]),
                isDescendantAgentTask: (0, bun_test_1.mock)(() => true),
                getAgentTaskStatus,
                waitForAgentReport,
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ timeout_secs: 0 }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({ results: [{ status: "running", taskId: "t1" }] });
            (0, bun_test_1.expect)(waitForAgentReport).toHaveBeenCalledTimes(0);
            (0, bun_test_1.expect)(getAgentTaskStatus).toHaveBeenCalledWith("t1");
        }
        catch (e_6) {
            env_6.error = e_6;
            env_6.hasError = true;
        }
        finally {
            __disposeResources(env_6);
        }
    });
    (0, bun_test_1.it)("returns completed result when timeout_secs=0 and a cached report is available", async () => {
        const env_7 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_7, new testHelpers_1.TestTempDir("test-task-await-tool-timeout-zero-cached"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "parent-workspace" });
            const getAgentTaskStatus = (0, bun_test_1.mock)(() => null);
            const waitForAgentReport = (0, bun_test_1.mock)(() => Promise.resolve({ reportMarkdown: "ok", title: "cached-title" }));
            const taskService = {
                listActiveDescendantAgentTaskIds: (0, bun_test_1.mock)(() => ["t1"]),
                isDescendantAgentTask: (0, bun_test_1.mock)(() => true),
                getAgentTaskStatus,
                waitForAgentReport,
            };
            const tool = (0, task_await_1.createTaskAwaitTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ timeout_secs: 0 }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({
                results: [
                    {
                        status: "completed",
                        taskId: "t1",
                        reportMarkdown: "ok",
                        title: "cached-title",
                    },
                ],
            });
            (0, bun_test_1.expect)(getAgentTaskStatus).toHaveBeenCalledWith("t1");
            (0, bun_test_1.expect)(waitForAgentReport).toHaveBeenCalledTimes(1);
        }
        catch (e_7) {
            env_7.error = e_7;
            env_7.hasError = true;
        }
        finally {
            __disposeResources(env_7);
        }
    });
});
//# sourceMappingURL=task_await.test.js.map