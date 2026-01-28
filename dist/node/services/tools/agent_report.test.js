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
const agent_report_1 = require("./agent_report");
const testHelpers_1 = require("./testHelpers");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
(0, bun_test_1.describe)("agent_report tool", () => {
    (0, bun_test_1.it)("throws when the task has active descendants", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_1, new testHelpers_1.TestTempDir("test-agent-report-tool"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "task-workspace" });
            const taskService = {
                hasActiveDescendantAgentTasksForWorkspace: (0, bun_test_1.mock)(() => true),
            };
            const tool = (0, agent_report_1.createAgentReportTool)({ ...baseConfig, taskService });
            let caught = null;
            try {
                await Promise.resolve(tool.execute({ reportMarkdown: "done", title: "t" }, mockToolCallOptions));
            }
            catch (error) {
                caught = error;
            }
            (0, bun_test_1.expect)(caught).toBeInstanceOf(Error);
            if (caught instanceof Error) {
                (0, bun_test_1.expect)(caught.message).toMatch(/still has running\/queued/i);
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
    (0, bun_test_1.it)("returns success when the task has no active descendants", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_2, new testHelpers_1.TestTempDir("test-agent-report-tool-ok"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, { workspaceId: "task-workspace" });
            const taskService = {
                hasActiveDescendantAgentTasksForWorkspace: (0, bun_test_1.mock)(() => false),
            };
            const tool = (0, agent_report_1.createAgentReportTool)({ ...baseConfig, taskService });
            const result = await Promise.resolve(tool.execute({ reportMarkdown: "done", title: "t" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result).toEqual({ success: true });
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
});
//# sourceMappingURL=agent_report.test.js.map