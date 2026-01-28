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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const hooks_1 = require("./hooks");
const LocalRuntime_1 = require("../../node/runtime/LocalRuntime");
(0, bun_test_1.describe)("hooks", () => {
    let tempDir;
    let runtime;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-hooks-test-"));
        runtime = new LocalRuntime_1.LocalRuntime(tempDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.describe)("getHookPath", () => {
        (0, bun_test_1.test)("returns null when no hook exists", async () => {
            const result = await (0, hooks_1.getHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBeNull();
        });
        (0, bun_test_1.test)("finds project-level hook", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, "#!/bin/bash\necho test");
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.getHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBe(hookPath);
        });
        (0, bun_test_1.test)("ignores directory with hook name", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookPath, { recursive: true }); // Create as directory
            const result = await (0, hooks_1.getHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBeNull();
        });
    });
    (0, bun_test_1.describe)("getToolEnvPath", () => {
        (0, bun_test_1.test)("returns null when no tool_env exists", async () => {
            const result = await (0, hooks_1.getToolEnvPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBeNull();
        });
        (0, bun_test_1.test)("finds project-level tool_env", async () => {
            const envDir = path.join(tempDir, ".unix");
            const envPath = path.join(envDir, "tool_env");
            await fs.mkdir(envDir, { recursive: true });
            await fs.writeFile(envPath, "export FOO=bar");
            const result = await (0, hooks_1.getToolEnvPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBe(envPath);
        });
        (0, bun_test_1.test)("ignores directory with tool_env name", async () => {
            const envDir = path.join(tempDir, ".unix");
            const envPath = path.join(envDir, "tool_env");
            await fs.mkdir(envPath, { recursive: true }); // Create as directory
            const result = await (0, hooks_1.getToolEnvPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBeNull();
        });
    });
    (0, bun_test_1.describe)("getPreHookPath", () => {
        (0, bun_test_1.test)("returns null when no tool_pre exists", async () => {
            const result = await (0, hooks_1.getPreHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBeNull();
        });
        (0, bun_test_1.test)("finds project-level tool_pre", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_pre");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, "#!/bin/bash\nexit 0");
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.getPreHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBe(hookPath);
        });
    });
    (0, bun_test_1.describe)("getPostHookPath", () => {
        (0, bun_test_1.test)("returns null when no tool_post exists", async () => {
            const result = await (0, hooks_1.getPostHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBeNull();
        });
        (0, bun_test_1.test)("finds project-level tool_post", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_post");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, "#!/bin/bash\nexit 0");
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.getPostHookPath)(runtime, tempDir);
            (0, bun_test_1.expect)(result).toBe(hookPath);
        });
    });
    (0, bun_test_1.describe)("runPreHook", () => {
        (0, bun_test_1.test)("allows tool when hook exits 0", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_pre");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, "#!/bin/bash\nexit 0");
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPreHook)(runtime, hookPath, {
                tool: "test_tool",
                toolInput: '{"arg": "value"}',
                workspaceId: "test-workspace",
                projectDir: tempDir,
            });
            (0, bun_test_1.expect)(result.allowed).toBe(true);
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
        });
        (0, bun_test_1.test)("blocks tool when hook exits non-zero", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_pre");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, '#!/bin/bash\necho "blocked" >&2\nexit 1');
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPreHook)(runtime, hookPath, {
                tool: "test_tool",
                toolInput: '{"arg": "value"}',
                workspaceId: "test-workspace",
                projectDir: tempDir,
            });
            (0, bun_test_1.expect)(result.allowed).toBe(false);
            (0, bun_test_1.expect)(result.exitCode).toBe(1);
            (0, bun_test_1.expect)(result.output).toContain("blocked");
        });
        (0, bun_test_1.test)("receives UNIX_TOOL env var", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_pre");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, '#!/bin/bash\necho "tool=$UNIX_TOOL"');
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPreHook)(runtime, hookPath, {
                tool: "bash",
                toolInput: "{}",
                workspaceId: "test-workspace",
                projectDir: tempDir,
            });
            (0, bun_test_1.expect)(result.allowed).toBe(true);
            (0, bun_test_1.expect)(result.output).toContain("tool=bash");
        });
    });
    (0, bun_test_1.describe)("runPostHook", () => {
        (0, bun_test_1.test)("succeeds when hook exits 0", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_post");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, "#!/bin/bash\nexit 0");
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPostHook)(runtime, hookPath, {
                tool: "test_tool",
                toolInput: '{"arg": "value"}',
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, { success: true, data: "test" });
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.exitCode).toBe(0);
        });
        (0, bun_test_1.test)("receives UNIX_TOOL_RESULT env var", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_post");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, '#!/bin/bash\necho "result=$UNIX_TOOL_RESULT"');
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPostHook)(runtime, hookPath, {
                tool: "test_tool",
                toolInput: "{}",
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, { value: 42 });
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.output).toContain('result={"value":42}');
        });
        (0, bun_test_1.test)("can read result from UNIX_TOOL_RESULT_PATH", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_post");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, '#!/bin/bash\ncat "$UNIX_TOOL_RESULT_PATH"');
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPostHook)(runtime, hookPath, {
                tool: "test_tool",
                toolInput: "{}",
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, { complex: { nested: "data" } });
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.output).toContain('{"complex":{"nested":"data"}}');
        });
        (0, bun_test_1.test)("reports failure when hook exits non-zero", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_post");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, '#!/bin/bash\necho "lint error" >&2\nexit 1');
            await fs.chmod(hookPath, 0o755);
            const result = await (0, hooks_1.runPostHook)(runtime, hookPath, {
                tool: "file_edit",
                toolInput: "{}",
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, { success: true });
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.exitCode).toBe(1);
            (0, bun_test_1.expect)(result.output).toContain("lint error");
        });
    });
    (0, bun_test_1.describe)("runWithHook", () => {
        (0, bun_test_1.test)("executes tool when hook prints $UNIX_EXEC", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that signals ready and reads result
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            let toolExecuted = false;
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test_tool",
                toolInput: '{"arg": "value"}',
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, () => {
                toolExecuted = true;
                return Promise.resolve({ success: true, data: "test result" });
            });
            (0, bun_test_1.expect)(toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(result).toEqual({ success: true, data: "test result" });
        });
        (0, bun_test_1.test)("blocks tool when hook exits before $UNIX_EXEC", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that exits immediately with error
            await fs.writeFile(hookPath, `#!/bin/bash
echo "Tool blocked by policy" >&2
exit 1
`);
            await fs.chmod(hookPath, 0o755);
            let toolExecuted = false;
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "dangerous_tool",
                toolInput: "{}",
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, () => {
                toolExecuted = true;
                return Promise.resolve({ success: true });
            });
            (0, bun_test_1.expect)(toolExecuted).toBe(false);
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(false);
            (0, bun_test_1.expect)(hook.success).toBe(false);
            (0, bun_test_1.expect)(hook.stderr).toContain("Tool blocked by policy");
            (0, bun_test_1.expect)(result).toBeUndefined();
        });
        (0, bun_test_1.test)("captures stderr when hook fails after tool execution", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that runs tool then fails (simulating lint failure)
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
echo "Lint error: missing semicolon" >&2
exit 1
`);
            await fs.chmod(hookPath, 0o755);
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "file_edit_replace_string",
                toolInput: '{"file_path": "test.ts"}',
                workspaceId: "test-workspace",
                projectDir: tempDir,
            }, () => {
                return Promise.resolve({ success: true, diff: "+line" });
            });
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.success).toBe(false);
            (0, bun_test_1.expect)(hook.stderr).toContain("Lint error: missing semicolon");
            (0, bun_test_1.expect)(result).toEqual({ success: true, diff: "+line" });
        });
        (0, bun_test_1.test)("receives tool input via UNIX_TOOL_INPUT env var", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that echoes env vars to stderr for verification
            await fs.writeFile(hookPath, `#!/bin/bash
echo "TOOL=$UNIX_TOOL" >&2
echo "INPUT=$UNIX_TOOL_INPUT" >&2
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "bash",
                toolInput: '{"script": "echo hello"}',
                workspaceId: "ws-123",
                projectDir: tempDir,
            }, () => Promise.resolve({ success: true }));
            (0, bun_test_1.expect)(hook.stderr).toContain("TOOL=bash");
            (0, bun_test_1.expect)(hook.stderr).toContain('INPUT={"script": "echo hello"}');
        });
        (0, bun_test_1.test)("receives tool result via stdin", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that reads result and echoes it to stderr
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
echo "GOT_RESULT=$RESULT" >&2
`);
            await fs.chmod(hookPath, 0o755);
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.resolve({ status: "ok", count: 42 }));
            (0, bun_test_1.expect)(hook.stderr).toContain('GOT_RESULT={"status":"ok","count":42}');
        });
        (0, bun_test_1.test)("passes additional env vars to hook", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo "SECRET=$MY_SECRET" >&2
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
                env: { MY_SECRET: "secret-value" },
            }, () => Promise.resolve({ success: true }));
            (0, bun_test_1.expect)(hook.stderr).toContain("SECRET=secret-value");
        });
        (0, bun_test_1.test)("rethrows tool errors after hook completes", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
echo "Hook received: $RESULT" >&2
`);
            await fs.chmod(hookPath, 0o755);
            const toolError = new Error("Tool execution failed");
            (0, bun_test_1.expect)((0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.reject(toolError))).rejects.toThrow("Tool execution failed");
        });
        (0, bun_test_1.test)("handles hook paths with spaces", async () => {
            // Create a directory with spaces in the name
            const spacedDir = path.join(tempDir, "my project");
            const hookDir = path.join(spacedDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            // Create a runtime for the spaced directory
            const spacedRuntime = new LocalRuntime_1.LocalRuntime(spacedDir);
            const { result, hook } = await (0, hooks_1.runWithHook)(spacedRuntime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: spacedDir,
            }, () => Promise.resolve({ success: true }));
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(result).toEqual({ success: true });
        });
        (0, bun_test_1.test)("succeeds when hook exits without reading UNIX_RESULT", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that signals exec but exits immediately without reading stdin
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
exit 0
`);
            await fs.chmod(hookPath, 0o755);
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.resolve({ success: true, data: "result" }));
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(result).toEqual({ success: true, data: "result" });
        });
        (0, bun_test_1.test)("logs warning when pre-hook takes too long", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that sleeps before signaling exec
            await fs.writeFile(hookPath, `#!/bin/bash
sleep 0.15
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            const warnings = [];
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.resolve({ success: true }), {
                slowThresholdMs: 100,
                onSlowHook: (phase, elapsed) => warnings.push(`${phase}: ${elapsed}ms`),
            });
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(warnings.length).toBe(1);
            (0, bun_test_1.expect)(warnings[0]).toMatch(/^pre: \d+ms$/);
        });
        (0, bun_test_1.test)("logs warning when post-hook takes too long", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            // Hook that sleeps after reading result
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
sleep 0.15
`);
            await fs.chmod(hookPath, 0o755);
            const warnings = [];
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.resolve({ success: true }), {
                slowThresholdMs: 100,
                onSlowHook: (phase, elapsed) => warnings.push(`${phase}: ${elapsed}ms`),
            });
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(warnings.length).toBe(1);
            (0, bun_test_1.expect)(warnings[0]).toMatch(/^post: \d+ms$/);
        });
        (0, bun_test_1.test)("does not log warning when hook is fast", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            const warnings = [];
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.resolve({ success: true }), {
                slowThresholdMs: 100,
                onSlowHook: (phase, elapsed) => warnings.push(`${phase}: ${elapsed}ms`),
            });
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(warnings.length).toBe(0);
        });
        (0, bun_test_1.test)("sends streaming placeholder to hook for AsyncIterable results", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
echo "GOT_RESULT=$RESULT" >&2
`);
            await fs.chmod(hookPath, 0o755);
            async function* stream() {
                await Promise.resolve();
                yield "chunk";
            }
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => Promise.resolve(stream()));
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(hook.stderr).toContain('GOT_RESULT={"streaming":true}');
        });
        (0, bun_test_1.test)("times out when pre-hook takes too long (does not run tool)", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
sleep 0.15
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            let toolExecuted = false;
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => {
                toolExecuted = true;
                return Promise.resolve({ success: true });
            }, {
                preHookTimeoutMs: 50,
                postHookTimeoutMs: 1000,
            });
            (0, bun_test_1.expect)(toolExecuted).toBe(false);
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(false);
            (0, bun_test_1.expect)(hook.success).toBe(false);
            (0, bun_test_1.expect)(hook.stderr).toContain("Hook timed out before $UNIX_EXEC");
            (0, bun_test_1.expect)(result).toBeUndefined();
        });
        (0, bun_test_1.test)("times out when post-hook takes too long (after tool result)", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
sleep 0.15
`);
            await fs.chmod(hookPath, 0o755);
            let toolExecuted = false;
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, () => {
                toolExecuted = true;
                return Promise.resolve({ success: true });
            }, {
                preHookTimeoutMs: 1000,
                postHookTimeoutMs: 50,
            });
            (0, bun_test_1.expect)(toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.success).toBe(false);
            (0, bun_test_1.expect)(hook.stderr).toContain("Hook timed out after tool result was sent");
            (0, bun_test_1.expect)(result).toEqual({ success: true });
        });
        (0, bun_test_1.test)("does not count tool duration towards hook timeouts", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            const { result, hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: "{}",
                workspaceId: "test",
                projectDir: tempDir,
            }, async () => {
                await new Promise((resolve) => setTimeout(resolve, 300));
                return { success: true };
            }, {
                preHookTimeoutMs: 200,
                postHookTimeoutMs: 200,
            });
            (0, bun_test_1.expect)(hook.toolExecuted).toBe(true);
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(result).toEqual({ success: true });
        });
        (0, bun_test_1.test)("writes large tool input to UNIX_TOOL_INPUT_PATH", async () => {
            const hookDir = path.join(tempDir, ".unix");
            const hookPath = path.join(hookDir, "tool_hook");
            await fs.mkdir(hookDir, { recursive: true });
            await fs.writeFile(hookPath, `#!/bin/bash
echo "ENV_INPUT=$UNIX_TOOL_INPUT" >&2

if [ -z "$UNIX_TOOL_INPUT_PATH" ]; then
  echo "NO_PATH" >&2
  exit 1
fi

len=$(wc -c < "$UNIX_TOOL_INPUT_PATH")
echo "LEN=$len" >&2

echo $UNIX_EXEC
read RESULT
`);
            await fs.chmod(hookPath, 0o755);
            const bigInput = JSON.stringify({ data: "x".repeat(9000) });
            const { hook } = await (0, hooks_1.runWithHook)(runtime, hookPath, {
                tool: "test",
                toolInput: bigInput,
                workspaceId: "test",
                projectDir: tempDir,
                runtimeTempDir: tempDir,
            }, () => Promise.resolve({ success: true }));
            (0, bun_test_1.expect)(hook.success).toBe(true);
            (0, bun_test_1.expect)(hook.stderr).toContain("ENV_INPUT=__UNIX_TOOL_INPUT_FILE__");
            (0, bun_test_1.expect)(hook.stderr).toMatch(new RegExp(`LEN=\\s*${bigInput.length}`));
        });
    });
});
//# sourceMappingURL=hooks.test.js.map