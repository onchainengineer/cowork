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
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const fs = __importStar(require("node:fs/promises"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const runtimeFactory_1 = require("../../../node/runtime/runtimeFactory");
const system1AgentRunner_1 = require("./system1AgentRunner");
// NOTE: These tests do not exercise a real model.
// We inject a stub generateTextImpl that simulates the model calling the tool.
(0, bun_test_1.describe)("system1AgentRunner", () => {
    (0, bun_test_1.it)("returns keep ranges when the model calls system1_keep_ranges", async () => {
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
        let calls = 0;
        const result = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
            runtime,
            agentDiscoveryPath: process.cwd(),
            runtimeTempDir: os.tmpdir(),
            model: {},
            modelString: "openai:gpt-5.1-codex-mini",
            providerOptions: {},
            script: "echo hi",
            numberedOutput: "0001| hi\n0002| ERROR: bad\n0003| at x",
            maxKeptLines: 10,
            timeoutMs: 5_000,
            generateTextImpl: async (args) => {
                calls += 1;
                // Tool use is mandated by the system1_bash agent prompt.
                // Do not force tool_choice at the API layer (some providers reject that + thinking).
                (0, bun_test_1.expect)(args.toolChoice).toBeUndefined();
                const tools = args.tools;
                (0, bun_test_1.expect)(tools && "system1_keep_ranges" in tools).toBe(true);
                // Simulate the model calling the tool.
                const keepRangesTool = tools.system1_keep_ranges;
                await keepRangesTool.execute({ keep_ranges: [{ start: 2, end: 3, reason: "error" }] }, {});
                return { finishReason: "stop" };
            },
        });
        (0, bun_test_1.expect)(calls).toBe(1);
        (0, bun_test_1.expect)(result).toEqual({
            keepRanges: [{ start: 2, end: 3, reason: "error" }],
            finishReason: "stop",
            timedOut: false,
        });
    });
    (0, bun_test_1.it)("includes display name in the user message when provided", async () => {
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
        let calls = 0;
        const result = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
            runtime,
            agentDiscoveryPath: process.cwd(),
            runtimeTempDir: os.tmpdir(),
            model: {},
            modelString: "openai:gpt-5.1-codex-mini",
            providerOptions: {},
            displayName: "List files",
            script: "ls",
            numberedOutput: "0001| a\n0002| b\n0003| c",
            maxKeptLines: 10,
            timeoutMs: 5_000,
            generateTextImpl: async (args) => {
                calls += 1;
                const messages = args.messages;
                (0, bun_test_1.expect)(Array.isArray(messages)).toBe(true);
                const firstContent = messages?.[0]?.content;
                (0, bun_test_1.expect)(typeof firstContent).toBe("string");
                (0, bun_test_1.expect)(firstContent).toContain("Display name:");
                (0, bun_test_1.expect)(firstContent).toContain("List files");
                const tools = args.tools;
                // Simulate the model calling the tool.
                const keepRangesTool = tools.system1_keep_ranges;
                await keepRangesTool.execute({ keep_ranges: [{ start: 1, end: 1, reason: "first" }] }, {});
                return { finishReason: "stop" };
            },
        });
        (0, bun_test_1.expect)(calls).toBe(1);
        (0, bun_test_1.expect)(result).toEqual({
            keepRanges: [{ start: 1, end: 1, reason: "first" }],
            finishReason: "stop",
            timedOut: false,
        });
    });
    (0, bun_test_1.it)("ignores project overrides of the internal system1_bash agent prompt", async () => {
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
        const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "system1-runner-project-"));
        try {
            const agentsDir = path.join(projectDir, ".unix", "agents");
            await fs.mkdir(agentsDir, { recursive: true });
            await fs.writeFile(path.join(agentsDir, "system1_bash.md"), [
                "---",
                "name: Override System1 Bash",
                "ui:",
                "  hidden: true",
                "subagent:",
                "  runnable: false",
                "---",
                "OVERRIDE_DO_NOT_USE",
                "",
            ].join("\n"), "utf8");
            const result = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
                runtime,
                agentDiscoveryPath: projectDir,
                runtimeTempDir: os.tmpdir(),
                model: {},
                modelString: "openai:gpt-5.1-codex-mini",
                providerOptions: {},
                script: "echo hi",
                numberedOutput: "0001| hi",
                maxKeptLines: 10,
                timeoutMs: 5_000,
                generateTextImpl: async (args) => {
                    (0, bun_test_1.expect)(args.toolChoice).toBeUndefined();
                    const system = args.system;
                    (0, bun_test_1.expect)(typeof system).toBe("string");
                    (0, bun_test_1.expect)(system).not.toContain("OVERRIDE_DO_NOT_USE");
                    const tools = args.tools;
                    (0, bun_test_1.expect)(tools && "system1_keep_ranges" in tools).toBe(true);
                    const keepRangesTool = tools.system1_keep_ranges;
                    await keepRangesTool.execute({ keep_ranges: [{ start: 1, end: 1, reason: "hi" }] }, {});
                    return { finishReason: "stop" };
                },
            });
            (0, bun_test_1.expect)(result).toEqual({
                keepRanges: [{ start: 1, end: 1, reason: "hi" }],
                finishReason: "stop",
                timedOut: false,
            });
        }
        finally {
            await fs.rm(projectDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("retries once with a reminder if the model does not call the tool", async () => {
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
        let calls = 0;
        const result = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
            runtime,
            agentDiscoveryPath: process.cwd(),
            runtimeTempDir: os.tmpdir(),
            model: {},
            modelString: "openai:gpt-5.1-codex-mini",
            providerOptions: {},
            script: "echo hi",
            numberedOutput: "0001| hi",
            maxKeptLines: 10,
            timeoutMs: 5_000,
            generateTextImpl: async (args) => {
                calls += 1;
                const messages = args.messages;
                (0, bun_test_1.expect)(Array.isArray(messages)).toBe(true);
                if (calls === 1) {
                    (0, bun_test_1.expect)(messages.length).toBe(1);
                    return { finishReason: "stop" };
                }
                (0, bun_test_1.expect)(messages.length).toBe(2);
                (0, bun_test_1.expect)(messages[1]?.content).toBe("Reminder: You MUST call `system1_keep_ranges` exactly once. Do not output any text; only the tool call.");
                const tools = args.tools;
                const keepRangesTool = tools.system1_keep_ranges;
                await keepRangesTool.execute({ keep_ranges: [{ start: 1, end: 1, reason: "hi" }] }, {});
                return { finishReason: "stop" };
            },
        });
        (0, bun_test_1.expect)(calls).toBe(2);
        (0, bun_test_1.expect)(result).toEqual({
            keepRanges: [{ start: 1, end: 1, reason: "hi" }],
            finishReason: "stop",
            timedOut: false,
        });
    });
    (0, bun_test_1.it)("returns undefined when the model does not call the tool", async () => {
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
        let calls = 0;
        const result = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
            runtime,
            agentDiscoveryPath: process.cwd(),
            runtimeTempDir: os.tmpdir(),
            model: {},
            modelString: "openai:gpt-5.1-codex-mini",
            providerOptions: {},
            script: "echo hi",
            numberedOutput: "0001| hi",
            maxKeptLines: 10,
            timeoutMs: 5_000,
            generateTextImpl: () => {
                calls += 1;
                return Promise.resolve({ finishReason: "stop" });
            },
        });
        (0, bun_test_1.expect)(calls).toBe(2);
        (0, bun_test_1.expect)(result).toBeUndefined();
    });
    (0, bun_test_1.it)("returns undefined on AbortError", async () => {
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
        let calls = 0;
        const result = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
            runtime,
            agentDiscoveryPath: process.cwd(),
            runtimeTempDir: os.tmpdir(),
            model: {},
            modelString: "openai:gpt-5.1-codex-mini",
            providerOptions: {},
            script: "echo hi",
            numberedOutput: "0001| hi",
            maxKeptLines: 10,
            timeoutMs: 5_000,
            generateTextImpl: () => {
                calls += 1;
                const err = new Error("aborted");
                err.name = "AbortError";
                return Promise.reject(err);
            },
        });
        (0, bun_test_1.expect)(calls).toBe(1);
        (0, bun_test_1.expect)(result).toBeUndefined();
    });
});
//# sourceMappingURL=system1AgentRunner.test.js.map