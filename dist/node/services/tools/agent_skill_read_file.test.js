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
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const bun_test_1 = require("bun:test");
const unixChat_1 = require("../../../common/constants/unixChat");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const agent_skill_read_file_1 = require("./agent_skill_read_file");
const testHelpers_1 = require("./testHelpers");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
async function writeProjectSkill(workspacePath, name) {
    const skillDir = path.join(workspacePath, ".unix", "skills", name);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: test\n---\nBody\n`, "utf-8");
}
(0, bun_test_1.describe)("agent_skill_read_file (Chat with Unix sandbox)", () => {
    (0, bun_test_1.it)("allows reading built-in skill files", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_1, new testHelpers_1.TestTempDir("test-agent-skill-read-file-unix-chat"), false);
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, {
                workspaceId: unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID,
            });
            const tool = (0, agent_skill_read_file_1.createAgentSkillReadFileTool)(baseConfig);
            const raw = await Promise.resolve(tool.execute({ name: "unix-docs", filePath: "SKILL.md", offset: 1, limit: 25 }, mockToolCallOptions));
            const parsed = toolDefinitions_1.AgentSkillReadFileToolResultSchema.safeParse(raw);
            (0, bun_test_1.expect)(parsed.success).toBe(true);
            if (!parsed.success) {
                throw new Error(parsed.error.message);
            }
            const result = parsed.data;
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.content).toMatch(/name:\s*unix-docs/i);
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
    (0, bun_test_1.it)("rejects project/global skill file reads on disk", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const tempDir = __addDisposableResource(env_2, new testHelpers_1.TestTempDir("test-agent-skill-read-file-unix-chat-reject"), false);
            await writeProjectSkill(tempDir.path, "foo");
            const baseConfig = (0, testHelpers_1.createTestToolConfig)(tempDir.path, {
                workspaceId: unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID,
            });
            const tool = (0, agent_skill_read_file_1.createAgentSkillReadFileTool)(baseConfig);
            const raw = await Promise.resolve(tool.execute({ name: "foo", filePath: "SKILL.md", offset: 1, limit: 5 }, mockToolCallOptions));
            const parsed = toolDefinitions_1.AgentSkillReadFileToolResultSchema.safeParse(raw);
            (0, bun_test_1.expect)(parsed.success).toBe(true);
            if (!parsed.success) {
                throw new Error(parsed.error.message);
            }
            const result = parsed.data;
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toMatch(/only built-in skills/i);
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
});
//# sourceMappingURL=agent_skill_read_file.test.js.map