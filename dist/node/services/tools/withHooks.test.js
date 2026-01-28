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
const ai_1 = require("ai");
const zod_1 = require("zod");
const withHooks_1 = require("./withHooks");
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
(0, bun_test_1.describe)("withHooks", () => {
    let tempDir;
    let runtime;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-withHooks-test-"));
        runtime = new LocalRuntime_1.LocalRuntime(tempDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    function createTestTool(executeFn) {
        return (0, ai_1.tool)({
            description: "Test tool",
            inputSchema: zod_1.z.object({ input: zod_1.z.string() }),
            execute: (args) => executeFn(args),
        });
    }
    (0, bun_test_1.test)("executes tool directly when no hook exists", async () => {
        const baseTool = createTestTool((args) => Promise.resolve({ output: `processed: ${args.input}` }));
        const wrappedTool = (0, withHooks_1.withHooks)("test_tool", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = await wrappedTool.execute({ input: "hello" }, {});
        (0, bun_test_1.expect)(result).toEqual({ output: "processed: hello" });
    });
    (0, bun_test_1.test)("executes tool through hook when hook exists", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const hookPath = path.join(hookDir, "tool_hook");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookPath, `#!/bin/bash
echo "$UNIX_EXEC"
read RESULT
`);
        await fs.chmod(hookPath, 0o755);
        const baseTool = createTestTool((args) => Promise.resolve({ output: `processed: ${args.input}` }));
        const wrappedTool = (0, withHooks_1.withHooks)("test_tool", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = await wrappedTool.execute({ input: "world" }, {});
        (0, bun_test_1.expect)(result).toEqual({ output: "processed: world" });
    });
    (0, bun_test_1.test)("returns error when hook blocks execution", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const hookPath = path.join(hookDir, "tool_hook");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookPath, `#!/bin/bash
echo "Blocked: dangerous operation" >&2
exit 1
`);
        await fs.chmod(hookPath, 0o755);
        let toolCalled = false;
        const baseTool = createTestTool(() => {
            toolCalled = true;
            return Promise.resolve({ output: "should not run" });
        });
        const wrappedTool = (0, withHooks_1.withHooks)("test_tool", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = (await wrappedTool.execute({ input: "test" }, {}));
        (0, bun_test_1.expect)(toolCalled).toBe(false);
        (0, bun_test_1.expect)(result.error).toContain("Blocked: dangerous operation");
    });
    (0, bun_test_1.test)("appends hook_output when hook fails after execution", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const hookPath = path.join(hookDir, "tool_hook");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookPath, `#!/bin/bash
echo "$UNIX_EXEC"
read RESULT
echo "Lint failed: syntax error" >&2
exit 1
`);
        await fs.chmod(hookPath, 0o755);
        const baseTool = createTestTool(() => Promise.resolve({ output: "edit complete" }));
        const wrappedTool = (0, withHooks_1.withHooks)("file_edit", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = (await wrappedTool.execute({ input: "test" }, {}));
        (0, bun_test_1.expect)(result.output).toBe("edit complete");
        (0, bun_test_1.expect)(result.hook_output).toContain("Lint failed: syntax error");
    });
    (0, bun_test_1.test)("appends hook_output and hook_path when hook succeeds with output", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const hookPath = path.join(hookDir, "tool_hook");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookPath, `#!/bin/bash
echo "$UNIX_EXEC"
read RESULT
echo "Formatted: test.ts" >&2
exit 0
`);
        await fs.chmod(hookPath, 0o755);
        const baseTool = createTestTool(() => Promise.resolve({ output: "edit complete" }));
        const wrappedTool = (0, withHooks_1.withHooks)("file_edit", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = (await wrappedTool.execute({ input: "test" }, {}));
        (0, bun_test_1.expect)(result.output).toBe("edit complete");
        (0, bun_test_1.expect)(result.hook_output).toContain("Formatted: test.ts");
        (0, bun_test_1.expect)(result.hook_path).toBe(hookPath);
    });
    (0, bun_test_1.test)("passes env to hook", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const hookPath = path.join(hookDir, "tool_hook");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookPath, `#!/bin/bash
# Exit with error if SECRET is not set correctly
if [ "$MY_API_KEY" != "secret123" ]; then
  echo "SECRET not found" >&2
  exit 1
fi
echo "$UNIX_EXEC"
read RESULT
`);
        await fs.chmod(hookPath, 0o755);
        const baseTool = createTestTool(() => Promise.resolve({ output: "ok" }));
        const wrappedTool = (0, withHooks_1.withHooks)("test_tool", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
            env: { MY_API_KEY: "secret123" },
        });
        const result = await wrappedTool.execute({ input: "test" }, {});
        (0, bun_test_1.expect)(result).toEqual({ output: "ok" });
    });
    (0, bun_test_1.test)("uses tool_pre hook to block execution", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const hookPath = path.join(hookDir, "tool_pre");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(hookPath, `#!/bin/bash
echo "Force push blocked" >&2
exit 1
`);
        await fs.chmod(hookPath, 0o755);
        let toolExecuted = false;
        const baseTool = createTestTool(() => {
            toolExecuted = true;
            return Promise.resolve({ output: "should not happen" });
        });
        const wrappedTool = (0, withHooks_1.withHooks)("bash", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = (await wrappedTool.execute({ input: "test" }, {}));
        (0, bun_test_1.expect)(toolExecuted).toBe(false);
        (0, bun_test_1.expect)(result.error).toContain("Force push blocked");
    });
    (0, bun_test_1.test)("uses tool_post hook to add output after execution", async () => {
        const hookDir = path.join(tempDir, ".unix");
        const postHookPath = path.join(hookDir, "tool_post");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(postHookPath, `#!/bin/bash
echo "Linting passed" >&2
exit 0
`);
        await fs.chmod(postHookPath, 0o755);
        const baseTool = createTestTool(() => Promise.resolve({ output: "edit done" }));
        const wrappedTool = (0, withHooks_1.withHooks)("file_edit", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = (await wrappedTool.execute({ input: "test" }, {}));
        (0, bun_test_1.expect)(result.output).toBe("edit done");
        (0, bun_test_1.expect)(result.hook_output).toContain("Linting passed");
    });
    (0, bun_test_1.test)("tool_pre takes priority over tool_hook", async () => {
        const hookDir = path.join(tempDir, ".unix");
        await fs.mkdir(hookDir, { recursive: true });
        // Create both tool_pre and tool_hook
        await fs.writeFile(path.join(hookDir, "tool_pre"), "#!/bin/bash\nexit 0");
        await fs.chmod(path.join(hookDir, "tool_pre"), 0o755);
        // Legacy hook that would block if used
        await fs.writeFile(path.join(hookDir, "tool_hook"), "#!/bin/bash\nexit 1");
        await fs.chmod(path.join(hookDir, "tool_hook"), 0o755);
        const baseTool = createTestTool(() => Promise.resolve({ output: "success" }));
        const wrappedTool = (0, withHooks_1.withHooks)("test_tool", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        // Should succeed because tool_pre (exit 0) takes priority over tool_hook (exit 1)
        const result = await wrappedTool.execute({ input: "test" }, {});
        (0, bun_test_1.expect)(result).toEqual({ output: "success" });
    });
    (0, bun_test_1.test)("tool_pre + tool_post work together", async () => {
        const hookDir = path.join(tempDir, ".unix");
        await fs.mkdir(hookDir, { recursive: true });
        await fs.writeFile(path.join(hookDir, "tool_pre"), '#!/bin/bash\necho "pre ran" >&2\nexit 0');
        await fs.chmod(path.join(hookDir, "tool_pre"), 0o755);
        await fs.writeFile(path.join(hookDir, "tool_post"), '#!/bin/bash\necho "post ran: $UNIX_TOOL_RESULT"');
        await fs.chmod(path.join(hookDir, "tool_post"), 0o755);
        const baseTool = createTestTool(() => Promise.resolve({ output: "done", value: 42 }));
        const wrappedTool = (0, withHooks_1.withHooks)("test_tool", baseTool, {
            runtime,
            cwd: tempDir,
            runtimeTempDir: tempDir,
            workspaceId: "test-ws",
        });
        const result = (await wrappedTool.execute({ input: "test" }, {}));
        (0, bun_test_1.expect)(result.value).toBe(42);
        (0, bun_test_1.expect)(result.hook_output).toContain("post ran:");
        (0, bun_test_1.expect)(result.hook_output).toContain('"value":42');
    });
});
//# sourceMappingURL=withHooks.test.js.map