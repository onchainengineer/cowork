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
exports.DevcontainerRuntime = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const stream_1 = require("stream");
const Runtime_1 = require("./Runtime");
const LocalBaseRuntime_1 = require("./LocalBaseRuntime");
const WorktreeManager_1 = require("../../node/worktree/WorktreeManager");
const tildeExpansion_1 = require("./tildeExpansion");
const streamUtils_1 = require("./streamUtils");
const credentialForwarding_1 = require("./credentialForwarding");
const devcontainerCli_1 = require("./devcontainerCli");
const initHook_1 = require("./initHook");
const initHook_2 = require("./initHook");
const disposableExec_1 = require("../../node/utils/disposableExec");
const exitCodes_1 = require("../../common/constants/exitCodes");
const env_1 = require("../../common/constants/env");
const errors_1 = require("../../common/utils/errors");
const log_1 = require("../../node/services/log");
const pathUtils_1 = require("../../node/utils/pathUtils");
/**
 * Devcontainer runtime implementation.
 *
 * This runtime creates git worktrees on the host and runs commands inside
 * a devcontainer built from the project's devcontainer.json configuration.
 *
 * Architecture:
 * - Worktree operations (create/delete/fork) → WorktreeManager (host filesystem)
 * - Command execution (exec) → devcontainer exec (inside container)
 * - File I/O → host fs (worktree is bind-mounted into container)
 * - ensureReady → devcontainer up (starts/rebuilds container as needed)
 */
class DevcontainerRuntime extends LocalBaseRuntime_1.LocalBaseRuntime {
    worktreeManager;
    srcBaseDir;
    configPath;
    // Cached env used for credential forwarding
    lastCredentialEnv;
    shareCredentials;
    // Cached from devcontainer up output
    remoteHomeDir;
    remoteWorkspaceFolder;
    remoteUser;
    // Current workspace context (set during postCreateSetup/ensureReady)
    currentWorkspacePath;
    createFlags = {
        deferredRuntimeAccess: true,
    };
    buildCredentialForwarding(env) {
        const additionalMounts = [];
        const remoteEnv = {};
        if (!this.shareCredentials) {
            return { additionalMounts, remoteEnv };
        }
        const sshForwarding = (0, credentialForwarding_1.resolveSshAgentForwarding)("/tmp/ssh-agent.sock");
        if (sshForwarding) {
            additionalMounts.push(`type=bind,source=${sshForwarding.hostSocketPath},target=${sshForwarding.targetSocketPath}`);
            remoteEnv.SSH_AUTH_SOCK = sshForwarding.targetSocketPath;
        }
        const ghToken = (0, credentialForwarding_1.resolveGhToken)(env);
        if (ghToken) {
            remoteEnv.GH_TOKEN = ghToken;
        }
        return { additionalMounts, remoteEnv };
    }
    mapContainerPathToHost(containerPath) {
        if (!this.remoteWorkspaceFolder || !this.currentWorkspacePath)
            return null;
        const remoteRoot = this.remoteWorkspaceFolder.replace(/\/+$/, "");
        if (containerPath !== remoteRoot && !containerPath.startsWith(`${remoteRoot}/`))
            return null;
        const suffix = containerPath.slice(remoteRoot.length).replace(/^\/+/, "");
        return suffix.length === 0
            ? this.currentWorkspacePath
            : path.join(this.currentWorkspacePath, suffix);
    }
    getContainerBasePath() {
        return this.remoteWorkspaceFolder ?? "/";
    }
    resolveHostPathForMounted(filePath) {
        if (this.currentWorkspacePath) {
            const normalizedFilePath = filePath.replaceAll("\\", "/");
            const normalizedHostRoot = (0, pathUtils_1.stripTrailingSlashes)(this.currentWorkspacePath.replaceAll("\\", "/"));
            if (normalizedFilePath === normalizedHostRoot ||
                normalizedFilePath.startsWith(`${normalizedHostRoot}/`)) {
                return filePath;
            }
        }
        return this.mapContainerPathToHost(filePath);
    }
    quoteForContainer(filePath) {
        if (filePath === "~" || filePath.startsWith("~/")) {
            return (0, tildeExpansion_1.expandTildeForSSH)(filePath);
        }
        return streamUtils_1.shescape.quote(filePath);
    }
    /**
     * Expand tilde in file paths for container operations.
     * Returns unexpanded path when container user is unknown (before ensureReady).
     * Callers must check for unexpanded tilde and handle appropriately.
     */
    expandTildeForContainer(filePath) {
        if (filePath === "~" || filePath.startsWith("~/")) {
            // If we know the home directory, use it
            if (this.remoteHomeDir) {
                return filePath === "~" ? this.remoteHomeDir : this.remoteHomeDir + filePath.slice(1);
            }
            // If we know the user, derive home directory
            if (this.remoteUser !== undefined) {
                const homeDir = this.remoteUser === "root" ? "/root" : `/home/${this.remoteUser}`;
                return filePath === "~" ? homeDir : homeDir + filePath.slice(1);
            }
            // User unknown - return unexpanded to signal caller should handle
            return filePath;
        }
        return filePath;
    }
    /**
     * Check if a path contains unexpanded tilde (container user unknown).
     */
    hasUnexpandedTilde(filePath) {
        return filePath === "~" || filePath.startsWith("~/");
    }
    async setupCredentials(env) {
        if (!this.shareCredentials)
            return;
        const gitconfigContents = await (0, credentialForwarding_1.readHostGitconfig)();
        if (gitconfigContents) {
            const stream = await this.exec('cat > "$HOME/.gitconfig"', {
                cwd: this.getContainerBasePath(),
                timeout: 30,
            });
            const writer = stream.stdin.getWriter();
            try {
                await writer.write(gitconfigContents);
            }
            finally {
                writer.releaseLock();
            }
            await stream.stdin.close();
            const exitCode = await stream.exitCode;
            if (exitCode !== 0) {
                const stderr = await (0, streamUtils_1.streamToString)(stream.stderr);
                throw new Runtime_1.RuntimeError(`Failed to copy gitconfig: ${stderr}`, "file_io");
            }
        }
        const ghToken = (0, credentialForwarding_1.resolveGhToken)(env);
        if (ghToken) {
            const stream = await this.exec("command -v gh >/dev/null && gh auth setup-git || true", {
                cwd: this.getContainerBasePath(),
                timeout: 30,
                env: { GH_TOKEN: ghToken },
            });
            await stream.stdin.close();
            await stream.exitCode;
        }
    }
    async fetchRemoteHome() {
        if (!this.currentWorkspacePath)
            return;
        try {
            const stream = await this.exec('printf "%s" "$HOME"', {
                cwd: this.remoteWorkspaceFolder ?? "/",
                timeout: 10,
            });
            await stream.stdin.close();
            const stdout = await (0, streamUtils_1.streamToString)(stream.stdout);
            const exitCode = await stream.exitCode;
            if (exitCode === 0 && stdout.trim()) {
                this.remoteHomeDir = stdout.trim();
            }
        }
        catch {
            // Best-effort; keep going if $HOME cannot be resolved
        }
    }
    readFileViaExec(filePath, abortSignal) {
        return new ReadableStream({
            start: async (controller) => {
                try {
                    const stream = await this.exec(`cat ${this.quoteForContainer(filePath)}`, {
                        cwd: this.getContainerBasePath(),
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
    writeFileViaExec(filePath, abortSignal) {
        const quotedPath = this.quoteForContainer(filePath);
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        const quotedTempPath = this.quoteForContainer(tempPath);
        const writeCommand = `mkdir -p $(dirname ${quotedPath}) && cat > ${quotedTempPath} && mv ${quotedTempPath} ${quotedPath}`;
        let execPromise = null;
        const getExecStream = () => {
            execPromise ?? (execPromise = this.exec(writeCommand, {
                cwd: this.getContainerBasePath(),
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
    async ensureDirViaExec(dirPath) {
        const stream = await this.exec(`mkdir -p ${this.quoteForContainer(dirPath)}`, {
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
    async statViaExec(filePath, abortSignal) {
        const stream = await this.exec(`stat -c '%s %Y %F' ${this.quoteForContainer(filePath)}`, {
            cwd: this.getContainerBasePath(),
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
    mapHostPathToContainer(hostPath) {
        if (!this.remoteWorkspaceFolder || !this.currentWorkspacePath)
            return null;
        // Normalize to forward slashes for cross-platform comparison (Windows uses backslashes)
        const normalizedHostPath = hostPath.replaceAll("\\", "/");
        const hostRoot = this.currentWorkspacePath.replaceAll("\\", "/").replace(/\/+$/, "");
        if (normalizedHostPath !== hostRoot && !normalizedHostPath.startsWith(`${hostRoot}/`))
            return null;
        const suffix = normalizedHostPath.slice(hostRoot.length).replace(/^\/+/, "");
        return suffix.length === 0
            ? this.remoteWorkspaceFolder
            : path.posix.join(this.remoteWorkspaceFolder, suffix);
    }
    /**
     * Resolve cwd for container exec, filtering out unmappable host paths.
     * Only uses options.cwd if it looks like a valid container path (POSIX absolute, no Windows drive letters).
     */
    resolveContainerCwd(optionsCwd, workspaceFolder) {
        if (optionsCwd && this.looksLikeContainerPath(optionsCwd)) {
            return optionsCwd;
        }
        return this.remoteWorkspaceFolder ?? workspaceFolder;
    }
    /**
     * Check if a path looks like a valid container path (POSIX absolute, no Windows artifacts).
     */
    looksLikeContainerPath(p) {
        // Reject Windows drive letters (e.g., C:\, D:/)
        if (/^[A-Za-z]:/.test(p))
            return false;
        // Reject backslashes (Windows path separators)
        if (p.includes("\\"))
            return false;
        // Must be absolute POSIX path
        return p.startsWith("/");
    }
    constructor(options) {
        super();
        this.srcBaseDir = options.srcBaseDir;
        this.worktreeManager = new WorktreeManager_1.WorktreeManager(options.srcBaseDir);
        this.configPath = options.configPath;
        this.shareCredentials = options.shareCredentials ?? false;
    }
    getWorkspacePath(projectPath, workspaceName) {
        return this.worktreeManager.getWorkspacePath(projectPath, workspaceName);
    }
    async createWorkspace(params) {
        return this.worktreeManager.createWorkspace({
            projectPath: params.projectPath,
            branchName: params.branchName,
            trunkBranch: params.trunkBranch,
            initLogger: params.initLogger,
        });
    }
    /**
     * Build and start the devcontainer after workspace creation.
     * This runs `devcontainer up` which builds the image and starts the container.
     */
    async postCreateSetup(params) {
        const { workspacePath, initLogger, abortSignal, env } = params;
        initLogger.logStep("Building devcontainer...");
        this.lastCredentialEnv = env;
        const { additionalMounts, remoteEnv } = this.buildCredentialForwarding(env);
        try {
            const result = await (0, devcontainerCli_1.devcontainerUp)({
                workspaceFolder: workspacePath,
                configPath: this.configPath,
                initLogger,
                abortSignal,
                additionalMounts: additionalMounts.length > 0 ? additionalMounts : undefined,
                remoteEnv: Object.keys(remoteEnv).length > 0 ? remoteEnv : undefined,
            });
            // Cache container info
            this.remoteWorkspaceFolder = result.remoteWorkspaceFolder;
            this.remoteUser = result.remoteUser;
            this.currentWorkspacePath = workspacePath;
            await this.fetchRemoteHome();
            await this.setupCredentials(env);
            initLogger.logStep("Devcontainer ready");
        }
        catch (error) {
            throw new Error(`Failed to start devcontainer: ${(0, errors_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Run .unix/init hook inside the devcontainer.
     */
    async initWorkspace(params) {
        const { projectPath, branchName, workspacePath, initLogger, env } = params;
        try {
            // Check if init hook exists (on host - worktree is bind-mounted)
            const hookExists = await (0, initHook_1.checkInitHookExists)(workspacePath);
            if (hookExists) {
                const muxEnv = { ...env, ...(0, initHook_1.getUnixEnv)(projectPath, "devcontainer", branchName) };
                const containerWorkspacePath = this.remoteWorkspaceFolder ?? workspacePath;
                const hookPath = `${containerWorkspacePath}/.unix/init`;
                await (0, initHook_2.runInitHookOnRuntime)(this, hookPath, containerWorkspacePath, muxEnv, initLogger);
            }
            else {
                // No hook - signal completion immediately
                initLogger.logComplete(0);
            }
            return { success: true };
        }
        catch (error) {
            const errorMsg = (0, errors_1.getErrorMessage)(error);
            initLogger.logStderr(`Initialization failed: ${errorMsg}`);
            initLogger.logComplete(-1);
            return {
                success: false,
                error: errorMsg,
            };
        }
    }
    /**
     * Execute a command inside the devcontainer.
     * Overrides LocalBaseRuntime.exec() to use `devcontainer exec`.
     */
    exec(command, options) {
        const startTime = performance.now();
        // Short-circuit if already aborted
        if (options.abortSignal?.aborted) {
            throw new Runtime_1.RuntimeError("Operation aborted before execution", "exec");
        }
        // Build devcontainer exec args
        const workspaceFolder = this.currentWorkspacePath;
        if (!workspaceFolder) {
            throw new Runtime_1.RuntimeError("Devcontainer not initialized. Call ensureReady() first.", "exec");
        }
        const args = ["exec", "--workspace-folder", workspaceFolder];
        if (this.configPath) {
            args.push("--config", this.configPath);
        }
        // Add environment variables
        const envVars = { ...options.env, ...env_1.NON_INTERACTIVE_ENV_VARS };
        for (const [key, value] of Object.entries(envVars)) {
            args.push("--remote-env", `${key}=${value}`);
        }
        // Build the full command with cd
        // Map host workspace path to container path; fall back to container workspace if unmappable
        const mappedCwd = options.cwd ? this.mapHostPathToContainer(options.cwd) : null;
        const cwd = mappedCwd ?? this.resolveContainerCwd(options.cwd, workspaceFolder);
        const fullCommand = `cd ${JSON.stringify(cwd)} && ${command}`;
        args.push("--", "bash", "-c", fullCommand);
        const childProcess = (0, child_process_1.spawn)("devcontainer", args, {
            stdio: ["pipe", "pipe", "pipe"],
            detached: true,
            windowsHide: true,
            cwd: workspaceFolder,
        });
        const disposable = new disposableExec_1.DisposableProcess(childProcess);
        // Convert Node.js streams to Web Streams (casts required for ExecStream compatibility)
        /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
        const stdout = stream_1.Readable.toWeb(childProcess.stdout);
        const stderr = stream_1.Readable.toWeb(childProcess.stderr);
        const stdin = stream_1.Writable.toWeb(childProcess.stdin);
        /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
        let timedOut = false;
        let aborted = false;
        const exitCode = new Promise((resolve, reject) => {
            childProcess.on("exit", (code) => {
                if (childProcess.pid !== undefined) {
                    (0, disposableExec_1.killProcessTree)(childProcess.pid);
                }
                if (aborted || options.abortSignal?.aborted) {
                    resolve(exitCodes_1.EXIT_CODE_ABORTED);
                    return;
                }
                if (timedOut) {
                    resolve(exitCodes_1.EXIT_CODE_TIMEOUT);
                    return;
                }
                resolve(code ?? 0);
            });
            childProcess.on("error", (err) => {
                reject(new Runtime_1.RuntimeError(`Failed to execute devcontainer exec: ${err.message}`, "exec", err));
            });
        });
        const duration = exitCode.then(() => performance.now() - startTime);
        void exitCode.catch(() => undefined);
        void duration.catch(() => undefined);
        // Handle timeout
        let timeoutId;
        if (options.timeout && options.timeout > 0) {
            timeoutId = setTimeout(() => {
                timedOut = true;
                disposable[Symbol.dispose]();
            }, options.timeout * 1000);
            void exitCode.finally(() => {
                if (timeoutId)
                    clearTimeout(timeoutId);
            });
        }
        // Handle abort signal
        const abortHandler = () => {
            aborted = true;
            disposable[Symbol.dispose]();
        };
        options.abortSignal?.addEventListener("abort", abortHandler);
        void exitCode.finally(() => {
            options.abortSignal?.removeEventListener("abort", abortHandler);
        });
        return Promise.resolve({
            stdout,
            stderr,
            stdin,
            exitCode,
            duration,
        });
    }
    readFile(filePath, abortSignal) {
        const hostPath = this.resolveHostPathForMounted(filePath);
        if (hostPath) {
            return super.readFile(hostPath, abortSignal);
        }
        return this.readFileViaExec(filePath, abortSignal);
    }
    writeFile(filePath, abortSignal) {
        const hostPath = this.resolveHostPathForMounted(filePath);
        if (hostPath) {
            return super.writeFile(hostPath, abortSignal);
        }
        return this.writeFileViaExec(filePath, abortSignal);
    }
    async stat(filePath) {
        const hostPath = this.resolveHostPathForMounted(filePath);
        if (hostPath) {
            return super.stat(hostPath);
        }
        return this.statViaExec(filePath);
    }
    async ensureDir(dirPath) {
        const hostPath = this.resolveHostPathForMounted(dirPath);
        if (hostPath) {
            return super.ensureDir(hostPath);
        }
        return this.ensureDirViaExec(dirPath);
    }
    async resolvePath(filePath) {
        let expanded = this.expandTildeForContainer(filePath);
        if (this.hasUnexpandedTilde(expanded)) {
            await this.fetchRemoteHome();
            if (this.remoteHomeDir) {
                expanded = filePath === "~" ? this.remoteHomeDir : this.remoteHomeDir + filePath.slice(1);
            }
            else {
                throw new Runtime_1.RuntimeError(`Failed to resolve path ${filePath}: container home directory unavailable`, "exec");
            }
        }
        // Resolve relative paths against container workspace (avoid host cwd leakage)
        if (!expanded.startsWith("/")) {
            const basePath = this.remoteWorkspaceFolder ?? "/";
            return path.posix.resolve(basePath, expanded);
        }
        // For absolute paths, resolve using posix (container is Linux)
        return path.posix.resolve(expanded);
    }
    tempDir() {
        const workspaceRoot = this.remoteWorkspaceFolder ?? this.currentWorkspacePath;
        if (!workspaceRoot) {
            return super.tempDir();
        }
        const tmpPath = this.remoteWorkspaceFolder
            ? path.posix.join(workspaceRoot, ".unix", "tmp")
            : path.join(workspaceRoot, ".unix", "tmp");
        return Promise.resolve(tmpPath);
    }
    /**
     * Ensure the devcontainer is ready for operations.
     * Runs `devcontainer up` which starts the container if stopped,
     * or rebuilds if the container was deleted.
     */
    async ensureReady(options) {
        if (!this.currentWorkspacePath) {
            return {
                ready: false,
                error: "Workspace path not set. Call postCreateSetup() first.",
                errorType: "runtime_not_ready",
            };
        }
        const statusSink = options?.statusSink;
        statusSink?.({ phase: "checking", runtimeType: "devcontainer" });
        try {
            statusSink?.({
                phase: "starting",
                runtimeType: "devcontainer",
                detail: "Starting devcontainer...",
            });
            // Create a minimal logger for ensureReady (we don't want verbose output here)
            const silentLogger = {
                logStep: (_message) => {
                    /* silent */
                },
                logStdout: (_line) => {
                    /* silent */
                },
                logStderr: (line) => log_1.log.debug("devcontainer up stderr:", { line }),
                logComplete: (_exitCode) => {
                    /* silent */
                },
            };
            const { additionalMounts, remoteEnv } = this.buildCredentialForwarding(this.lastCredentialEnv);
            const result = await (0, devcontainerCli_1.devcontainerUp)({
                workspaceFolder: this.currentWorkspacePath,
                configPath: this.configPath,
                initLogger: silentLogger,
                abortSignal: options?.signal,
                additionalMounts: additionalMounts.length > 0 ? additionalMounts : undefined,
                remoteEnv: Object.keys(remoteEnv).length > 0 ? remoteEnv : undefined,
            });
            // Update cached info (container may have been rebuilt)
            this.remoteWorkspaceFolder = result.remoteWorkspaceFolder;
            this.remoteUser = result.remoteUser;
            await this.fetchRemoteHome();
            await this.setupCredentials(this.lastCredentialEnv);
            statusSink?.({ phase: "ready", runtimeType: "devcontainer" });
            return { ready: true };
        }
        catch (error) {
            const errorMsg = (0, errors_1.getErrorMessage)(error);
            statusSink?.({ phase: "error", runtimeType: "devcontainer", detail: errorMsg });
            return {
                ready: false,
                error: errorMsg,
                errorType: "runtime_not_ready",
            };
        }
    }
    async renameWorkspace(projectPath, oldName, newName, _abortSignal) {
        // Stop container before rename (container labels reference old path)
        const oldPath = this.getWorkspacePath(projectPath, oldName);
        await (0, devcontainerCli_1.devcontainerDown)(oldPath, this.configPath);
        // Rename worktree on host
        const result = await this.worktreeManager.renameWorkspace(projectPath, oldName, newName);
        if (result.success) {
            // Update current workspace path if this was the active workspace
            if (this.currentWorkspacePath === oldPath) {
                this.currentWorkspacePath = result.newPath;
            }
        }
        return result;
    }
    async deleteWorkspace(projectPath, workspaceName, force, _abortSignal) {
        const workspacePath = this.getWorkspacePath(projectPath, workspaceName);
        // Stop and remove container (best-effort)
        try {
            await (0, devcontainerCli_1.devcontainerDown)(workspacePath, this.configPath);
        }
        catch (error) {
            log_1.log.debug("devcontainerDown failed (container may not exist):", { error });
        }
        // Delete worktree on host
        return this.worktreeManager.deleteWorkspace(projectPath, workspaceName, force);
    }
    async forkWorkspace(params) {
        // Fork creates a new worktree - container will be built on first ensureReady
        return this.worktreeManager.forkWorkspace(params);
    }
    /**
     * Set the current workspace path for exec operations.
     * Called by workspaceService when switching to an existing workspace.
     */
    setCurrentWorkspacePath(workspacePath) {
        this.currentWorkspacePath = workspacePath;
    }
    /**
     * Get the remote workspace folder path (inside container).
     */
    getRemoteWorkspaceFolder() {
        return this.remoteWorkspaceFolder;
    }
}
exports.DevcontainerRuntime = DevcontainerRuntime;
//# sourceMappingURL=DevcontainerRuntime.js.map