"use strict";
/**
 * Abstract base class for remote execution runtimes (SSH, Docker).
 *
 * Provides shared implementation for:
 * - exec() with streaming I/O, timeout/abort handling
 * - readFile(), writeFile(), stat() via exec
 * - normalizePath() for POSIX paths
 * - tempDir() returning /tmp
 *
 * Subclasses implement:
 * - spawnRemoteProcess() - how to spawn the external process (ssh/docker)
 * - getBasePath() - base directory for workspace operations
 * - quoteForRemote() - path quoting strategy
 * - onExitCode() - optional exit code handling (SSH connection pool)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteRuntime = void 0;
const stream_1 = require("stream");
const Runtime_1 = require("./Runtime");
const exitCodes_1 = require("../../common/constants/exitCodes");
const log_1 = require("../../node/services/log");
const streamErrors_1 = require("../../node/utils/streamErrors");
const env_1 = require("../../common/constants/env");
const disposableExec_1 = require("../../node/utils/disposableExec");
const streamUtils_1 = require("./streamUtils");
/**
 * Abstract base class for remote execution runtimes.
 */
class RemoteRuntime {
    /**
     * Called when exec completes with an exit code.
     * Subclasses can use this for connection pool health tracking.
     * @param stderr - Captured stderr for error reporting (e.g., SSH connection failures)
     */
    onExitCode(_exitCode, _options, _stderr) {
        // Default: no-op. SSH overrides to report to connection pool.
    }
    /**
     * Execute command with streaming I/O.
     * Shared implementation that delegates process spawning to subclass.
     */
    async exec(command, options) {
        const startTime = performance.now();
        // Short-circuit if already aborted
        if (options.abortSignal?.aborted) {
            throw new Runtime_1.RuntimeError("Operation aborted before execution", "exec");
        }
        // Build command parts
        const parts = [];
        // Add cd command
        parts.push(this.cdCommand(options.cwd));
        // Add environment variable exports (user env first, then non-interactive overrides)
        const envVars = { ...options.env, ...env_1.NON_INTERACTIVE_ENV_VARS };
        for (const [key, value] of Object.entries(envVars)) {
            parts.push(`export ${key}=${streamUtils_1.shescape.quote(value)}`);
        }
        // Add the actual command
        parts.push(command);
        // Join all parts with && to ensure each step succeeds before continuing
        let fullCommand = parts.join(" && ");
        // Wrap in bash for consistent shell behavior
        fullCommand = `bash -c ${streamUtils_1.shescape.quote(fullCommand)}`;
        // Optionally wrap with timeout
        if (options.timeout !== undefined) {
            const remoteTimeout = Math.ceil(options.timeout) + 1;
            fullCommand = `timeout -s KILL ${remoteTimeout} ${fullCommand}`;
        }
        // Spawn the remote process (SSH or Docker)
        // For SSH, this awaits connection pool backoff before spawning
        const { process: childProcess } = await this.spawnRemoteProcess(fullCommand, options);
        // Short-lived commands can close stdin before writes/close complete.
        if (childProcess.stdin) {
            (0, streamErrors_1.attachStreamErrorHandler)(childProcess.stdin, `${this.commandPrefix} stdin`, {
                logger: log_1.log,
            });
        }
        // Wrap in DisposableProcess for cleanup
        const disposable = new disposableExec_1.DisposableProcess(childProcess);
        // Track if we killed the process due to timeout or abort
        let timedOut = false;
        let aborted = false;
        // Declared here so it's captured by the exitCode promise closure,
        // but the data listener is added AFTER Readable.toWeb() to avoid
        // putting the stream in flowing mode prematurely.
        let stderrForErrorReporting = "";
        // Create promises for exit code and duration immediately.
        const exitCode = new Promise((resolve, reject) => {
            childProcess.on("close", (code, signal) => {
                if (aborted || options.abortSignal?.aborted) {
                    resolve(exitCodes_1.EXIT_CODE_ABORTED);
                    return;
                }
                if (timedOut) {
                    resolve(exitCodes_1.EXIT_CODE_TIMEOUT);
                    return;
                }
                const finalExitCode = code ?? (signal ? -1 : 0);
                // Let subclass handle exit code (e.g., SSH connection pool)
                this.onExitCode(finalExitCode, options, stderrForErrorReporting);
                resolve(finalExitCode);
            });
            childProcess.on("error", (err) => {
                reject(new Runtime_1.RuntimeError(`Failed to execute ${this.commandPrefix} command: ${err.message}`, "exec", err));
            });
        });
        const duration = exitCode.then(() => performance.now() - startTime);
        // Handle abort signal
        if (options.abortSignal) {
            options.abortSignal.addEventListener("abort", () => {
                aborted = true;
                disposable[Symbol.dispose]();
            });
        }
        // Handle timeout
        if (options.timeout !== undefined) {
            const timeoutHandle = setTimeout(() => {
                timedOut = true;
                disposable[Symbol.dispose]();
            }, options.timeout * 1000);
            void exitCode.finally(() => clearTimeout(timeoutHandle));
        }
        // Convert Node.js streams to Web Streams
        const stdout = stream_1.Readable.toWeb(childProcess.stdout);
        const stderr = stream_1.Readable.toWeb(childProcess.stderr);
        // Capture stderr for error reporting (e.g., SSH exit code 255 failures).
        // Must be AFTER Readable.toWeb() to avoid putting the stream in flowing mode prematurely.
        childProcess.stderr?.on("data", (data) => {
            stderrForErrorReporting += data.toString();
        });
        // Writable.toWeb(childProcess.stdin) is surprisingly easy to get into an invalid state
        // for short-lived remote commands (notably via SSH) where stdin may already be closed
        // by the time callers attempt `await stream.stdin.close()`.
        //
        // Wrap stdin ourselves so close() is idempotent.
        const stdin = new WritableStream({
            write: async (chunk) => {
                const nodeStdin = childProcess.stdin;
                if (!nodeStdin || nodeStdin.destroyed) {
                    return;
                }
                await new Promise((resolve, reject) => {
                    const onError = (err) => {
                        nodeStdin.off("error", onError);
                        reject(err);
                    };
                    nodeStdin.on("error", onError);
                    nodeStdin.write(Buffer.from(chunk), (err) => {
                        nodeStdin.off("error", onError);
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });
            },
            close: async () => {
                const nodeStdin = childProcess.stdin;
                if (!nodeStdin || nodeStdin.destroyed || nodeStdin.writableEnded) {
                    return;
                }
                await new Promise((resolve) => {
                    const onError = () => {
                        cleanup();
                        resolve();
                    };
                    const onFinish = () => {
                        cleanup();
                        resolve();
                    };
                    const cleanup = () => {
                        nodeStdin.removeListener("error", onError);
                        nodeStdin.removeListener("finish", onFinish);
                    };
                    nodeStdin.once("error", onError);
                    nodeStdin.once("finish", onFinish);
                    try {
                        nodeStdin.end();
                    }
                    catch {
                        onError();
                    }
                });
            },
            abort: () => {
                childProcess.stdin?.destroy();
            },
        });
        log_1.log.debug(`${this.commandPrefix} command: ${fullCommand}`);
        return { stdout, stderr, stdin, exitCode, duration };
    }
    /**
     * Read file contents as a stream via exec.
     */
    readFile(filePath, abortSignal) {
        return new ReadableStream({
            start: async (controller) => {
                try {
                    const stream = await this.exec(`cat ${this.quoteForRemote(filePath)}`, {
                        cwd: this.getBasePath(),
                        timeout: 300,
                        abortSignal,
                    });
                    const reader = stream.stdout.getReader();
                    const exitCodePromise = stream.exitCode;
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        controller.enqueue(value);
                    }
                    const code = await exitCodePromise;
                    if (code !== 0) {
                        const stderr = await (0, streamUtils_1.streamToString)(stream.stderr);
                        throw new Runtime_1.RuntimeError(`Failed to read file ${filePath}: ${stderr}`, "file_io");
                    }
                    controller.close();
                }
                catch (err) {
                    if (err instanceof Runtime_1.RuntimeError) {
                        controller.error(err);
                    }
                    else {
                        controller.error(new Runtime_1.RuntimeError(`Failed to read file ${filePath}: ${err instanceof Error ? err.message : String(err)}`, "file_io", err instanceof Error ? err : undefined));
                    }
                }
            },
        });
    }
    /**
     * Write file contents atomically via exec.
     * Uses temp file + mv for atomic write.
     */
    writeFile(filePath, abortSignal) {
        const quotedPath = this.quoteForRemote(filePath);
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        const quotedTempPath = this.quoteForRemote(tempPath);
        // Build write command - subclasses can override buildWriteCommand for special handling
        const writeCommand = this.buildWriteCommand(quotedPath, quotedTempPath);
        let execPromise = null;
        const getExecStream = () => {
            execPromise ?? (execPromise = this.exec(writeCommand, {
                cwd: this.getBasePath(),
                timeout: 300,
                abortSignal,
            }));
            return execPromise;
        };
        return new WritableStream({
            write: async (chunk) => {
                const stream = await getExecStream();
                const writer = stream.stdin.getWriter();
                try {
                    await writer.write(chunk);
                }
                finally {
                    writer.releaseLock();
                }
            },
            close: async () => {
                const stream = await getExecStream();
                await stream.stdin.close();
                const exitCode = await stream.exitCode;
                if (exitCode !== 0) {
                    const stderr = await (0, streamUtils_1.streamToString)(stream.stderr);
                    throw new Runtime_1.RuntimeError(`Failed to write file ${filePath}: ${stderr}`, "file_io");
                }
            },
            abort: async (reason) => {
                const stream = await getExecStream();
                await stream.stdin.abort();
                throw new Runtime_1.RuntimeError(`Failed to write file ${filePath}: ${String(reason)}`, "file_io");
            },
        });
    }
    /**
     * Build the write command for atomic file writes.
     * Can be overridden by subclasses for special handling (e.g., SSH symlink preservation).
     */
    buildWriteCommand(quotedPath, quotedTempPath) {
        return `mkdir -p $(dirname ${quotedPath}) && cat > ${quotedTempPath} && mv ${quotedTempPath} ${quotedPath}`;
    }
    /**
     * Ensure a directory exists (mkdir -p semantics).
     */
    async ensureDir(dirPath) {
        const stream = await this.exec(`mkdir -p ${this.quoteForRemote(dirPath)}`, {
            cwd: "/",
            timeout: 10,
        });
        await stream.stdin.close();
        const [stdout, stderr, exitCode] = await Promise.all([
            (0, streamUtils_1.streamToString)(stream.stdout),
            (0, streamUtils_1.streamToString)(stream.stderr),
            stream.exitCode,
        ]);
        if (exitCode !== 0) {
            const extra = stderr.trim() || stdout.trim();
            throw new Runtime_1.RuntimeError(`Failed to create directory ${dirPath}: exit code ${exitCode}${extra ? `: ${extra}` : ""}`, "file_io");
        }
    }
    /**
     * Get file statistics via exec.
     */
    async stat(filePath, abortSignal) {
        const stream = await this.exec(`stat -c '%s %Y %F' ${this.quoteForRemote(filePath)}`, {
            cwd: this.getBasePath(),
            timeout: 10,
            abortSignal,
        });
        const [stdout, stderr, exitCode] = await Promise.all([
            (0, streamUtils_1.streamToString)(stream.stdout),
            (0, streamUtils_1.streamToString)(stream.stderr),
            stream.exitCode,
        ]);
        if (exitCode !== 0) {
            throw new Runtime_1.RuntimeError(`Failed to stat ${filePath}: ${stderr}`, "file_io");
        }
        const parts = stdout.trim().split(" ");
        if (parts.length < 3) {
            throw new Runtime_1.RuntimeError(`Failed to parse stat output for ${filePath}: ${stdout}`, "file_io");
        }
        const size = parseInt(parts[0], 10);
        const mtime = parseInt(parts[1], 10);
        const fileType = parts.slice(2).join(" ");
        return {
            size,
            modifiedTime: new Date(mtime * 1000),
            isDirectory: fileType === "directory",
        };
    }
    /**
     * Normalize path for comparison (POSIX semantics).
     * Shared between SSH and Docker.
     */
    normalizePath(targetPath, basePath) {
        const target = targetPath.trim();
        let base = basePath.trim();
        // Normalize base path - remove trailing slash (except for root "/")
        if (base.length > 1 && base.endsWith("/")) {
            base = base.slice(0, -1);
        }
        // Handle special case: current directory
        if (target === ".") {
            return base;
        }
        // Handle absolute paths and tilde
        if (target.startsWith("/") || target === "~" || target.startsWith("~/")) {
            let normalizedTarget = target;
            // Remove trailing slash for comparison (except for root "/")
            if (normalizedTarget.length > 1 && normalizedTarget.endsWith("/")) {
                normalizedTarget = normalizedTarget.slice(0, -1);
            }
            return normalizedTarget;
        }
        // Relative path - resolve against base
        const normalizedTarget = base.endsWith("/") ? base + target : base + "/" + target;
        // Remove trailing slash
        if (normalizedTarget.length > 1 && normalizedTarget.endsWith("/")) {
            return normalizedTarget.slice(0, -1);
        }
        return normalizedTarget;
    }
    /**
     * Return /tmp as the temp directory for remote runtimes.
     */
    tempDir() {
        return Promise.resolve("/tmp");
    }
    getUnixHome() {
        return "~/.unix";
    }
    // Abstract methods that subclasses must implement
    /**
     * Remote runtimes are always ready (SSH connections are re-established as needed).
     * Subclasses (LatticeSSHRuntime, DockerRuntime) may override for provisioning checks.
     */
    ensureReady() {
        return Promise.resolve({ ready: true });
    }
}
exports.RemoteRuntime = RemoteRuntime;
//# sourceMappingURL=RemoteRuntime.js.map