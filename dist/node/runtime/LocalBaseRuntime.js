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
exports.LocalBaseRuntime = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const fsPromises = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const stream_1 = require("stream");
const Runtime_1 = require("./Runtime");
const env_1 = require("../../common/constants/env");
const bashPath_1 = require("../../node/utils/main/bashPath");
const shell_1 = require("../../common/utils/shell");
const exitCodes_1 = require("../../common/constants/exitCodes");
const disposableExec_1 = require("../../node/utils/disposableExec");
const tildeExpansion_1 = require("./tildeExpansion");
const initHook_1 = require("./initHook");
/**
 * Abstract base class for local runtimes (both WorktreeRuntime and LocalRuntime).
 *
 * Provides shared implementation for:
 * - exec() - Command execution with streaming I/O
 * - readFile() - File reading with streaming
 * - writeFile() - Atomic file writes with streaming
 * - stat() - File statistics
 * - resolvePath() - Path resolution with tilde expansion
 * - normalizePath() - Path normalization
 *
 * Subclasses must implement workspace-specific methods:
 * - getWorkspacePath()
 * - createWorkspace()
 * - initWorkspace()
 * - deleteWorkspace()
 * - renameWorkspace()
 * - forkWorkspace()
 */
class LocalBaseRuntime {
    async exec(command, options) {
        const startTime = performance.now();
        // Use the specified working directory (must be a specific workspace path)
        const cwd = options.cwd;
        // Check if working directory exists before spawning
        // This prevents confusing ENOENT errors from spawn()
        try {
            await fsPromises.access(cwd);
        }
        catch (err) {
            throw new Runtime_1.RuntimeError(`Working directory does not exist: ${cwd}`, "exec", err instanceof Error ? err : undefined);
        }
        const bashPath = (0, bashPath_1.getBashPath)();
        const spawnCommand = bashPath;
        // Match RemoteRuntime behavior: ensure non-interactive env vars are set inside the shell.
        //
        // Why not rely solely on `env`?
        // - On Windows, env var casing and shell startup state can be surprising.
        // - These are non-sensitive vars that we want to guarantee for git/editor safety.
        const nonInteractivePrelude = Object.entries(env_1.NON_INTERACTIVE_ENV_VARS)
            .map(([key, value]) => `export ${key}=${(0, shell_1.shellQuote)(value)}`)
            .join("\n");
        const spawnArgs = ["-c", `${nonInteractivePrelude}\n${command}`];
        const defaultPath = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";
        const effectivePath = (options.env?.PATH && options.env.PATH.length > 0 ? options.env.PATH : process.env.PATH) ??
            defaultPath;
        const childProcess = (0, child_process_1.spawn)(spawnCommand, spawnArgs, {
            cwd,
            env: {
                ...process.env,
                ...(options.env ?? {}),
                ...env_1.NON_INTERACTIVE_ENV_VARS,
                PATH: effectivePath,
            },
            stdio: ["pipe", "pipe", "pipe"],
            // CRITICAL: Spawn as detached process group leader to enable cleanup of background processes.
            // When a bash script spawns background processes (e.g., `sleep 100 &`), we need to kill
            // the entire process group (including all backgrounded children) via process.kill(-pid).
            // NOTE: detached:true does NOT cause bash to wait for background jobs when using 'exit' event
            // instead of 'close' event. The 'exit' event fires when bash exits, ignoring background children.
            detached: true,
            // Prevent console window from appearing on Windows (WSL bash spawns steal focus otherwise)
            windowsHide: true,
        });
        // Wrap in DisposableProcess for automatic cleanup
        const disposable = new disposableExec_1.DisposableProcess(childProcess);
        // Convert Node.js streams to Web Streams
        const stdout = stream_1.Readable.toWeb(childProcess.stdout);
        const stderr = stream_1.Readable.toWeb(childProcess.stderr);
        const stdin = stream_1.Writable.toWeb(childProcess.stdin);
        // No stream cleanup in DisposableProcess - streams close naturally when process exits
        // bash.ts handles cleanup after waiting for exitCode
        // Track if we killed the process due to timeout or abort
        let timedOut = false;
        let aborted = false;
        // Create promises for exit code and duration
        // Uses special exit codes (EXIT_CODE_ABORTED, EXIT_CODE_TIMEOUT) for expected error conditions
        const exitCode = new Promise((resolve, reject) => {
            // Use 'exit' event instead of 'close' to handle background processes correctly.
            // The 'close' event waits for ALL child processes (including background ones) to exit,
            // which causes hangs when users spawn background processes like servers.
            // The 'exit' event fires when the main bash process exits, which is what we want.
            childProcess.on("exit", (code) => {
                // Clean up any background processes (process group cleanup)
                // This prevents zombie processes when scripts spawn background tasks
                if (childProcess.pid !== undefined) {
                    // Kill the full process tree to prevent hangs when scripts spawn background jobs.
                    //
                    // On Unix we can kill the whole group via process.kill(-pid).
                    // On Windows we must use taskkill to avoid leaking child processes.
                    (0, disposableExec_1.killProcessTree)(childProcess.pid);
                }
                // Check abort first (highest priority)
                if (aborted || options.abortSignal?.aborted) {
                    resolve(exitCodes_1.EXIT_CODE_ABORTED);
                    return;
                }
                // Check if we killed the process due to timeout
                if (timedOut) {
                    resolve(exitCodes_1.EXIT_CODE_TIMEOUT);
                    return;
                }
                resolve(code ?? 0);
                // Cleanup runs automatically via DisposableProcess
            });
            childProcess.on("error", (err) => {
                reject(new Runtime_1.RuntimeError(`Failed to execute command: ${err.message}`, "exec", err));
            });
        });
        const duration = exitCode.then(() => performance.now() - startTime);
        // Avoid unhandled promise rejections in fire-and-forget exec() callsites.
        // Callers that await these promises will still observe the rejection.
        void exitCode.catch(() => undefined);
        void duration.catch(() => undefined);
        // Register process group cleanup with DisposableProcess
        // This ensures ALL background children are killed when process exits
        disposable.addCleanup(() => {
            if (childProcess.pid === undefined)
                return;
            // Kill the full process tree (see comment in exit handler).
            (0, disposableExec_1.killProcessTree)(childProcess.pid);
        });
        // Handle abort signal
        if (options.abortSignal) {
            options.abortSignal.addEventListener("abort", () => {
                aborted = true;
                disposable[Symbol.dispose](); // Kill process and run cleanup
            });
        }
        // Handle timeout
        if (options.timeout !== undefined) {
            const timeoutHandle = setTimeout(() => {
                timedOut = true;
                disposable[Symbol.dispose](); // Kill process and run cleanup
            }, options.timeout * 1000);
            // Clear timeout if process exits naturally
            void exitCode.catch(() => undefined).finally(() => clearTimeout(timeoutHandle));
        }
        return { stdout, stderr, stdin, exitCode, duration };
    }
    readFile(filePath, _abortSignal) {
        // Note: _abortSignal ignored for local operations (fast, no need for cancellation)
        // Expand tildes before reading (Node.js fs doesn't expand ~)
        const expandedPath = (0, tildeExpansion_1.expandTilde)(filePath);
        const nodeStream = fs.createReadStream(expandedPath);
        // Handle errors by wrapping in a transform
        const webStream = stream_1.Readable.toWeb(nodeStream);
        return new ReadableStream({
            async start(controller) {
                try {
                    const reader = webStream.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        controller.enqueue(value);
                    }
                    controller.close();
                }
                catch (err) {
                    controller.error(new Runtime_1.RuntimeError(`Failed to read file ${filePath}: ${err instanceof Error ? err.message : String(err)}`, "file_io", err instanceof Error ? err : undefined));
                }
            },
        });
    }
    writeFile(filePath, _abortSignal) {
        // Note: _abortSignal ignored for local operations (fast, no need for cancellation)
        // Expand tildes before writing (Node.js fs doesn't expand ~)
        const expandedPath = (0, tildeExpansion_1.expandTilde)(filePath);
        let tempPath;
        let writer;
        let resolvedPath;
        let originalMode;
        return new WritableStream({
            async start() {
                // Resolve symlinks to write through them (preserves the symlink)
                try {
                    resolvedPath = await fsPromises.realpath(expandedPath);
                    // Save original permissions to restore after write
                    const stat = await fsPromises.stat(resolvedPath);
                    originalMode = stat.mode;
                }
                catch {
                    // If file doesn't exist, use the expanded path and default permissions
                    resolvedPath = expandedPath;
                    originalMode = undefined;
                }
                // Create parent directories if they don't exist
                const parentDir = path.dirname(resolvedPath);
                await fsPromises.mkdir(parentDir, { recursive: true });
                // Create temp file for atomic write
                tempPath = `${resolvedPath}.tmp.${Date.now()}`;
                const nodeStream = fs.createWriteStream(tempPath);
                const webStream = stream_1.Writable.toWeb(nodeStream);
                writer = webStream.getWriter();
            },
            async write(chunk) {
                await writer.write(chunk);
            },
            async close() {
                // Close the writer and rename to final location
                await writer.close();
                try {
                    // If we have original permissions, apply them to temp file before rename
                    if (originalMode !== undefined) {
                        await fsPromises.chmod(tempPath, originalMode);
                    }
                    await fsPromises.rename(tempPath, resolvedPath);
                }
                catch (err) {
                    throw new Runtime_1.RuntimeError(`Failed to write file ${filePath}: ${err instanceof Error ? err.message : String(err)}`, "file_io", err instanceof Error ? err : undefined);
                }
            },
            async abort(reason) {
                // Clean up temp file on abort
                await writer.abort();
                try {
                    await fsPromises.unlink(tempPath);
                }
                catch {
                    // Ignore errors cleaning up temp file
                }
                throw new Runtime_1.RuntimeError(`Failed to write file ${filePath}: ${String(reason)}`, "file_io");
            },
        });
    }
    async stat(filePath, _abortSignal) {
        // Note: _abortSignal ignored for local operations (fast, no need for cancellation)
        // Expand tildes before stat (Node.js fs doesn't expand ~)
        const expandedPath = (0, tildeExpansion_1.expandTilde)(filePath);
        try {
            const stats = await fsPromises.stat(expandedPath);
            return {
                size: stats.size,
                modifiedTime: stats.mtime,
                isDirectory: stats.isDirectory(),
            };
        }
        catch (err) {
            throw new Runtime_1.RuntimeError(`Failed to stat ${filePath}: ${err instanceof Error ? err.message : String(err)}`, "file_io", err instanceof Error ? err : undefined);
        }
    }
    async ensureDir(dirPath) {
        const expandedPath = (0, tildeExpansion_1.expandTilde)(dirPath);
        try {
            await fsPromises.mkdir(expandedPath, { recursive: true });
        }
        catch (err) {
            throw new Runtime_1.RuntimeError(`Failed to create directory ${dirPath}: ${err instanceof Error ? err.message : String(err)}`, "file_io", err instanceof Error ? err : undefined);
        }
    }
    resolvePath(filePath) {
        // Expand tilde to actual home directory path
        const expanded = (0, tildeExpansion_1.expandTilde)(filePath);
        // Resolve to absolute path (handles relative paths like "./foo")
        return Promise.resolve(path.resolve(expanded));
    }
    normalizePath(targetPath, basePath) {
        // For local runtime, use Node.js path resolution
        // Handle special case: current directory
        const target = targetPath.trim();
        if (target === ".") {
            return path.resolve(basePath);
        }
        // Expand tildes before resolving (~ is not expanded by path.resolve)
        const expanded = (0, tildeExpansion_1.expandTilde)(target);
        return path.resolve(basePath, expanded);
    }
    /**
     * Get the runtime's temp directory.
     * Uses OS temp dir on local systems.
     */
    tempDir() {
        // Use /tmp on Unix, or OS temp dir on Windows
        const isWindows = process.platform === "win32";
        return Promise.resolve(isWindows ? (process.env.TEMP ?? "C:\\Temp") : "/tmp");
    }
    getUnixHome() {
        return "~/.unix";
    }
    /**
     * Local runtimes are always ready.
     */
    ensureReady() {
        return Promise.resolve({ ready: true });
    }
    /**
     * Helper to run .unix/init hook if it exists and is executable.
     * Shared between WorktreeRuntime and LocalRuntime.
     * @param workspacePath - Path to the workspace directory
     * @param muxEnv - UNIX_ environment variables (from getUnixEnv)
     * @param initLogger - Logger for streaming output
     */
    async runInitHook(workspacePath, muxEnv, initLogger) {
        // Hook path is derived from UNIX_PROJECT_PATH in muxEnv
        const projectPath = muxEnv.UNIX_PROJECT_PATH;
        const hookPath = (0, initHook_1.getInitHookPath)(projectPath);
        initLogger.logStep(`Running init hook: ${hookPath}`);
        // Create line-buffered loggers
        const loggers = (0, initHook_1.createLineBufferedLoggers)(initLogger);
        return new Promise((resolve) => {
            const bashPath = (0, bashPath_1.getBashPath)();
            const proc = (0, child_process_1.spawn)(bashPath, ["-c", `"${hookPath}"`], {
                cwd: workspacePath,
                stdio: ["ignore", "pipe", "pipe"],
                env: {
                    ...process.env,
                    ...muxEnv,
                },
                // Prevent console window from appearing on Windows
                windowsHide: true,
            });
            proc.stdout.on("data", (data) => {
                loggers.stdout.append(data.toString());
            });
            proc.stderr.on("data", (data) => {
                loggers.stderr.append(data.toString());
            });
            proc.on("close", (code) => {
                // Flush any remaining buffered output
                loggers.stdout.flush();
                loggers.stderr.flush();
                initLogger.logComplete(code ?? 0);
                resolve();
            });
            proc.on("error", (err) => {
                initLogger.logStderr(`Error running init hook: ${err.message}`);
                initLogger.logComplete(-1);
                resolve();
            });
        });
    }
}
exports.LocalBaseRuntime = LocalBaseRuntime;
//# sourceMappingURL=LocalBaseRuntime.js.map