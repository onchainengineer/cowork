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
exports.LineBuffer = void 0;
exports.checkInitHookExists = checkInitHookExists;
exports.getInitHookPath = getInitHookPath;
exports.getUnixEnv = getUnixEnv;
exports.getRuntimeType = getRuntimeType;
exports.createLineBufferedLoggers = createLineBufferedLoggers;
exports.runInitHookOnRuntime = runInitHookOnRuntime;
const fs = __importStar(require("fs"));
const fsPromises = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const runtime_1 = require("../../common/types/runtime");
/**
 * Check if .unix/init hook exists and is executable
 * @param projectPath - Path to the project root
 * @returns true if hook exists and is executable, false otherwise
 */
async function checkInitHookExists(projectPath) {
    const hookPath = path.join(projectPath, ".unix", "init");
    try {
        await fsPromises.access(hookPath, fs.constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get the init hook path for a project
 */
function getInitHookPath(projectPath) {
    return path.join(projectPath, ".unix", "init");
}
/**
 * Get UNIX_ environment variables for bash execution.
 * Used by both init hook and regular bash tool calls.
 * @param projectPath - Path to project root (local path for LocalRuntime, remote path for SSHRuntime)
 * @param runtime - Runtime type: "local", "worktree", "ssh", or "docker"
 * @param workspaceName - Name of the workspace (branch name or custom name)
 */
function getUnixEnv(projectPath, runtime, workspaceName, options) {
    if (!projectPath) {
        throw new Error("getUnixEnv: projectPath is required");
    }
    if (!workspaceName) {
        throw new Error("getUnixEnv: workspaceName is required");
    }
    const env = {
        UNIX_PROJECT_PATH: projectPath,
        UNIX_RUNTIME: runtime,
        UNIX_WORKSPACE_NAME: workspaceName,
    };
    if (options?.modelString) {
        env.UNIX_MODEL_STRING = options.modelString;
    }
    if (options?.thinkingLevel !== undefined) {
        env.UNIX_THINKING_LEVEL = options.thinkingLevel;
    }
    if (options?.costsUsd !== undefined) {
        env.UNIX_COSTS_USD = options.costsUsd.toFixed(2);
    }
    return env;
}
/**
 * Get the effective runtime type from a RuntimeConfig.
 * Handles legacy "local" with srcBaseDir → "worktree" mapping.
 */
function getRuntimeType(config) {
    if (!config)
        return "worktree"; // Default to worktree for undefined config
    if ((0, runtime_1.isSSHRuntime)(config))
        return "ssh";
    if ((0, runtime_1.isDockerRuntime)(config))
        return "docker";
    if ((0, runtime_1.isDevcontainerRuntime)(config))
        return "devcontainer";
    if ((0, runtime_1.isWorktreeRuntime)(config))
        return "worktree";
    return "local";
}
/**
 * Line-buffered logger that splits stream output into lines and logs them
 * Handles incomplete lines by buffering until a newline is received
 */
class LineBuffer {
    buffer = "";
    logLine;
    constructor(logLine) {
        this.logLine = logLine;
    }
    /**
     * Process a chunk of data, splitting on newlines and logging complete lines
     */
    append(data) {
        this.buffer += data;
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? ""; // Keep last incomplete line
        for (const line of lines) {
            if (line)
                this.logLine(line);
        }
    }
    /**
     * Flush any remaining buffered data (called when stream closes)
     */
    flush() {
        if (this.buffer) {
            this.logLine(this.buffer);
            this.buffer = "";
        }
    }
}
exports.LineBuffer = LineBuffer;
/**
 * Create line-buffered loggers for stdout and stderr
 * Returns an object with append and flush methods for each stream
 */
function createLineBufferedLoggers(initLogger) {
    const stdoutBuffer = new LineBuffer((line) => initLogger.logStdout(line));
    const stderrBuffer = new LineBuffer((line) => initLogger.logStderr(line));
    return {
        stdout: {
            append: (data) => stdoutBuffer.append(data),
            flush: () => stdoutBuffer.flush(),
        },
        stderr: {
            append: (data) => stderrBuffer.append(data),
            flush: () => stderrBuffer.flush(),
        },
    };
}
/**
 * Run .unix/init hook on a runtime and stream output to logger.
 * Shared implementation used by SSH and Docker runtimes.
 *
 * @param runtime - Runtime instance with exec capability
 * @param hookPath - Full path to the init hook (e.g., "/src/.unix/init" or "~/unix/project/workspace/.unix/init")
 * @param workspacePath - Working directory for the hook
 * @param muxEnv - UNIX_ environment variables from getUnixEnv()
 * @param initLogger - Logger for streaming output
 * @param abortSignal - Optional abort signal
 */
async function runInitHookOnRuntime(runtime, hookPath, workspacePath, muxEnv, initLogger, abortSignal) {
    initLogger.logStep(`Running init hook: ${hookPath}`);
    const hookStream = await runtime.exec(hookPath, {
        cwd: workspacePath,
        timeout: 3600, // 1 hour - generous timeout for init hooks
        abortSignal,
        env: muxEnv,
    });
    // Create line-buffered loggers for proper output handling
    const loggers = createLineBufferedLoggers(initLogger);
    const stdoutReader = hookStream.stdout.getReader();
    const stderrReader = hookStream.stderr.getReader();
    const decoder = new TextDecoder();
    // Read stdout in parallel
    const readStdout = async () => {
        try {
            while (true) {
                const { done, value } = await stdoutReader.read();
                if (done)
                    break;
                loggers.stdout.append(decoder.decode(value, { stream: true }));
            }
            loggers.stdout.flush();
        }
        finally {
            stdoutReader.releaseLock();
        }
    };
    // Read stderr in parallel
    const readStderr = async () => {
        try {
            while (true) {
                const { done, value } = await stderrReader.read();
                if (done)
                    break;
                loggers.stderr.append(decoder.decode(value, { stream: true }));
            }
            loggers.stderr.flush();
        }
        finally {
            stderrReader.releaseLock();
        }
    };
    // Wait for all streams and exit code
    const [exitCode] = await Promise.all([hookStream.exitCode, readStdout(), readStderr()]);
    // Log completion with exit code - hook failures are non-fatal per docs/hooks/init.mdx
    // ("failures are logged but don't prevent workspace usage")
    initLogger.logComplete(exitCode);
}
//# sourceMappingURL=initHook.js.map