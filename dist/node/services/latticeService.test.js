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
const events_1 = require("events");
const stream_1 = require("stream");
const bun_test_1 = require("bun:test");
const latticeService_1 = require("./latticeService");
const childProcess = __importStar(require("child_process"));
const disposableExec = __importStar(require("../../node/utils/disposableExec"));
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => { };
/**
 * Mock execAsync for non-streaming tests.
 * Uses spyOn instead of vi.mock to avoid polluting other test files.
 */
let execAsyncSpy = null;
// Minimal mock that satisfies the interface used by LatticeService
// Uses cast via `unknown` because we only implement the subset actually used by tests
function createMockExecResult(result) {
    const mock = {
        result,
        get promise() {
            return result;
        },
        child: {}, // not used by LatticeService
        [Symbol.dispose]: noop,
    };
    return mock;
}
function mockExecOk(stdout, stderr = "") {
    execAsyncSpy?.mockReturnValue(createMockExecResult(Promise.resolve({ stdout, stderr })));
}
function mockExecError(error) {
    execAsyncSpy?.mockReturnValue(createMockExecResult(Promise.reject(error)));
}
/**
 * Mock spawn for streaming createWorkspace() tests.
 * Uses spyOn instead of vi.mock to avoid polluting other test files.
 */
let spawnSpy = null;
function mockCoderCommandResult(options) {
    const stdout = stream_1.Readable.from(options.stdout ? [Buffer.from(options.stdout)] : []);
    const stderr = stream_1.Readable.from(options.stderr ? [Buffer.from(options.stderr)] : []);
    const events = new events_1.EventEmitter();
    spawnSpy?.mockReturnValue({
        stdout,
        stderr,
        exitCode: null,
        signalCode: null,
        kill: bun_test_1.vi.fn(),
        on: events.on.bind(events),
        removeListener: events.removeListener.bind(events),
    });
    // Emit close after handlers are attached.
    setTimeout(() => events.emit("close", options.exitCode), 0);
}
(0, bun_test_1.describe)("LatticeService", () => {
    let service;
    (0, bun_test_1.beforeEach)(() => {
        service = new latticeService_1.LatticeService();
        bun_test_1.vi.clearAllMocks();
        // Set up spies for mocking - uses spyOn instead of vi.mock to avoid polluting other test files
        execAsyncSpy = (0, bun_test_1.spyOn)(disposableExec, "execAsync");
        spawnSpy = (0, bun_test_1.spyOn)(childProcess, "spawn");
    });
    (0, bun_test_1.afterEach)(() => {
        service.clearCache();
        execAsyncSpy?.mockRestore();
        execAsyncSpy = null;
        spawnSpy?.mockRestore();
        spawnSpy = null;
    });
    (0, bun_test_1.describe)("getLatticeInfo", () => {
        (0, bun_test_1.it)("returns available state with valid version", async () => {
            mockExecOk(JSON.stringify({ version: "2.28.2" }));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({ state: "available", version: "2.28.2" });
        });
        (0, bun_test_1.it)("returns available state for exact minimum version", async () => {
            mockExecOk(JSON.stringify({ version: "2.25.0" }));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({ state: "available", version: "2.25.0" });
        });
        (0, bun_test_1.it)("returns outdated state for version below minimum", async () => {
            mockExecOk(JSON.stringify({ version: "2.24.9" }));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({ state: "outdated", version: "2.24.9", minVersion: "2.25.0" });
        });
        (0, bun_test_1.it)("handles version with dev suffix", async () => {
            mockExecOk(JSON.stringify({ version: "2.28.2-devel+903c045b9" }));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({ state: "available", version: "2.28.2-devel+903c045b9" });
        });
        (0, bun_test_1.it)("returns unavailable state with reason missing when CLI not installed", async () => {
            mockExecError(new Error("command not found: coder"));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({ state: "unavailable", reason: "missing" });
        });
        (0, bun_test_1.it)("returns unavailable state with error reason for other errors", async () => {
            mockExecError(new Error("Connection refused"));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({
                state: "unavailable",
                reason: { kind: "error", message: "Connection refused" },
            });
        });
        (0, bun_test_1.it)("returns unavailable state with error when version is missing from output", async () => {
            mockExecOk(JSON.stringify({}));
            const info = await service.getLatticeInfo();
            (0, bun_test_1.expect)(info).toEqual({
                state: "unavailable",
                reason: { kind: "error", message: "Version output missing from CLI" },
            });
        });
        (0, bun_test_1.it)("caches the result", async () => {
            mockExecOk(JSON.stringify({ version: "2.28.2" }));
            await service.getLatticeInfo();
            await service.getLatticeInfo();
            (0, bun_test_1.expect)(execAsyncSpy).toHaveBeenCalledTimes(1);
        });
    });
    (0, bun_test_1.describe)("listTemplates", () => {
        (0, bun_test_1.it)("returns templates with display names", async () => {
            execAsyncSpy?.mockReturnValue(createMockExecResult(Promise.resolve({
                stdout: JSON.stringify([
                    {
                        Template: {
                            name: "template-1",
                            display_name: "Template One",
                            organization_name: "org1",
                        },
                    },
                    { Template: { name: "template-2", display_name: "Template Two" } },
                ]),
                stderr: "",
            })));
            const templates = await service.listTemplates();
            (0, bun_test_1.expect)(templates).toEqual([
                { name: "template-1", displayName: "Template One", organizationName: "org1" },
                { name: "template-2", displayName: "Template Two", organizationName: "default" },
            ]);
        });
        (0, bun_test_1.it)("uses name as displayName when display_name not present", async () => {
            execAsyncSpy?.mockReturnValue(createMockExecResult(Promise.resolve({
                stdout: JSON.stringify([{ Template: { name: "my-template" } }]),
                stderr: "",
            })));
            const templates = await service.listTemplates();
            (0, bun_test_1.expect)(templates).toEqual([
                { name: "my-template", displayName: "my-template", organizationName: "default" },
            ]);
        });
        (0, bun_test_1.it)("returns empty array on error", async () => {
            mockExecError(new Error("not logged in"));
            const templates = await service.listTemplates();
            (0, bun_test_1.expect)(templates).toEqual([]);
        });
        (0, bun_test_1.it)("returns empty array for empty output", async () => {
            mockExecOk("");
            const templates = await service.listTemplates();
            (0, bun_test_1.expect)(templates).toEqual([]);
        });
    });
    (0, bun_test_1.describe)("listPresets", () => {
        (0, bun_test_1.it)("returns presets for a template", async () => {
            mockExecOk(JSON.stringify([
                {
                    TemplatePreset: {
                        ID: "preset-1",
                        Name: "Small",
                        Description: "Small instance",
                        Default: true,
                    },
                },
                {
                    TemplatePreset: {
                        ID: "preset-2",
                        Name: "Large",
                        Description: "Large instance",
                    },
                },
            ]));
            const presets = await service.listPresets("my-template");
            (0, bun_test_1.expect)(presets).toEqual([
                { id: "preset-1", name: "Small", description: "Small instance", isDefault: true },
                { id: "preset-2", name: "Large", description: "Large instance", isDefault: false },
            ]);
        });
        (0, bun_test_1.it)("returns empty array when template has no presets", async () => {
            mockExecOk("");
            const presets = await service.listPresets("no-presets-template");
            (0, bun_test_1.expect)(presets).toEqual([]);
        });
        (0, bun_test_1.it)("returns empty array on error", async () => {
            mockExecError(new Error("template not found"));
            const presets = await service.listPresets("nonexistent");
            (0, bun_test_1.expect)(presets).toEqual([]);
        });
    });
    (0, bun_test_1.describe)("listWorkspaces", () => {
        (0, bun_test_1.it)("returns all workspaces regardless of status", async () => {
            mockExecOk(JSON.stringify([
                {
                    name: "ws-1",
                    template_name: "t1",
                    template_display_name: "t1",
                    latest_build: { status: "running" },
                },
                {
                    name: "ws-2",
                    template_name: "t2",
                    template_display_name: "t2",
                    latest_build: { status: "stopped" },
                },
                {
                    name: "ws-3",
                    template_name: "t3",
                    template_display_name: "t3",
                    latest_build: { status: "starting" },
                },
            ]));
            const workspaces = await service.listWorkspaces();
            (0, bun_test_1.expect)(workspaces).toEqual([
                { name: "ws-1", templateName: "t1", templateDisplayName: "t1", status: "running" },
                { name: "ws-2", templateName: "t2", templateDisplayName: "t2", status: "stopped" },
                { name: "ws-3", templateName: "t3", templateDisplayName: "t3", status: "starting" },
            ]);
        });
        (0, bun_test_1.it)("returns empty array on error", async () => {
            mockExecError(new Error("not logged in"));
            const workspaces = await service.listWorkspaces();
            (0, bun_test_1.expect)(workspaces).toEqual([]);
        });
    });
    (0, bun_test_1.describe)("workspaceExists", () => {
        (0, bun_test_1.it)("returns true when exact match is found in search results", async () => {
            mockExecOk(JSON.stringify([{ name: "ws-1" }, { name: "ws-10" }]));
            const exists = await service.workspaceExists("ws-1");
            (0, bun_test_1.expect)(exists).toBe(true);
        });
        (0, bun_test_1.it)("returns false when only prefix matches", async () => {
            mockExecOk(JSON.stringify([{ name: "ws-10" }]));
            const exists = await service.workspaceExists("ws-1");
            (0, bun_test_1.expect)(exists).toBe(false);
        });
        (0, bun_test_1.it)("returns false on CLI error", async () => {
            mockExecError(new Error("not logged in"));
            const exists = await service.workspaceExists("ws-1");
            (0, bun_test_1.expect)(exists).toBe(false);
        });
    });
    (0, bun_test_1.describe)("getWorkspaceStatus", () => {
        (0, bun_test_1.it)("returns status for exact match (search is prefix-based)", async () => {
            mockCoderCommandResult({
                exitCode: 0,
                stdout: JSON.stringify([
                    { name: "ws-1", latest_build: { status: "running" } },
                    { name: "ws-10", latest_build: { status: "stopped" } },
                ]),
            });
            const result = await service.getWorkspaceStatus("ws-1");
            (0, bun_test_1.expect)(result.kind).toBe("ok");
            if (result.kind === "ok") {
                (0, bun_test_1.expect)(result.status).toBe("running");
            }
        });
        (0, bun_test_1.it)("returns not_found when only prefix matches", async () => {
            mockCoderCommandResult({
                exitCode: 0,
                stdout: JSON.stringify([{ name: "ws-10", latest_build: { status: "running" } }]),
            });
            const result = await service.getWorkspaceStatus("ws-1");
            (0, bun_test_1.expect)(result.kind).toBe("not_found");
        });
        (0, bun_test_1.it)("returns error for unknown workspace status", async () => {
            mockCoderCommandResult({
                exitCode: 0,
                stdout: JSON.stringify([{ name: "ws-1", latest_build: { status: "weird" } }]),
            });
            const result = await service.getWorkspaceStatus("ws-1");
            (0, bun_test_1.expect)(result.kind).toBe("error");
            if (result.kind === "error") {
                (0, bun_test_1.expect)(result.error).toContain("Unknown status");
            }
        });
    });
    (0, bun_test_1.describe)("waitForStartupScripts", () => {
        (0, bun_test_1.it)("streams stdout/stderr lines while waiting", async () => {
            const stdout = stream_1.Readable.from([Buffer.from("Waiting for agent...\nAgent ready\n")]);
            const stderr = stream_1.Readable.from([]);
            const events = new events_1.EventEmitter();
            spawnSpy.mockReturnValue({
                stdout,
                stderr,
                kill: bun_test_1.vi.fn(),
                on: events.on.bind(events),
            });
            setTimeout(() => events.emit("close", 0), 0);
            const lines = [];
            for await (const line of service.waitForStartupScripts("my-ws")) {
                lines.push(line);
            }
            (0, bun_test_1.expect)(lines).toContain("$ coder ssh my-ws --wait=yes -- true");
            (0, bun_test_1.expect)(lines).toContain("Waiting for agent...");
            (0, bun_test_1.expect)(lines).toContain("Agent ready");
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledWith("lattice", ["ssh", "my-ws", "--wait=yes", "--", "true"], {
                stdio: ["ignore", "pipe", "pipe"],
            });
        });
        (0, bun_test_1.it)("throws when exit code is non-zero", async () => {
            const stdout = stream_1.Readable.from([]);
            const stderr = stream_1.Readable.from([Buffer.from("Connection refused\n")]);
            const events = new events_1.EventEmitter();
            spawnSpy.mockReturnValue({
                stdout,
                stderr,
                kill: bun_test_1.vi.fn(),
                on: events.on.bind(events),
            });
            setTimeout(() => events.emit("close", 1), 0);
            const lines = [];
            const run = async () => {
                for await (const line of service.waitForStartupScripts("my-ws")) {
                    lines.push(line);
                }
            };
            let thrown;
            try {
                await run();
            }
            catch (error) {
                thrown = error;
            }
            (0, bun_test_1.expect)(thrown).toBeTruthy();
            (0, bun_test_1.expect)(thrown instanceof Error ? thrown.message : String(thrown)).toBe("coder ssh --wait failed (exit 1): Connection refused");
        });
    });
    (0, bun_test_1.describe)("createWorkspace", () => {
        // Capture original fetch once per describe block to avoid nested mock issues
        let originalFetch;
        (0, bun_test_1.beforeEach)(() => {
            originalFetch = global.fetch;
        });
        (0, bun_test_1.afterEach)(() => {
            global.fetch = originalFetch;
        });
        // Helper to mock the pre-fetch calls that happen before spawn
        function mockPrefetchCalls(options) {
            // Mock getDeploymentUrl (coder whoami)
            // Mock getActiveTemplateVersionId (coder templates list)
            // Mock getPresetParamNames (coder templates presets list)
            // Mock getTemplateRichParameters (coder tokens create + fetch)
            execAsyncSpy?.mockImplementation((cmd) => {
                if (cmd === "coder whoami --output json") {
                    return createMockExecResult(Promise.resolve({
                        stdout: JSON.stringify([{ url: "https://lattice.example.com" }]),
                        stderr: "",
                    }));
                }
                if (cmd === "coder templates list --output=json") {
                    return createMockExecResult(Promise.resolve({
                        stdout: JSON.stringify([
                            { Template: { name: "my-template", active_version_id: "version-123" } },
                            { Template: { name: "tmpl", active_version_id: "version-456" } },
                        ]),
                        stderr: "",
                    }));
                }
                if (cmd.startsWith("coder templates presets list")) {
                    const paramNames = options?.presetParamNames ?? [];
                    return createMockExecResult(Promise.resolve({
                        stdout: JSON.stringify([
                            {
                                TemplatePreset: {
                                    Name: "preset",
                                    Parameters: paramNames.map((name) => ({ Name: name })),
                                },
                            },
                        ]),
                        stderr: "",
                    }));
                }
                if (cmd.startsWith("coder tokens create --lifetime 5m --name")) {
                    return createMockExecResult(Promise.resolve({ stdout: "fake-token-123", stderr: "" }));
                }
                if (cmd.startsWith("coder tokens delete")) {
                    return createMockExecResult(Promise.resolve({ stdout: "", stderr: "" }));
                }
                // Fallback for any other command
                return createMockExecResult(Promise.reject(new Error(`Unexpected command: ${cmd}`)));
            });
        }
        // Helper to mock fetch for rich parameters API
        function mockFetchRichParams(params) {
            global.fetch = bun_test_1.vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(params),
            });
        }
        (0, bun_test_1.it)("streams stdout/stderr lines and passes expected args", async () => {
            mockPrefetchCalls();
            mockFetchRichParams([]);
            const stdout = stream_1.Readable.from([Buffer.from("out-1\nout-2\n")]);
            const stderr = stream_1.Readable.from([Buffer.from("err-1\n")]);
            const events = new events_1.EventEmitter();
            spawnSpy.mockReturnValue({
                stdout,
                stderr,
                kill: bun_test_1.vi.fn(),
                on: events.on.bind(events),
            });
            // Emit close after handlers are attached.
            setTimeout(() => events.emit("close", 0), 0);
            const lines = [];
            for await (const line of service.createWorkspace("my-workspace", "my-template")) {
                lines.push(line);
            }
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledWith("lattice", ["create", "my-workspace", "-t", "my-template", "--yes"], { stdio: ["ignore", "pipe", "pipe"] });
            // First line is the command, rest are stdout/stderr
            (0, bun_test_1.expect)(lines[0]).toBe("$ coder create my-workspace -t my-template --yes");
            (0, bun_test_1.expect)(lines.slice(1).sort()).toEqual(["err-1", "out-1", "out-2"]);
        });
        (0, bun_test_1.it)("includes --preset when provided", async () => {
            mockPrefetchCalls({ presetParamNames: ["covered-param"] });
            mockFetchRichParams([{ name: "covered-param", default_value: "val" }]);
            const stdout = stream_1.Readable.from([]);
            const stderr = stream_1.Readable.from([]);
            const events = new events_1.EventEmitter();
            spawnSpy.mockReturnValue({
                stdout,
                stderr,
                kill: bun_test_1.vi.fn(),
                on: events.on.bind(events),
            });
            setTimeout(() => events.emit("close", 0), 0);
            for await (const _line of service.createWorkspace("ws", "tmpl", "preset")) {
                // drain
            }
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledWith("lattice", ["create", "ws", "-t", "tmpl", "--yes", "--preset", "preset"], { stdio: ["ignore", "pipe", "pipe"] });
        });
        (0, bun_test_1.it)("includes --parameter flags for uncovered non-ephemeral params", async () => {
            mockPrefetchCalls({ presetParamNames: ["covered-param"] });
            mockFetchRichParams([
                { name: "covered-param", default_value: "val1" },
                { name: "uncovered-param", default_value: "val2" },
                { name: "ephemeral-param", default_value: "val3", ephemeral: true },
            ]);
            const stdout = stream_1.Readable.from([]);
            const stderr = stream_1.Readable.from([]);
            const events = new events_1.EventEmitter();
            spawnSpy.mockReturnValue({
                stdout,
                stderr,
                kill: bun_test_1.vi.fn(),
                on: events.on.bind(events),
            });
            setTimeout(() => events.emit("close", 0), 0);
            for await (const _line of service.createWorkspace("ws", "tmpl", "preset")) {
                // drain
            }
            (0, bun_test_1.expect)(spawnSpy).toHaveBeenCalledWith("lattice", [
                "create",
                "ws",
                "-t",
                "tmpl",
                "--yes",
                "--preset",
                "preset",
                "--parameter",
                "uncovered-param=val2",
            ], { stdio: ["ignore", "pipe", "pipe"] });
        });
        (0, bun_test_1.it)("throws when exit code is non-zero", async () => {
            mockPrefetchCalls();
            mockFetchRichParams([]);
            const stdout = stream_1.Readable.from([]);
            const stderr = stream_1.Readable.from([]);
            const events = new events_1.EventEmitter();
            spawnSpy.mockReturnValue({
                stdout,
                stderr,
                kill: bun_test_1.vi.fn(),
                on: events.on.bind(events),
            });
            setTimeout(() => events.emit("close", 42), 0);
            let thrown;
            try {
                for await (const _line of service.createWorkspace("ws", "tmpl")) {
                    // drain
                }
            }
            catch (error) {
                thrown = error;
            }
            (0, bun_test_1.expect)(thrown).toBeTruthy();
            (0, bun_test_1.expect)(thrown instanceof Error ? thrown.message : String(thrown)).toContain("coder create failed (exit 42)");
        });
        (0, bun_test_1.it)("aborts before spawn when already aborted", async () => {
            const abortController = new AbortController();
            abortController.abort();
            let thrown;
            try {
                for await (const _line of service.createWorkspace("ws", "tmpl", undefined, abortController.signal)) {
                    // drain
                }
            }
            catch (error) {
                thrown = error;
            }
            (0, bun_test_1.expect)(thrown).toBeTruthy();
            (0, bun_test_1.expect)(thrown instanceof Error ? thrown.message : String(thrown)).toContain("aborted");
        });
        (0, bun_test_1.it)("throws when required param has no default and is not covered by preset", async () => {
            mockPrefetchCalls({ presetParamNames: [] });
            mockFetchRichParams([{ name: "required-param", default_value: "", required: true }]);
            let thrown;
            try {
                for await (const _line of service.createWorkspace("ws", "tmpl")) {
                    // drain
                }
            }
            catch (error) {
                thrown = error;
            }
            (0, bun_test_1.expect)(thrown).toBeTruthy();
            (0, bun_test_1.expect)(thrown instanceof Error ? thrown.message : String(thrown)).toContain("required-param");
        });
    });
});
(0, bun_test_1.describe)("computeExtraParams", () => {
    let service;
    (0, bun_test_1.beforeEach)(() => {
        service = new latticeService_1.LatticeService();
    });
    (0, bun_test_1.it)("returns empty array when all params are covered by preset", () => {
        const params = [
            { name: "param1", defaultValue: "val1", type: "string", ephemeral: false, required: false },
            { name: "param2", defaultValue: "val2", type: "string", ephemeral: false, required: false },
        ];
        const covered = new Set(["param1", "param2"]);
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([]);
    });
    (0, bun_test_1.it)("returns uncovered non-ephemeral params with defaults", () => {
        const params = [
            { name: "covered", defaultValue: "val1", type: "string", ephemeral: false, required: false },
            {
                name: "uncovered",
                defaultValue: "val2",
                type: "string",
                ephemeral: false,
                required: false,
            },
        ];
        const covered = new Set(["covered"]);
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "uncovered", encoded: "uncovered=val2" },
        ]);
    });
    (0, bun_test_1.it)("excludes ephemeral params", () => {
        const params = [
            { name: "normal", defaultValue: "val1", type: "string", ephemeral: false, required: false },
            { name: "ephemeral", defaultValue: "val2", type: "string", ephemeral: true, required: false },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "normal", encoded: "normal=val1" },
        ]);
    });
    (0, bun_test_1.it)("includes params with empty default values", () => {
        const params = [
            {
                name: "empty-default",
                defaultValue: "",
                type: "string",
                ephemeral: false,
                required: false,
            },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "empty-default", encoded: "empty-default=" },
        ]);
    });
    (0, bun_test_1.it)("CSV-encodes list(string) values containing quotes", () => {
        const params = [
            {
                name: "Select IDEs",
                defaultValue: '["vscode","code-server","cursor"]',
                type: "list(string)",
                ephemeral: false,
                required: false,
            },
        ];
        const covered = new Set();
        // CLI uses CSV parsing, so quotes need escaping: " -> ""
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "Select IDEs", encoded: '"Select IDEs=[""vscode"",""code-server"",""cursor""]"' },
        ]);
    });
    (0, bun_test_1.it)("passes empty list(string) array without CSV encoding", () => {
        const params = [
            {
                name: "empty-list",
                defaultValue: "[]",
                type: "list(string)",
                ephemeral: false,
                required: false,
            },
        ];
        const covered = new Set();
        // No quotes or commas, so no encoding needed
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "empty-list", encoded: "empty-list=[]" },
        ]);
    });
});
(0, bun_test_1.describe)("validateRequiredParams", () => {
    let service;
    (0, bun_test_1.beforeEach)(() => {
        service = new latticeService_1.LatticeService();
    });
    (0, bun_test_1.it)("does not throw when all required params have defaults", () => {
        const params = [
            {
                name: "required-with-default",
                defaultValue: "val",
                type: "string",
                ephemeral: false,
                required: true,
            },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).not.toThrow();
    });
    (0, bun_test_1.it)("does not throw when required params are covered by preset", () => {
        const params = [
            {
                name: "required-no-default",
                defaultValue: "",
                type: "string",
                ephemeral: false,
                required: true,
            },
        ];
        const covered = new Set(["required-no-default"]);
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).not.toThrow();
    });
    (0, bun_test_1.it)("throws when required param has no default and is not covered", () => {
        const params = [
            { name: "missing-param", defaultValue: "", type: "string", ephemeral: false, required: true },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).toThrow("missing-param");
    });
    (0, bun_test_1.it)("ignores ephemeral required params", () => {
        const params = [
            {
                name: "ephemeral-required",
                defaultValue: "",
                type: "string",
                ephemeral: true,
                required: true,
            },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).not.toThrow();
    });
    (0, bun_test_1.it)("lists all missing required params in error", () => {
        const params = [
            { name: "missing1", defaultValue: "", type: "string", ephemeral: false, required: true },
            { name: "missing2", defaultValue: "", type: "string", ephemeral: false, required: true },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).toThrow(/missing1.*missing2|missing2.*missing1/);
    });
});
(0, bun_test_1.describe)("non-string parameter defaults", () => {
    let service;
    (0, bun_test_1.beforeEach)(() => {
        service = new latticeService_1.LatticeService();
    });
    (0, bun_test_1.it)("validateRequiredParams passes when required param has numeric default 0", () => {
        // After parseRichParameters, numeric 0 becomes "0" (not "")
        const params = [
            { name: "count", defaultValue: "0", type: "number", ephemeral: false, required: true },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).not.toThrow();
    });
    (0, bun_test_1.it)("validateRequiredParams passes when required param has boolean default false", () => {
        // After parseRichParameters, boolean false becomes "false" (not "")
        const params = [
            { name: "enabled", defaultValue: "false", type: "bool", ephemeral: false, required: true },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(() => service.validateRequiredParams(params, covered)).not.toThrow();
    });
    (0, bun_test_1.it)("computeExtraParams emits numeric default correctly", () => {
        const params = [
            { name: "count", defaultValue: "42", type: "number", ephemeral: false, required: false },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "count", encoded: "count=42" },
        ]);
    });
    (0, bun_test_1.it)("computeExtraParams emits boolean default correctly", () => {
        const params = [
            { name: "enabled", defaultValue: "true", type: "bool", ephemeral: false, required: false },
        ];
        const covered = new Set();
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "enabled", encoded: "enabled=true" },
        ]);
    });
    (0, bun_test_1.it)("computeExtraParams emits array default as JSON with CSV encoding", () => {
        // After parseRichParameters, array becomes JSON string
        const params = [
            {
                name: "tags",
                defaultValue: '["a","b"]',
                type: "list(string)",
                ephemeral: false,
                required: false,
            },
        ];
        const covered = new Set();
        // JSON array with quotes gets CSV-encoded (quotes escaped as "")
        (0, bun_test_1.expect)(service.computeExtraParams(params, covered)).toEqual([
            { name: "tags", encoded: '"tags=[""a"",""b""]"' },
        ]);
    });
});
(0, bun_test_1.describe)("deleteWorkspace", () => {
    const service = new latticeService_1.LatticeService();
    let mockExec = null;
    (0, bun_test_1.beforeEach)(() => {
        bun_test_1.vi.clearAllMocks();
        mockExec = (0, bun_test_1.spyOn)(disposableExec, "execAsync");
    });
    (0, bun_test_1.afterEach)(() => {
        mockExec?.mockRestore();
        mockExec = null;
    });
    (0, bun_test_1.it)("refuses to delete workspace without unix- prefix", async () => {
        await service.deleteWorkspace("my-workspace");
        // Should not call execAsync at all
        (0, bun_test_1.expect)(mockExec).not.toHaveBeenCalled();
    });
    (0, bun_test_1.it)("deletes workspace with unix- prefix", async () => {
        mockExec?.mockReturnValue(createMockExecResult(Promise.resolve({ stdout: "", stderr: "" })));
        await service.deleteWorkspace("unix-my-workspace");
        (0, bun_test_1.expect)(mockExec).toHaveBeenCalledWith(bun_test_1.expect.stringContaining("coder delete"));
        (0, bun_test_1.expect)(mockExec).toHaveBeenCalledWith(bun_test_1.expect.stringContaining("unix-my-workspace"));
    });
});
(0, bun_test_1.describe)("compareVersions", () => {
    (0, bun_test_1.it)("returns 0 for equal versions", () => {
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.28.6", "2.28.6")).toBe(0);
    });
    (0, bun_test_1.it)("returns 0 for equal versions with different formats", () => {
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("v2.28.6", "2.28.6")).toBe(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("v2.28.6+hash", "2.28.6")).toBe(0);
    });
    (0, bun_test_1.it)("returns negative when first version is older", () => {
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.25.0", "2.28.6")).toBeLessThan(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.28.5", "2.28.6")).toBeLessThan(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("1.0.0", "2.0.0")).toBeLessThan(0);
    });
    (0, bun_test_1.it)("returns positive when first version is newer", () => {
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.28.6", "2.25.0")).toBeGreaterThan(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.28.6", "2.28.5")).toBeGreaterThan(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("3.0.0", "2.28.6")).toBeGreaterThan(0);
    });
    (0, bun_test_1.it)("handles versions with v prefix", () => {
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("v2.28.6", "2.25.0")).toBeGreaterThan(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("v2.25.0", "v2.28.6")).toBeLessThan(0);
    });
    (0, bun_test_1.it)("handles dev versions correctly", () => {
        // v2.28.2-devel+903c045b9 should be compared as 2.28.2
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("v2.28.2-devel+903c045b9", "2.25.0")).toBeGreaterThan(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("v2.28.2-devel+903c045b9", "2.28.2")).toBe(0);
    });
    (0, bun_test_1.it)("handles missing patch version", () => {
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.28", "2.28.0")).toBe(0);
        (0, bun_test_1.expect)((0, latticeService_1.compareVersions)("2.28", "2.28.1")).toBeLessThan(0);
    });
});
//# sourceMappingURL=latticeService.test.js.map