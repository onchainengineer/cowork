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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const muxChat_1 = require("../../../common/constants/muxChat");
const tools_1 = require("../../../common/types/tools");
const mux_global_agents_read_1 = require("./mux_global_agents_read");
const mux_global_agents_write_1 = require("./mux_global_agents_write");
const testHelpers_1 = require("./testHelpers");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
(0, bun_test_1.describe)("mux_global_agents_* tools", () => {
    (0, bun_test_1.it)("reads ~/.mux/AGENTS.md (returns empty string if missing)", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const muxHome = __addDisposableResource(env_1, new testHelpers_1.TestTempDir("mux-global-agents"), false);
            const workspaceSessionDir = path.join(muxHome.path, "sessions", muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID);
            await fs.mkdir(workspaceSessionDir, { recursive: true });
            const config = (0, testHelpers_1.createTestToolConfig)(muxHome.path, {
                workspaceId: muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID,
                sessionsDir: workspaceSessionDir,
            });
            const tool = (0, mux_global_agents_read_1.createMuxGlobalAgentsReadTool)(config);
            // Missing file -> empty
            const missing = (await tool.execute({}, mockToolCallOptions));
            (0, bun_test_1.expect)(missing.success).toBe(true);
            if (missing.success) {
                (0, bun_test_1.expect)(missing.content).toBe("");
            }
            // Present file -> contents
            const agentsPath = path.join(muxHome.path, "AGENTS.md");
            await fs.writeFile(agentsPath, `# ${muxChat_1.MUX_HELP_CHAT_WORKSPACE_TITLE}\n${muxChat_1.MUX_HELP_CHAT_WORKSPACE_NAME}\n`, "utf-8");
            const result = (await tool.execute({}, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.content).toContain(muxChat_1.MUX_HELP_CHAT_WORKSPACE_TITLE);
                (0, bun_test_1.expect)(result.content).toContain(muxChat_1.MUX_HELP_CHAT_WORKSPACE_NAME);
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
    (0, bun_test_1.it)("refuses to write without explicit confirmation", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const muxHome = __addDisposableResource(env_2, new testHelpers_1.TestTempDir("mux-global-agents"), false);
            const workspaceSessionDir = path.join(muxHome.path, "sessions", muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID);
            await fs.mkdir(workspaceSessionDir, { recursive: true });
            const config = (0, testHelpers_1.createTestToolConfig)(muxHome.path, {
                workspaceId: muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID,
                sessionsDir: workspaceSessionDir,
            });
            const tool = (0, mux_global_agents_write_1.createMuxGlobalAgentsWriteTool)(config);
            const agentsPath = path.join(muxHome.path, "AGENTS.md");
            const result = (await tool.execute({ newContent: "test", confirm: false }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("confirm");
            }
            let readError;
            try {
                await fs.readFile(agentsPath, "utf-8");
            }
            catch (error) {
                readError = error;
            }
            (0, bun_test_1.expect)(readError).toMatchObject({ code: "ENOENT" });
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    (0, bun_test_1.it)("writes ~/.mux/AGENTS.md and returns a diff", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const muxHome = __addDisposableResource(env_3, new testHelpers_1.TestTempDir("mux-global-agents"), false);
            const workspaceSessionDir = path.join(muxHome.path, "sessions", muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID);
            await fs.mkdir(workspaceSessionDir, { recursive: true });
            const config = (0, testHelpers_1.createTestToolConfig)(muxHome.path, {
                workspaceId: muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID,
                sessionsDir: workspaceSessionDir,
            });
            const tool = (0, mux_global_agents_write_1.createMuxGlobalAgentsWriteTool)(config);
            const newContent = "# Global agents\n\nHello\n";
            const result = (await tool.execute({ newContent, confirm: true }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.diff).toBe(tools_1.FILE_EDIT_DIFF_OMITTED_MESSAGE);
                (0, bun_test_1.expect)(result.ui_only?.file_edit?.diff).toContain("AGENTS.md");
            }
            const written = await fs.readFile(path.join(muxHome.path, "AGENTS.md"), "utf-8");
            (0, bun_test_1.expect)(written).toBe(newContent);
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, bun_test_1.it)("rejects symlink targets", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const muxHome = __addDisposableResource(env_4, new testHelpers_1.TestTempDir("mux-global-agents"), false);
            const workspaceSessionDir = path.join(muxHome.path, "sessions", muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID);
            await fs.mkdir(workspaceSessionDir, { recursive: true });
            const config = (0, testHelpers_1.createTestToolConfig)(muxHome.path, {
                workspaceId: muxChat_1.MUX_HELP_CHAT_WORKSPACE_ID,
                sessionsDir: workspaceSessionDir,
            });
            const readTool = (0, mux_global_agents_read_1.createMuxGlobalAgentsReadTool)(config);
            const writeTool = (0, mux_global_agents_write_1.createMuxGlobalAgentsWriteTool)(config);
            const agentsPath = path.join(muxHome.path, "AGENTS.md");
            const targetPath = path.join(muxHome.path, "target.txt");
            await fs.writeFile(targetPath, "secret", "utf-8");
            await fs.symlink(targetPath, agentsPath);
            const readResult = (await readTool.execute({}, mockToolCallOptions));
            (0, bun_test_1.expect)(readResult.success).toBe(false);
            if (!readResult.success) {
                (0, bun_test_1.expect)(readResult.error).toContain("symlink");
            }
            const writeResult = (await writeTool.execute({ newContent: "nope", confirm: true }, mockToolCallOptions));
            (0, bun_test_1.expect)(writeResult.success).toBe(false);
            if (!writeResult.success) {
                (0, bun_test_1.expect)(writeResult.error).toContain("symlink");
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
});
//# sourceMappingURL=mux_global_agents.test.js.map