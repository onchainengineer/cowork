"use strict";
/**
 * Unified executor for background bash processes.
 *
 * ALL bash commands are spawned through this executor with background-style
 * infrastructure (nohup, file output, exit code trap). This enables:
 *
 * 1. Uniform code path - one spawn mechanism for all bash commands
 * 2. Crash resilience - output always persisted to files
 * 3. Seamless fg→bg transition - "background this" = "stop waiting"
 *
 * Uses runtime.tempDir() for runtime-agnostic temp directory resolution.
 * Works identically for local and SSH runtimes.
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
exports.EXIT_CODE_FILENAME = exports.OUTPUT_FILENAME = exports.BG_OUTPUT_SUBDIR = void 0;
exports.computeOutputPaths = computeOutputPaths;
exports.spawnProcess = spawnProcess;
exports.migrateToBackground = migrateToBackground;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const log_1 = require("./log");
const backgroundCommands_1 = require("../../node/runtime/backgroundCommands");
const helpers_1 = require("../../node/utils/runtime/helpers");
const env_1 = require("../../common/constants/env");
const paths_1 = require("../../node/utils/paths");
/**
 * Quote a path for shell commands.
 * On Windows, first converts to POSIX format, then shell-quotes.
 * On Unix, just shell-quotes (handles spaces, special chars).
 */
function quotePathForShell(p) {
    const posixPath = (0, paths_1.toPosixPath)(p);
    return (0, backgroundCommands_1.shellQuote)(posixPath);
}
/**
 * Safe fallback cwd for runtime.exec() calls that don't need a specific workspace cwd.
 *
 * NOTE: Local runtimes validate that cwd exists before spawning, so this must be a real directory.
 */
const FALLBACK_CWD = process.platform === "win32" ? (process.env.TEMP ?? "C:\\") : "/tmp";
/** Helper to extract error message for logging */
function errorMsg(error) {
    return error instanceof Error ? error.message : String(error);
}
/** Subdirectory under temp for background process output */
exports.BG_OUTPUT_SUBDIR = "unix-bashes";
/** Output filename for combined stdout/stderr */
exports.OUTPUT_FILENAME = "output.log";
/** Exit code filename */
exports.EXIT_CODE_FILENAME = "exit_code";
/**
 * Compute paths for a background process output directory.
 * @param bgOutputDir Base directory (e.g., /tmp/unix-bashes or ~/.unix/sessions)
 * @param workspaceId Workspace identifier
 * @param processId Process identifier
 */
function computeOutputPaths(bgOutputDir, workspaceId, processId) {
    const outputDir = `${bgOutputDir}/${workspaceId}/${processId}`;
    return {
        outputDir,
        outputPath: `${outputDir}/${exports.OUTPUT_FILENAME}`,
        exitCodePath: `${outputDir}/${exports.EXIT_CODE_FILENAME}`,
    };
}
/**
 * Spawn a background process using runtime.exec (works for both local and SSH).
 *
 * All processes get the same infrastructure:
 * - nohup/setsid for process isolation
 * - stdout/stderr merged into single output.log with 2>&1
 * - Exit code captured via bash trap
 *
 * Uses runtime.tempDir() for output directory, making the code runtime-agnostic.
 *
 * @param runtime Runtime to spawn on
 * @param script Script to execute
 * @param options Spawn options
 */
async function spawnProcess(runtime, script, options) {
    log_1.log.debug(`BackgroundProcessExecutor.spawnProcess: Spawning in ${options.cwd}`);
    // Get temp directory from runtime (absolute path, runtime-agnostic)
    const tempDir = await runtime.tempDir();
    const bgOutputDir = `${tempDir}/${exports.BG_OUTPUT_SUBDIR}`;
    // Use shell-safe quoting for paths (handles spaces, special chars)
    const quotePath = quotePathForShell;
    // Verify working directory exists
    const cwdCheck = await (0, helpers_1.execBuffered)(runtime, `cd ${quotePath(options.cwd)}`, {
        cwd: FALLBACK_CWD,
        timeout: 10,
    });
    if (cwdCheck.exitCode !== 0) {
        return { success: false, error: `Working directory does not exist: ${options.cwd}` };
    }
    // Compute output paths (unified output.log instead of separate stdout/stderr)
    const { outputDir, outputPath, exitCodePath } = computeOutputPaths(bgOutputDir, options.workspaceId, options.processId);
    // Create output directory and empty file
    try {
        await runtime.ensureDir(outputDir);
        await (0, helpers_1.writeFileString)(runtime, outputPath, "");
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to create output directory: ${errorMsg(error)}`,
        };
    }
    // Build wrapper script (same for all runtimes now that paths are absolute)
    // Note: buildWrapperScript handles quoting internally via shellQuote
    const wrapperScript = (0, backgroundCommands_1.buildWrapperScript)({
        exitCodePath,
        cwd: options.cwd,
        env: { ...options.env, ...env_1.NON_INTERACTIVE_ENV_VARS },
        script,
    });
    const spawnCommand = (0, backgroundCommands_1.buildSpawnCommand)({
        wrapperScript,
        outputPath,
        quotePath,
    });
    try {
        // No timeout - the spawn command backgrounds the process and returns immediately
        const result = await (0, helpers_1.execBuffered)(runtime, spawnCommand, {
            cwd: FALLBACK_CWD,
        });
        if (result.exitCode !== 0) {
            log_1.log.debug(`BackgroundProcessExecutor.spawnProcess: spawn command failed: ${result.stderr}`);
            return {
                success: false,
                error: `Failed to spawn background process: ${result.stderr}`,
            };
        }
        const pid = (0, backgroundCommands_1.parsePid)(result.stdout);
        if (!pid) {
            log_1.log.debug(`BackgroundProcessExecutor.spawnProcess: Invalid PID: ${result.stdout}`);
            return {
                success: false,
                error: `Failed to get valid PID from spawn: ${result.stdout}`,
            };
        }
        log_1.log.debug(`BackgroundProcessExecutor.spawnProcess: Spawned with PID ${pid}`);
        const handle = new RuntimeBackgroundHandle(runtime, pid, outputDir, quotePath);
        return { success: true, handle, pid, outputDir };
    }
    catch (error) {
        const errorMessage = errorMsg(error);
        log_1.log.debug(`BackgroundProcessExecutor.spawnProcess: Error: ${errorMessage}`);
        return {
            success: false,
            error: `Failed to spawn background process: ${errorMessage}`,
        };
    }
}
/**
 * Unified handle to a background process.
 * Uses runtime.exec for all operations, working identically for local and SSH.
 *
 * Output files (output.log, exit_code) are on the runtime's filesystem.
 * This handle provides lifecycle management via execBuffered commands.
 */
class RuntimeBackgroundHandle {
    runtime;
    pid;
    outputDir;
    quotePath;
    terminated = false;
    constructor(runtime, pid, outputDir, quotePath) {
        this.runtime = runtime;
        this.pid = pid;
        this.outputDir = outputDir;
        this.quotePath = quotePath;
    }
    /**
     * Get the exit code from the exit_code file.
     * Returns null if process is still running (file doesn't exist yet).
     */
    async getExitCode() {
        try {
            const exitCodePath = this.quotePath(`${this.outputDir}/${exports.EXIT_CODE_FILENAME}`);
            const result = await (0, helpers_1.execBuffered)(this.runtime, `cat ${exitCodePath} 2>/dev/null || echo ""`, { cwd: FALLBACK_CWD, timeout: 10 });
            return (0, backgroundCommands_1.parseExitCode)(result.stdout);
        }
        catch (error) {
            log_1.log.debug(`RuntimeBackgroundHandle.getExitCode: Error: ${errorMsg(error)}`);
            return null;
        }
    }
    /**
     * Terminate the process group.
     * Sends SIGTERM to process group, waits briefly, then SIGKILL if still running.
     */
    async terminate() {
        if (this.terminated)
            return;
        try {
            const exitCodePath = `${this.outputDir}/${exports.EXIT_CODE_FILENAME}`;
            const terminateCmd = (0, backgroundCommands_1.buildTerminateCommand)(this.pid, exitCodePath, this.quotePath);
            await (0, helpers_1.execBuffered)(this.runtime, terminateCmd, {
                cwd: FALLBACK_CWD,
                timeout: 15,
            });
            log_1.log.debug(`RuntimeBackgroundHandle: Terminated process group ${this.pid}`);
        }
        catch (error) {
            // Process may already be dead - that's fine
            log_1.log.debug(`RuntimeBackgroundHandle.terminate: Error: ${errorMsg(error)}`);
        }
        this.terminated = true;
    }
    /**
     * Clean up resources.
     * No resources to clean - process runs independently via nohup.
     */
    async dispose() {
        // No resources to clean up
    }
    /**
     * Write meta.json to the output directory.
     */
    async writeMeta(metaJson) {
        try {
            const metaPath = this.quotePath(`${this.outputDir}/meta.json`);
            await (0, helpers_1.execBuffered)(this.runtime, `cat > ${metaPath} << 'METAEOF'\n${metaJson}\nMETAEOF`, {
                cwd: FALLBACK_CWD,
                timeout: 10,
            });
        }
        catch (error) {
            log_1.log.debug(`RuntimeBackgroundHandle.writeMeta: Error: ${errorMsg(error)}`);
        }
    }
    async getOutputFileSize() {
        try {
            const filePath = this.quotePath(`${this.outputDir}/${exports.OUTPUT_FILENAME}`);
            const sizeResult = await (0, helpers_1.execBuffered)(this.runtime, `wc -c < ${filePath} 2>/dev/null || echo 0`, { cwd: FALLBACK_CWD, timeout: 10 });
            return parseInt(sizeResult.stdout.trim(), 10) || 0;
        }
        catch (error) {
            log_1.log.debug(`RuntimeBackgroundHandle.getOutputFileSize: Error: ${errorMsg(error)}`);
            return 0;
        }
    }
    /**
     * Read output from output.log at the given byte offset.
     * Uses tail -c to read from offset - works on both Linux and macOS.
     */
    async readOutput(offset) {
        try {
            const filePath = this.quotePath(`${this.outputDir}/${exports.OUTPUT_FILENAME}`);
            const fileSize = await this.getOutputFileSize();
            if (offset >= fileSize) {
                return { content: "", newOffset: offset };
            }
            // Read from offset to end of file using tail -c (faster than dd bs=1)
            // tail -c +N means "start at byte N" (1-indexed)
            const readResult = await (0, helpers_1.execBuffered)(this.runtime, `tail -c +${offset + 1} ${filePath} 2>/dev/null`, { cwd: FALLBACK_CWD, timeout: 30 });
            return {
                content: readResult.stdout,
                newOffset: offset + Buffer.byteLength(readResult.stdout),
            };
        }
        catch (error) {
            log_1.log.debug(`RuntimeBackgroundHandle.readOutput: Error: ${errorMsg(error)}`);
            return { content: "", newOffset: offset };
        }
    }
}
/**
 * Migrate a foreground process to background tracking.
 *
 * This is called when user clicks "Background" on a running foreground process.
 * The process continues running, but we:
 * 1. Create output directory and write existing output
 * 2. Continue consuming streams and writing to unified output.log
 * 3. Track exit code when process completes
 * 4. Return a BackgroundHandle for the manager to track
 *
 * Note: Output files are written locally (not via runtime), so this works
 * for SSH runtime where streams are already being piped to the local machine.
 *
 * @param execStream The running process's streams
 * @param options Migration options
 * @param bgOutputDir Base directory for output files
 */
async function migrateToBackground(execStream, options, bgOutputDir) {
    // Use shared path computation (path.join for local filesystem)
    const { outputDir, outputPath } = computeOutputPaths(bgOutputDir, options.workspaceId, options.processId);
    try {
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        // Write existing output to unified output.log
        await fs.writeFile(outputPath, options.existingOutput.join("\n") + "\n");
        // Create handle that will continue writing to file
        const handle = new MigratedBackgroundHandle(execStream, outputDir, outputPath);
        // Start consuming remaining output in background
        handle.startConsuming();
        return { success: true, handle, outputDir };
    }
    catch (error) {
        const errorMessage = errorMsg(error);
        log_1.log.debug(`migrateToBackground: Error: ${errorMessage}`);
        return { success: false, error: `Failed to migrate process: ${errorMessage}` };
    }
}
/**
 * Handle for a migrated foreground process.
 *
 * Unlike RuntimeBackgroundHandle which uses runtime.exec for file operations,
 * this handle uses local filesystem directly because the streams are already
 * being piped to the local machine (even for SSH runtime).
 *
 * Both stdout and stderr are written to a unified output.log file.
 */
class MigratedBackgroundHandle {
    execStream;
    outputDir;
    outputPath;
    exitCodeValue = null;
    consuming = false;
    outputFd = null;
    constructor(execStream, outputDir, outputPath) {
        this.execStream = execStream;
        this.outputDir = outputDir;
        this.outputPath = outputPath;
    }
    /**
     * Start consuming remaining output from streams and writing to unified file.
     * Called after handle is created to begin background file writing.
     */
    startConsuming() {
        if (this.consuming)
            return;
        this.consuming = true;
        // Open output file once, consume both streams to it
        void this.consumeStreams();
        // Track exit code
        void this.execStream.exitCode.then((code) => {
            this.exitCodeValue = code;
            // Write exit code to file
            void this.writeExitCode(code);
        });
    }
    /**
     * Consume both stdout and stderr streams and append to unified output file.
     */
    async consumeStreams() {
        try {
            this.outputFd = await fs.open(this.outputPath, "a");
            // Consume both streams concurrently, both writing to same file
            await Promise.all([
                this.consumeStream(this.execStream.stdout),
                this.consumeStream(this.execStream.stderr),
            ]);
        }
        catch (error) {
            log_1.log.debug(`MigratedBackgroundHandle.consumeStreams: ${errorMsg(error)}`);
        }
        finally {
            if (this.outputFd) {
                await this.outputFd.close();
                this.outputFd = null;
            }
        }
    }
    /**
     * Consume a stream and append to the shared output file.
     */
    async consumeStream(stream) {
        try {
            const reader = stream.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    if (value && this.outputFd) {
                        await this.outputFd.write(value);
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
        }
        catch (error) {
            // Stream may have been cancelled or process killed - that's fine
            log_1.log.debug(`MigratedBackgroundHandle.consumeStream: ${errorMsg(error)}`);
        }
    }
    /**
     * Write exit code to file.
     */
    async writeExitCode(code) {
        try {
            const exitCodePath = path.join(this.outputDir, exports.EXIT_CODE_FILENAME);
            await fs.writeFile(exitCodePath, String(code));
        }
        catch (error) {
            log_1.log.debug(`MigratedBackgroundHandle.writeExitCode: ${errorMsg(error)}`);
        }
    }
    getExitCode() {
        return Promise.resolve(this.exitCodeValue);
    }
    async terminate() {
        // ExecStream doesn't expose a kill method directly
        // Cancel the streams to stop reading (process continues but we stop tracking)
        try {
            await this.execStream.stdout.cancel();
            await this.execStream.stderr.cancel();
        }
        catch {
            // Streams may already be closed
        }
    }
    async dispose() {
        // Close any open file handles
        await this.outputFd?.close().catch(() => {
            /* ignore */
        });
    }
    async getOutputFileSize() {
        try {
            const stat = await fs.stat(this.outputPath);
            return stat.size;
        }
        catch (error) {
            log_1.log.debug(`MigratedBackgroundHandle.getOutputFileSize: ${errorMsg(error)}`);
            return 0;
        }
    }
    async writeMeta(metaJson) {
        try {
            const metaPath = path.join(this.outputDir, "meta.json");
            await fs.writeFile(metaPath, metaJson);
        }
        catch (error) {
            log_1.log.debug(`MigratedBackgroundHandle.writeMeta: ${errorMsg(error)}`);
        }
    }
    async readOutput(offset) {
        try {
            const fileSize = await this.getOutputFileSize();
            if (offset >= fileSize) {
                return { content: "", newOffset: offset };
            }
            // Read from offset to end
            const fd = await fs.open(this.outputPath, "r");
            try {
                const buffer = Buffer.alloc(fileSize - offset);
                const { bytesRead } = await fd.read(buffer, 0, buffer.length, offset);
                return {
                    content: buffer.slice(0, bytesRead).toString("utf-8"),
                    newOffset: offset + bytesRead,
                };
            }
            finally {
                await fd.close();
            }
        }
        catch (error) {
            log_1.log.debug(`MigratedBackgroundHandle.readOutput: ${errorMsg(error)}`);
            return { content: "", newOffset: offset };
        }
    }
}
//# sourceMappingURL=backgroundProcessExecutor.js.map