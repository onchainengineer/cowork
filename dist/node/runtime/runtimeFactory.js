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
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncompatibleRuntimeError = exports.isIncompatibleRuntimeConfig = void 0;
exports.setGlobalLatticeService = setGlobalLatticeService;
exports.runFullInit = runFullInit;
exports.runBackgroundInit = runBackgroundInit;
exports.createRuntime = createRuntime;
exports.runtimeRequiresProjectPath = runtimeRequiresProjectPath;
exports.checkRuntimeAvailability = checkRuntimeAvailability;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const LocalRuntime_1 = require("./LocalRuntime");
const WorktreeRuntime_1 = require("./WorktreeRuntime");
const SSHRuntime_1 = require("./SSHRuntime");
const LatticeSSHRuntime_1 = require("./LatticeSSHRuntime");
const transports_1 = require("./transports");
const DockerRuntime_1 = require("./DockerRuntime");
const DevcontainerRuntime_1 = require("./DevcontainerRuntime");
const runtime_1 = require("../../common/types/runtime");
const runtimeCompatibility_1 = require("../../common/utils/runtimeCompatibility");
Object.defineProperty(exports, "isIncompatibleRuntimeConfig", { enumerable: true, get: function () { return runtimeCompatibility_1.isIncompatibleRuntimeConfig; } });
const disposableExec_1 = require("../../node/utils/disposableExec");
const config_1 = require("../../node/config");
const devcontainerCli_1 = require("./devcontainerCli");
const devcontainerConfigs_1 = require("./devcontainerConfigs");
// Global LatticeService singleton - set during app init so all createRuntime calls can use it
let globalLatticeService;
/**
 * Set the global LatticeService instance for runtime factory.
 * Call this during app initialization so createRuntime() can create LatticeSSHRuntime
 * without requiring callers to pass latticeService explicitly.
 */
function setGlobalLatticeService(service) {
    globalLatticeService = service;
}
/**
 * Run the full init sequence: postCreateSetup (if present) then initWorkspace.
 * Use this everywhere instead of calling initWorkspace directly to ensure
 * runtimes with provisioning steps (Docker, LatticeSSH) work correctly.
 */
async function runFullInit(runtime, params) {
    if (runtime.postCreateSetup) {
        await runtime.postCreateSetup(params);
    }
    return runtime.initWorkspace(params);
}
/**
 * Fire-and-forget init with standardized error handling.
 * Use this for background init after workspace creation (workspaceService, taskService).
 */
function runBackgroundInit(runtime, params, workspaceId, logger) {
    void (async () => {
        try {
            await runFullInit(runtime, params);
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger?.error(`Workspace init failed for ${workspaceId}:`, { error });
            params.initLogger.logStderr(`Initialization failed: ${errorMsg}`);
            params.initLogger.logComplete(-1);
        }
    })();
}
function shouldUseSSH2Runtime() {
    // Windows always uses SSH2 (no native OpenSSH)
    if (process.platform === "win32") {
        return true;
    }
    // Other platforms: check config (defaults to OpenSSH)
    const config = new config_1.Config();
    return config.loadConfigOrDefault().useSSH2Transport ?? false;
}
/**
 * Error thrown when a workspace has an incompatible runtime configuration,
 * typically from a newer version of unix that added new runtime types.
 */
class IncompatibleRuntimeError extends Error {
    constructor(message) {
        super(message);
        this.name = "IncompatibleRuntimeError";
    }
}
exports.IncompatibleRuntimeError = IncompatibleRuntimeError;
/**
 * Create a Runtime instance based on the configuration.
 *
 * Handles runtime types:
 * - "local" without srcBaseDir: Project-dir runtime (no isolation) - requires projectPath in options
 * - "local" with srcBaseDir: Legacy worktree config (backward compat)
 * - "worktree": Explicit worktree runtime
 * - "ssh": Remote SSH runtime
 * - "docker": Docker container runtime
 */
function createRuntime(config, options) {
    // Check for incompatible configs from newer versions
    if ((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(config)) {
        throw new IncompatibleRuntimeError(`This workspace uses a runtime configuration from a newer version ofunix. ` +
            `Please upgrade unix to use this workspace.`);
    }
    switch (config.type) {
        case "local":
            // Check if this is legacy "local" with srcBaseDir (= worktree semantics)
            // or new "local" without srcBaseDir (= project-dir semantics)
            if ((0, runtime_1.hasSrcBaseDir)(config)) {
                // Legacy: "local" with srcBaseDir is treated as worktree
                return new WorktreeRuntime_1.WorktreeRuntime(config.srcBaseDir);
            }
            // Project-dir: uses project path directly, no isolation
            if (!options?.projectPath) {
                throw new Error("LocalRuntime requires projectPath in options for project-dir config (type: 'local' without srcBaseDir)");
            }
            return new LocalRuntime_1.LocalRuntime(options.projectPath);
        case "worktree":
            return new WorktreeRuntime_1.WorktreeRuntime(config.srcBaseDir);
        case "ssh": {
            const sshConfig = {
                host: config.host,
                srcBaseDir: config.srcBaseDir,
                bgOutputDir: config.bgOutputDir,
                identityFile: config.identityFile,
                port: config.port,
            };
            const useSSH2 = shouldUseSSH2Runtime();
            const transport = (0, transports_1.createSSHTransport)(sshConfig, useSSH2);
            // Use a Lattice SSH runtime for SSH+Coder when latticeService is available (explicit or global)
            const latticeService = options?.latticeService ?? globalLatticeService;
            if (config.lattice) {
                if (!latticeService) {
                    throw new Error("Lattice runtime requested but LatticeService is not initialized");
                }
                return new LatticeSSHRuntime_1.LatticeSSHRuntime({ ...sshConfig, lattice: config.lattice }, transport, latticeService);
            }
            return new SSHRuntime_1.SSHRuntime(sshConfig, transport);
        }
        case "docker": {
            // For existing workspaces, derive container name from project+workspace
            const containerName = options?.projectPath && options?.workspaceName
                ? (0, DockerRuntime_1.getContainerName)(options.projectPath, options.workspaceName)
                : config.containerName;
            return new DockerRuntime_1.DockerRuntime({
                image: config.image,
                containerName,
                shareCredentials: config.shareCredentials,
            });
        }
        case "devcontainer": {
            // Devcontainer uses worktrees on host + container exec
            // srcBaseDir sourced from config to honor UNIX_ROOT and dev-mode suffixes
            const runtime = new DevcontainerRuntime_1.DevcontainerRuntime({
                srcBaseDir: new config_1.Config().srcDir,
                configPath: config.configPath,
                shareCredentials: config.shareCredentials,
            });
            // Set workspace path for existing workspaces
            if (options?.projectPath && options?.workspaceName) {
                runtime.setCurrentWorkspacePath(runtime.getWorkspacePath(options.projectPath, options.workspaceName));
            }
            return runtime;
        }
        default: {
            const unknownConfig = config;
            throw new Error(`Unknown runtime type: ${unknownConfig.type ?? "undefined"}`);
        }
    }
}
/**
 * Helper to check if a runtime config requires projectPath for createRuntime.
 */
function runtimeRequiresProjectPath(config) {
    // Project-dir local runtime (no srcBaseDir) requires projectPath
    return config.type === "local" && !(0, runtime_1.hasSrcBaseDir)(config);
}
/**
 * Check if a project has a .git directory (is a git repository).
 */
async function isGitRepository(projectPath) {
    try {
        const gitPath = path.join(projectPath, ".git");
        const stat = await fs.stat(gitPath);
        // .git can be a directory (normal repo) or a file (worktree)
        return stat.isDirectory() || stat.isFile();
    }
    catch {
        return false;
    }
}
/**
 * Check if Docker daemon is running and accessible.
 */
async function isDockerAvailable() {
    let timeoutHandle;
    try {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const proc = __addDisposableResource(env_1, (0, disposableExec_1.execAsync)("docker info"), false);
            const timeout = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("timeout")), 5000);
            });
            await Promise.race([proc.result, timeout]);
            return true;
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
    catch {
        return false;
    }
    finally {
        if (timeoutHandle)
            clearTimeout(timeoutHandle);
    }
}
/**
 * Check availability of all runtime types for a given project.
 * Returns a record of runtime mode to availability status.
 */
async function checkRuntimeAvailability(projectPath) {
    const [isGit, dockerAvailable, devcontainerCliInfo, devcontainerConfigs] = await Promise.all([
        isGitRepository(projectPath),
        isDockerAvailable(),
        (0, devcontainerCli_1.checkDevcontainerCliVersion)(),
        (0, devcontainerConfigs_1.scanDevcontainerConfigs)(projectPath),
    ]);
    const devcontainerConfigInfo = (0, devcontainerConfigs_1.buildDevcontainerConfigInfo)(devcontainerConfigs);
    const gitRequiredReason = "Requires git repository";
    // Determine devcontainer availability
    let devcontainerAvailability;
    if (!isGit) {
        devcontainerAvailability = { available: false, reason: gitRequiredReason };
    }
    else if (!devcontainerCliInfo) {
        devcontainerAvailability = {
            available: false,
            reason: "Dev Container CLI not installed. Run: npm install -g @devcontainers/cli",
        };
    }
    else if (!dockerAvailable) {
        devcontainerAvailability = { available: false, reason: "Docker daemon not running" };
    }
    else if (devcontainerConfigInfo.length === 0) {
        devcontainerAvailability = { available: false, reason: "No devcontainer.json found" };
    }
    else {
        devcontainerAvailability = {
            available: true,
            configs: devcontainerConfigInfo,
            cliVersion: devcontainerCliInfo.version,
        };
    }
    return {
        local: { available: true },
        worktree: isGit ? { available: true } : { available: false, reason: gitRequiredReason },
        ssh: isGit ? { available: true } : { available: false, reason: gitRequiredReason },
        docker: !isGit
            ? { available: false, reason: gitRequiredReason }
            : !dockerAvailable
                ? { available: false, reason: "Docker daemon not running" }
                : { available: true },
        devcontainer: devcontainerAvailability,
    };
}
//# sourceMappingURL=runtimeFactory.js.map