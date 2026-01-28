"use strict";
/**
 * Tool Hook System
 *
 * Provides a mechanism for users to wrap tool executions with custom pre/post logic.
 * Hooks can be used for:
 * - Environment setup (direnv, nvm, virtualenv)
 * - Linting/type-checking after file edits
 * - Blocking dangerous operations
 * - Custom logging/metrics
 *
 * Hook Location:
 *   1. .unix/tool_hook (project-level, committed)
 *   2. ~/.unix/tool_hook (user-level, personal)
 *
 * Protocol:
 *   1. Hook receives UNIX_TOOL, UNIX_TOOL_INPUT, UNIX_EXEC, etc. as env vars
 *   2. Hook runs pre-logic
 *   3. Hook prints $UNIX_EXEC (the unique marker) to signal readiness
 *   4. Unix executes the tool, sends result JSON to hook's stdin
 *   5. Hook reads result, runs post-logic
 *   6. Hook exits (non-zero = failure fed back to LLM)
 *
 * Runtime Support:
 *   Hooks execute via the Runtime abstraction, so they work correctly for both
 *   local and SSH workspaces. For SSH, the hook file must exist on the remote machine.
 */
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
exports.getHookPath = getHookPath;
exports.getToolEnvPath = getToolEnvPath;
exports.getPreHookPath = getPreHookPath;
exports.getPostHookPath = getPostHookPath;
exports.runWithHook = runWithHook;
exports.runPreHook = runPreHook;
exports.runPostHook = runPostHook;
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const log_1 = require("../../node/services/log");
const helpers_1 = require("../../node/utils/runtime/helpers");
const HOOK_FILENAME = "tool_hook";
const PRE_HOOK_FILENAME = "tool_pre";
const POST_HOOK_FILENAME = "tool_post";
const TOOL_ENV_FILENAME = "tool_env";
const TOOL_INPUT_ENV_LIMIT = 8_000;
const DEFAULT_HOOK_PHASE_TIMEOUT_MS = 10_000; // 10 seconds
const EXEC_MARKER_PREFIX = "UNIX_EXEC_";
/** Shell-escape a string for safe use in bash -c commands */
function shellEscape(str) {
    // Wrap in single quotes and escape any embedded single quotes
    return `'${str.replace(/'/g, "'\\''")}'`;
}
function isAsyncIterable(value) {
    return (typeof value === "object" &&
        value !== null &&
        Symbol.asyncIterator in value &&
        typeof value[Symbol.asyncIterator] === "function");
}
function joinPathLike(basePath, ...parts) {
    // For SSH runtimes (and most Unix paths), we want POSIX joins.
    // For Windows-style paths, use native joins.
    if (basePath.includes("\\") || /^[a-zA-Z]:/.test(basePath)) {
        return path.join(basePath, ...parts);
    }
    return path.posix.join(basePath, ...parts);
}
/**
 * Find the tool_hook executable for a given project directory.
 * Uses runtime abstraction so it works for both local and SSH workspaces.
 * Returns null if no hook exists.
 *
 * Note: We don't check execute permissions via runtime since FileStat doesn't
 * expose mode bits. The hook will fail at execution time if not executable.
 */
async function getHookPath(runtime, projectDir) {
    // Check project-level hook first
    const projectHook = joinPathLike(projectDir, ".unix", HOOK_FILENAME);
    if (await isFile(runtime, projectHook)) {
        return projectHook;
    }
    // Fall back to user-level hook (resolve ~ for SSH compatibility)
    try {
        const homeDir = await runtime.resolvePath("~");
        const userHook = joinPathLike(homeDir, ".unix", HOOK_FILENAME);
        if (await isFile(runtime, userHook)) {
            return userHook;
        }
    }
    catch {
        // resolvePath failed - skip user hook
    }
    return null;
}
/**
 * Find the tool_env file for a given project directory.
 * This file is sourced before bash tool scripts to set up environment.
 * Returns null if no tool_env exists.
 */
async function getToolEnvPath(runtime, projectDir) {
    // Check project-level tool_env first
    const projectEnv = joinPathLike(projectDir, ".unix", TOOL_ENV_FILENAME);
    if (await isFile(runtime, projectEnv)) {
        return projectEnv;
    }
    // Fall back to user-level tool_env (resolve ~ for SSH compatibility)
    try {
        const homeDir = await runtime.resolvePath("~");
        const userEnv = joinPathLike(homeDir, ".unix", TOOL_ENV_FILENAME);
        if (await isFile(runtime, userEnv)) {
            return userEnv;
        }
    }
    catch {
        // resolvePath failed - skip user tool_env
    }
    return null;
}
/**
 * Find the tool_pre executable for a given project directory.
 * This hook runs before tool execution; exit non-zero to block.
 * Returns null if no tool_pre exists.
 */
async function getPreHookPath(runtime, projectDir) {
    const projectHook = joinPathLike(projectDir, ".unix", PRE_HOOK_FILENAME);
    if (await isFile(runtime, projectHook)) {
        return projectHook;
    }
    try {
        const homeDir = await runtime.resolvePath("~");
        const userHook = joinPathLike(homeDir, ".unix", PRE_HOOK_FILENAME);
        if (await isFile(runtime, userHook)) {
            return userHook;
        }
    }
    catch {
        // resolvePath failed - skip user hook
    }
    return null;
}
/**
 * Find the tool_post executable for a given project directory.
 * This hook runs after tool execution with result available.
 * Returns null if no tool_post exists.
 */
async function getPostHookPath(runtime, projectDir) {
    const projectHook = joinPathLike(projectDir, ".unix", POST_HOOK_FILENAME);
    if (await isFile(runtime, projectHook)) {
        return projectHook;
    }
    try {
        const homeDir = await runtime.resolvePath("~");
        const userHook = joinPathLike(homeDir, ".unix", POST_HOOK_FILENAME);
        if (await isFile(runtime, userHook)) {
            return userHook;
        }
    }
    catch {
        // resolvePath failed - skip user hook
    }
    return null;
}
// When probing hook files over SSH, avoid hanging on dead connections.
// Hook discovery is best-effort; a short timeout keeps tool execution responsive.
const HOOK_FILE_STAT_TIMEOUT_MS = 2000;
async function isFile(runtime, filePath) {
    try {
        const stat = await runtime.stat(filePath, AbortSignal.timeout(HOOK_FILE_STAT_TIMEOUT_MS));
        return !stat.isDirectory;
    }
    catch {
        return false;
    }
}
/**
 * Execute a tool with hook wrapping.
 * Uses runtime.exec() so hooks work for both local and SSH workspaces.
 *
 * @param runtime Runtime to execute the hook in
 * @param hookPath Path to the hook executable
 * @param context Hook context with tool info
 * @param executeTool Callback to execute the actual tool (called when hook signals __UNIX_EXEC__)
 * @param timingOptions Optional timing/warning configuration
 * @returns Hook result with success status and any stderr output
 */
async function runWithHook(runtime, hookPath, context, executeTool, timingOptions) {
    const slowThresholdMs = timingOptions?.slowThresholdMs ?? 10000;
    const onSlowHook = timingOptions?.onSlowHook;
    const preHookTimeoutMs = timingOptions?.preHookTimeoutMs ?? DEFAULT_HOOK_PHASE_TIMEOUT_MS;
    const postHookTimeoutMs = timingOptions?.postHookTimeoutMs ?? DEFAULT_HOOK_PHASE_TIMEOUT_MS;
    const hookStartTime = Date.now();
    // Generate a unique marker for this invocation to prevent accidental triggers
    const execMarker = `${EXEC_MARKER_PREFIX}${crypto.randomUUID().replace(/-/g, "")}`;
    let toolInputPath;
    let toolInputEnv = context.toolInput;
    if (context.toolInput.length > TOOL_INPUT_ENV_LIMIT) {
        // Tool input can be massive (file_edit_* old/new strings) and can exceed limits
        // when injected as env vars (especially over SSH, where env is embedded into a
        // single bash -c command string). Prefer writing the full JSON to a temp file.
        try {
            const tempDir = context.runtimeTempDir ?? "/tmp";
            toolInputPath = joinPathLike(tempDir, `unix-tool-input-${Date.now()}-${crypto.randomUUID()}.json`);
            await (0, helpers_1.writeFileString)(runtime, toolInputPath, context.toolInput);
            toolInputEnv = "__UNIX_TOOL_INPUT_FILE__";
        }
        catch (err) {
            log_1.log.debug("[hooks] Failed to write tool input to temp file; falling back to truncation", {
                error: err,
            });
            toolInputPath = undefined;
            toolInputEnv = context.toolInput.slice(0, TOOL_INPUT_ENV_LIMIT);
        }
    }
    const hookEnv = {
        ...(context.env ?? {}),
        UNIX_TOOL: context.tool,
        UNIX_TOOL_INPUT: toolInputEnv,
        UNIX_WORKSPACE_ID: context.workspaceId,
        UNIX_PROJECT_DIR: context.projectDir,
        UNIX_EXEC: execMarker,
    };
    if (toolInputPath) {
        hookEnv.UNIX_TOOL_INPUT_PATH = toolInputPath;
    }
    const abortController = new AbortController();
    let timeoutPhase;
    let preTimeoutHandle;
    let postTimeoutHandle;
    // Forward external abort signal (e.g., workspace deletion)
    if (context.abortSignal) {
        if (context.abortSignal.aborted) {
            timeoutPhase = "external";
            abortController.abort();
        }
        else {
            context.abortSignal.addEventListener("abort", () => {
                timeoutPhase = "external";
                abortController.abort();
            }, { once: true });
        }
    }
    if (preHookTimeoutMs > 0) {
        preTimeoutHandle = setTimeout(() => {
            timeoutPhase = "pre";
            abortController.abort();
        }, preHookTimeoutMs);
    }
    let stream;
    try {
        // Shell-escape the hook path to handle spaces and special characters
        // runtime.exec() uses bash -c, so unquoted paths would break
        stream = await runtime.exec(shellEscape(hookPath), {
            cwd: context.projectDir,
            env: hookEnv,
            abortSignal: abortController.signal,
        });
    }
    catch (err) {
        if (preTimeoutHandle) {
            clearTimeout(preTimeoutHandle);
            preTimeoutHandle = undefined;
        }
        log_1.log.error("[hooks] Failed to spawn hook", { hookPath, error: err });
        if (toolInputPath) {
            try {
                await (0, helpers_1.execBuffered)(runtime, `rm -f ${shellEscape(toolInputPath)}`, {
                    cwd: context.projectDir,
                    timeout: 5,
                });
            }
            catch {
                // Best-effort cleanup
            }
        }
        return {
            result: undefined,
            hook: {
                success: false,
                stdoutBeforeExec: "",
                stdout: "",
                stderr: `Failed to execute hook: ${err instanceof Error ? err.message : String(err)}`,
                exitCode: -1,
                toolExecuted: false,
            },
        };
    }
    let toolResult;
    let toolError;
    let hookStdinWriteError;
    let toolExecuted = false;
    let toolResultSentTime;
    let stderrOutput = "";
    let stdoutBuffer = "";
    let stdoutBeforeExec = "";
    let stdoutAfterMarker = "";
    let toolPromise;
    // Read stderr in background
    const stderrReader = stream.stderr.getReader();
    const stderrPromise = (async () => {
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await stderrReader.read();
                if (done)
                    break;
                stderrOutput += decoder.decode(value, { stream: true });
            }
        }
        catch {
            // Ignore stream errors (e.g. abort)
        }
        finally {
            stderrReader.releaseLock();
        }
    })();
    // Read stdout, watching for __UNIX_EXEC__ marker
    const stdoutReader = stream.stdout.getReader();
    const decoder = new TextDecoder();
    try {
        while (true) {
            const { done, value } = await stdoutReader.read();
            if (done)
                break;
            const chunk = decoder.decode(value, { stream: true });
            if (toolExecuted) {
                // After marker: capture for hook output
                stdoutAfterMarker += chunk;
                continue;
            }
            stdoutBuffer += chunk;
            const markerIdx = stdoutBuffer.indexOf(execMarker);
            if (markerIdx === -1) {
                continue;
            }
            // Marker detected: allow tool execution.
            // Stop the pre-hook timeout clock and start the tool.
            if (preTimeoutHandle) {
                clearTimeout(preTimeoutHandle);
                preTimeoutHandle = undefined;
            }
            // Check pre-hook timing before marking as executed
            const preHookElapsed = Date.now() - hookStartTime;
            if (onSlowHook && preHookElapsed > slowThresholdMs) {
                onSlowHook("pre", preHookElapsed);
            }
            toolExecuted = true;
            stdoutBeforeExec = stdoutBuffer.slice(0, markerIdx);
            stdoutAfterMarker = stdoutBuffer.slice(markerIdx + execMarker.length);
            // Execute tool + send result to hook stdin in the background so we can
            // continue draining stdout (hooks may log after __UNIX_EXEC__).
            toolPromise = (async () => {
                try {
                    try {
                        toolResult = await executeTool();
                    }
                    catch (err) {
                        toolError = err instanceof Error ? err : new Error(String(err));
                    }
                    const payload = toolError ? { error: toolError.message } : toolResult;
                    const payloadForHook = isAsyncIterable(payload) ? { streaming: true } : payload;
                    const writer = stream.stdin.getWriter();
                    try {
                        await writer.write(new TextEncoder().encode(JSON.stringify(payloadForHook) + "\n"));
                    }
                    catch (err) {
                        hookStdinWriteError = err instanceof Error ? err : new Error(String(err));
                    }
                    finally {
                        try {
                            await writer.close();
                        }
                        catch {
                            // Ignore close errors (e.g. EPIPE if hook exited)
                        }
                        toolResultSentTime = Date.now();
                        if (postHookTimeoutMs > 0) {
                            postTimeoutHandle = setTimeout(() => {
                                timeoutPhase = "post";
                                abortController.abort();
                            }, postHookTimeoutMs);
                        }
                    }
                }
                catch (err) {
                    // This should never throw, but guard to avoid unhandled rejections.
                    hookStdinWriteError = err instanceof Error ? err : new Error(String(err));
                }
            })();
        }
    }
    catch {
        // Ignore stream errors (e.g. abort)
    }
    finally {
        stdoutReader.releaseLock();
    }
    // If hook exited before __UNIX_EXEC__, close stdin
    if (!toolExecuted) {
        // Cancel the pre-hook timeout.
        if (preTimeoutHandle) {
            clearTimeout(preTimeoutHandle);
            preTimeoutHandle = undefined;
        }
        const writer = stream.stdin.getWriter();
        try {
            await writer.close();
        }
        catch {
            // Ignore close errors (e.g. hook already exited)
        }
    }
    // Wait for tool execution (if started), stderr collection, and exit code
    await toolPromise;
    await stderrPromise;
    const exitCode = await stream.exitCode;
    if (postTimeoutHandle) {
        clearTimeout(postTimeoutHandle);
        postTimeoutHandle = undefined;
    }
    // Check post-hook timing (time from result sent to hook exit)
    if (onSlowHook && toolResultSentTime) {
        const postHookElapsed = Date.now() - toolResultSentTime;
        if (postHookElapsed > slowThresholdMs) {
            onSlowHook("post", postHookElapsed);
        }
    }
    if (timeoutPhase === "pre") {
        stderrOutput += `\nHook timed out before $UNIX_EXEC marker (${preHookTimeoutMs}ms)`;
    }
    else if (timeoutPhase === "post") {
        stderrOutput += `\nHook timed out after tool result was sent (${postHookTimeoutMs}ms)`;
    }
    else if (timeoutPhase === "external") {
        stderrOutput += `\nHook aborted (workspace deleted or request cancelled)`;
    }
    if (hookStdinWriteError) {
        stderrOutput += `\nFailed to write tool result to hook stdin: ${hookStdinWriteError.message}`;
    }
    if (toolInputPath) {
        try {
            await (0, helpers_1.execBuffered)(runtime, `rm -f ${shellEscape(toolInputPath)}`, {
                cwd: context.projectDir,
                timeout: 5,
            });
        }
        catch {
            // Best-effort cleanup
        }
    }
    // If tool threw an error, rethrow it after hook completes
    // This ensures tool failures propagate even when hooks are present
    if (toolError) {
        throw toolError;
    }
    return {
        result: toolResult,
        hook: {
            success: exitCode === 0,
            stdoutBeforeExec: (toolExecuted ? stdoutBeforeExec : stdoutBuffer).trim(),
            stdout: stdoutAfterMarker.trim(),
            stderr: stderrOutput.trim(),
            exitCode,
            toolExecuted,
        },
    };
}
/**
 * Run a pre-hook (tool_pre) before tool execution.
 * Simple model: spawn hook, wait for exit, check exit code.
 * Exit 0 = allow tool, non-zero = block tool.
 */
async function runPreHook(runtime, hookPath, context, options) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_HOOK_PHASE_TIMEOUT_MS;
    // Prepare tool input (file if large)
    const { toolInputEnv, toolInputPath, cleanup } = await prepareToolInput(runtime, context.toolInput, context.runtimeTempDir, context.projectDir);
    const hookEnv = {
        ...(context.env ?? {}),
        UNIX_TOOL: context.tool,
        UNIX_TOOL_INPUT: toolInputEnv,
        UNIX_WORKSPACE_ID: context.workspaceId,
        UNIX_PROJECT_DIR: context.projectDir,
    };
    if (toolInputPath) {
        hookEnv.UNIX_TOOL_INPUT_PATH = toolInputPath;
    }
    try {
        const result = await (0, helpers_1.execBuffered)(runtime, shellEscape(hookPath), {
            cwd: context.projectDir,
            env: hookEnv,
            timeout: Math.ceil(timeoutMs / 1000),
            abortSignal: context.abortSignal,
        });
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        return {
            allowed: result.exitCode === 0,
            output,
            exitCode: result.exitCode ?? -1,
        };
    }
    catch (err) {
        log_1.log.error("[hooks] Pre-hook execution failed", { hookPath, error: err });
        return {
            allowed: false,
            output: `Pre-hook failed: ${err instanceof Error ? err.message : String(err)}`,
            exitCode: -1,
        };
    }
    finally {
        await cleanup();
    }
}
/**
 * Run a post-hook (tool_post) after tool execution.
 * Simple model: spawn hook with result in env/file, wait for exit.
 */
async function runPostHook(runtime, hookPath, context, toolResult, options) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_HOOK_PHASE_TIMEOUT_MS;
    const resultJson = JSON.stringify(toolResult);
    // Prepare tool input (file if large)
    const { toolInputEnv, toolInputPath, cleanup: cleanupInput, } = await prepareToolInput(runtime, context.toolInput, context.runtimeTempDir, context.projectDir);
    // Prepare tool result (always write to file, truncate env var if large)
    const resultPath = joinPathLike(context.runtimeTempDir ?? "/tmp", `unix-tool-result-${Date.now()}-${crypto.randomUUID()}.json`);
    let resultEnv = resultJson;
    try {
        await (0, helpers_1.writeFileString)(runtime, resultPath, resultJson);
        if (resultJson.length > TOOL_INPUT_ENV_LIMIT) {
            resultEnv = "__UNIX_TOOL_RESULT_FILE__";
        }
    }
    catch (err) {
        log_1.log.debug("[hooks] Failed to write tool result to temp file", { error: err });
        resultEnv = resultJson.slice(0, TOOL_INPUT_ENV_LIMIT);
    }
    const hookEnv = {
        ...(context.env ?? {}),
        UNIX_TOOL: context.tool,
        UNIX_TOOL_INPUT: toolInputEnv,
        UNIX_WORKSPACE_ID: context.workspaceId,
        UNIX_PROJECT_DIR: context.projectDir,
        UNIX_TOOL_RESULT: resultEnv,
        UNIX_TOOL_RESULT_PATH: resultPath,
    };
    if (toolInputPath) {
        hookEnv.UNIX_TOOL_INPUT_PATH = toolInputPath;
    }
    const cleanup = async () => {
        await cleanupInput();
        try {
            await (0, helpers_1.execBuffered)(runtime, `rm -f ${shellEscape(resultPath)}`, {
                cwd: context.projectDir,
                timeout: 5,
            });
        }
        catch {
            // Best-effort
        }
    };
    try {
        const result = await (0, helpers_1.execBuffered)(runtime, shellEscape(hookPath), {
            cwd: context.projectDir,
            env: hookEnv,
            timeout: Math.ceil(timeoutMs / 1000),
            abortSignal: context.abortSignal,
        });
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        return {
            success: result.exitCode === 0,
            output,
            exitCode: result.exitCode ?? -1,
        };
    }
    catch (err) {
        log_1.log.error("[hooks] Post-hook execution failed", { hookPath, error: err });
        return {
            success: false,
            output: `Post-hook failed: ${err instanceof Error ? err.message : String(err)}`,
            exitCode: -1,
        };
    }
    finally {
        await cleanup();
    }
}
/** Helper to prepare tool input (write to file if large) */
async function prepareToolInput(runtime, toolInput, runtimeTempDir, projectDir) {
    let toolInputPath;
    let toolInputEnv = toolInput;
    if (toolInput.length > TOOL_INPUT_ENV_LIMIT) {
        try {
            const tempDir = runtimeTempDir ?? "/tmp";
            toolInputPath = joinPathLike(tempDir, `unix-tool-input-${Date.now()}-${crypto.randomUUID()}.json`);
            await (0, helpers_1.writeFileString)(runtime, toolInputPath, toolInput);
            toolInputEnv = "__UNIX_TOOL_INPUT_FILE__";
        }
        catch (err) {
            log_1.log.debug("[hooks] Failed to write tool input to temp file", { error: err });
            toolInputPath = undefined;
            toolInputEnv = toolInput.slice(0, TOOL_INPUT_ENV_LIMIT);
        }
    }
    const cleanup = async () => {
        if (toolInputPath) {
            try {
                await (0, helpers_1.execBuffered)(runtime, `rm -f ${shellEscape(toolInputPath)}`, {
                    cwd: projectDir,
                    timeout: 5,
                });
            }
            catch {
                // Best-effort
            }
        }
    };
    return { toolInputEnv, toolInputPath, cleanup };
}
//# sourceMappingURL=hooks.js.map