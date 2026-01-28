"use strict";
/**
 * CoderSSHRuntime - SSH runtime wrapper for Coder workspaces.
 *
 * Extends SSHRuntime to add Coder-specific provisioning via postCreateSetup():
 * - Creates Coder workspace (if not connecting to existing)
 * - Runs `coder config-ssh --yes` to set up SSH proxy
 *
 * This ensures unix workspace metadata is persisted before the long-running
 * Coder build starts, allowing build logs to stream to init logs (like Docker).
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
exports.CoderSSHRuntime = void 0;
const SSHRuntime_1 = require("./SSHRuntime");
const runtime_1 = require("../../common/types/runtime");
const result_1 = require("../../common/types/result");
const log_1 = require("../../node/services/log");
const helpers_1 = require("../../node/utils/runtime/helpers");
const tildeExpansion_1 = require("./tildeExpansion");
const path = __importStar(require("path"));
/**
 * Coder workspace name regex: ^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$
 * - Must start with alphanumeric
 * - Can contain hyphens, but only between alphanumeric segments
 * - No underscores (unlike unix workspace names)
 */
const CODER_NAME_REGEX = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;
/**
 * Transform a unix workspace name to be Coder-compatible.
 * - Replace underscores with hyphens
 * - Remove leading/trailing hyphens
 * - Collapse multiple consecutive hyphens
 */
function toCoderCompatibleName(name) {
    return name
        .replace(/_/g, "-") // Replace underscores with hyphens
        .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
        .replace(/-{2,}/g, "-"); // Collapse multiple hyphens
}
const CODER_INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000;
const CODER_ENSURE_READY_TIMEOUT_MS = 120_000;
const CODER_STATUS_POLL_INTERVAL_MS = 2_000;
/**
 * SSH runtime that handles Coder workspace provisioning.
 *
 * IMPORTANT: This extends SSHRuntime (rather than delegating) so other backend
 * code that checks `runtime instanceof SSHRuntime` (PTY, tools, path handling)
 * continues to behave correctly for Coder workspaces.
 */
class CoderSSHRuntime extends SSHRuntime_1.SSHRuntime {
    coderConfig;
    coderService;
    /**
     * Timestamp of last time we (a) successfully used the runtime or (b) decided not
     * to block the user (unknown Coder CLI error).
     * Used to avoid running expensive status checks on every message while still
     * catching auto-stopped workspaces after long inactivity.
     */
    lastActivityAtMs = 0;
    /**
     * Flags for WorkspaceService to customize create flow:
     * - deferredRuntimeAccess: skip srcBaseDir resolution (Coder host doesn't exist yet)
     * - configLevelCollisionDetection: use config-based collision check (can't reach host)
     */
    createFlags = {
        deferredRuntimeAccess: true,
        configLevelCollisionDetection: true,
    };
    constructor(config, transport, coderService) {
        if (!config || !coderService || !transport) {
            throw new Error("CoderSSHRuntime requires config, transport, and coderService");
        }
        const baseConfig = {
            host: config.host,
            srcBaseDir: config.srcBaseDir,
            bgOutputDir: config.bgOutputDir,
            identityFile: config.identityFile,
            port: config.port,
        };
        super(baseConfig, transport);
        this.coderConfig = config.coder;
        this.coderService = coderService;
    }
    /** In-flight ensureReady promise to avoid duplicate start/wait sequences */
    ensureReadyPromise = null;
    /**
     * Check if runtime is ready for use.
     *
     * Behavior:
     * - If creation failed during postCreateSetup(), fail fast.
     * - If workspace is running: return ready.
     * - If workspace is stopped: auto-start and wait (blocking, ~120s timeout).
     * - If workspace is stopping: poll until stopped, then start.
     * - Emits runtime-status events via statusSink for UX feedback.
     *
     * Concurrency: shares an in-flight promise to avoid duplicate start sequences.
     */
    async ensureReady(options) {
        const workspaceName = this.coderConfig.workspaceName;
        if (!workspaceName) {
            return {
                ready: false,
                error: "Coder workspace name not set",
                errorType: "runtime_not_ready",
            };
        }
        const now = Date.now();
        // Fast path: recently active, skip expensive status check
        if (this.lastActivityAtMs !== 0 &&
            now - this.lastActivityAtMs < CODER_INACTIVITY_THRESHOLD_MS) {
            return { ready: true };
        }
        // Avoid duplicate concurrent start/wait sequences
        if (this.ensureReadyPromise) {
            return this.ensureReadyPromise;
        }
        this.ensureReadyPromise = this.doEnsureReady(workspaceName, options);
        try {
            return await this.ensureReadyPromise;
        }
        finally {
            this.ensureReadyPromise = null;
        }
    }
    /**
     * Core ensureReady logic - called once (protected by ensureReadyPromise).
     *
     * Flow:
     * 1. Check status via `coder list` - short-circuit for "running" or "not_found"
     * 2. If "stopping"/"canceling": poll until it clears (coder ssh can't autostart during these)
     * 3. Run `coder ssh --wait=yes -- true` which handles everything else:
     *    - stopped: auto-starts, streams build logs, waits for startup scripts
     *    - starting/pending: waits for build completion + startup scripts
     */
    async doEnsureReady(workspaceName, options) {
        const statusSink = options?.statusSink;
        const signal = options?.signal;
        const startTime = Date.now();
        const emitStatus = (phase, detail) => {
            statusSink?.({ phase, runtimeType: "ssh", detail });
        };
        // Helper: check if we've exceeded overall timeout
        const isTimedOut = () => Date.now() - startTime > CODER_ENSURE_READY_TIMEOUT_MS;
        const remainingMs = () => Math.max(0, CODER_ENSURE_READY_TIMEOUT_MS - (Date.now() - startTime));
        // Step 1: Check current status for short-circuits
        emitStatus("checking");
        if (signal?.aborted) {
            emitStatus("error");
            return { ready: false, error: "Aborted", errorType: "runtime_start_failed" };
        }
        let statusResult = await this.coderService.getWorkspaceStatus(workspaceName, {
            timeoutMs: Math.min(remainingMs(), 10_000),
            signal,
        });
        // Short-circuit: already running
        if (statusResult.kind === "ok" && statusResult.status === "running") {
            this.lastActivityAtMs = Date.now();
            emitStatus("ready");
            return { ready: true };
        }
        // Short-circuit: workspace doesn't exist
        if (statusResult.kind === "not_found") {
            emitStatus("error");
            return {
                ready: false,
                error: `Coder workspace "${workspaceName}" not found`,
                errorType: "runtime_not_ready",
            };
        }
        // For status check errors (timeout, auth issues), proceed optimistically
        // and let SSH fail naturally to avoid blocking the happy path
        if (statusResult.kind === "error") {
            if (signal?.aborted) {
                emitStatus("error");
                return { ready: false, error: "Aborted", errorType: "runtime_start_failed" };
            }
            log_1.log.debug("Coder workspace status unknown, proceeding optimistically", {
                workspaceName,
                error: statusResult.error,
            });
        }
        // Step 2: Wait for "stopping"/"canceling" to clear (coder ssh can't autostart during these)
        if (statusResult.kind === "ok" &&
            (statusResult.status === "stopping" || statusResult.status === "canceling")) {
            emitStatus("waiting", "Waiting for Coder workspace to stop...");
            while (statusResult.kind === "ok" &&
                (statusResult.status === "stopping" || statusResult.status === "canceling") &&
                !isTimedOut()) {
                if (signal?.aborted) {
                    emitStatus("error");
                    return { ready: false, error: "Aborted", errorType: "runtime_start_failed" };
                }
                await this.sleep(CODER_STATUS_POLL_INTERVAL_MS, signal);
                statusResult = await this.coderService.getWorkspaceStatus(workspaceName, {
                    timeoutMs: Math.min(remainingMs(), 10_000),
                    signal,
                });
                // Check for state changes during polling
                if (statusResult.kind === "ok" && statusResult.status === "running") {
                    this.lastActivityAtMs = Date.now();
                    emitStatus("ready");
                    return { ready: true };
                }
                if (statusResult.kind === "not_found") {
                    emitStatus("error");
                    return {
                        ready: false,
                        error: `Coder workspace "${workspaceName}" not found`,
                        errorType: "runtime_not_ready",
                    };
                }
            }
            if (isTimedOut()) {
                emitStatus("error");
                return {
                    ready: false,
                    error: "Coder workspace is still stopping... Please retry shortly.",
                    errorType: "runtime_start_failed",
                };
            }
        }
        // Step 3: Use coder ssh --wait=yes to handle all other states
        // This auto-starts stopped workspaces and waits for startup scripts
        emitStatus("starting", "Connecting to Coder workspace...");
        log_1.log.debug("Connecting to Coder workspace via SSH", { workspaceName });
        // Create abort signal that fires on timeout or user abort
        const controller = new AbortController();
        const checkInterval = setInterval(() => {
            if (isTimedOut() || signal?.aborted) {
                controller.abort();
                clearInterval(checkInterval);
            }
        }, 1000);
        controller.signal.addEventListener("abort", () => clearInterval(checkInterval), {
            once: true,
        });
        if (isTimedOut() || signal?.aborted)
            controller.abort();
        try {
            for await (const _line of this.coderService.waitForStartupScripts(workspaceName, controller.signal)) {
                // Consume output for timeout/abort handling
            }
            this.lastActivityAtMs = Date.now();
            emitStatus("ready");
            return { ready: true };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            emitStatus("error");
            if (isTimedOut()) {
                return {
                    ready: false,
                    error: "Coder workspace start timed out",
                    errorType: "runtime_start_failed",
                };
            }
            if (signal?.aborted) {
                return { ready: false, error: "Aborted", errorType: "runtime_start_failed" };
            }
            // Map "not found" errors to runtime_not_ready
            if (/not found|no access/i.test(errorMsg)) {
                return {
                    ready: false,
                    error: `Coder workspace "${workspaceName}" not found`,
                    errorType: "runtime_not_ready",
                };
            }
            return {
                ready: false,
                error: `Failed to connect to Coder workspace: ${errorMsg}`,
                errorType: "runtime_start_failed",
            };
        }
        finally {
            clearInterval(checkInterval);
        }
    }
    /** Promise-based sleep helper */
    sleep(ms, abortSignal) {
        if (abortSignal?.aborted) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                abortSignal?.removeEventListener("abort", onAbort);
                resolve();
            }, ms);
            const onAbort = () => {
                clearTimeout(timeout);
                abortSignal?.removeEventListener("abort", onAbort);
                resolve();
            };
            abortSignal?.addEventListener("abort", onAbort, { once: true });
        });
    }
    /**
     * Finalize runtime config after collision handling.
     * Derives Coder workspace name from branch name and computes SSH host.
     */
    finalizeConfig(finalBranchName, config) {
        if (!(0, runtime_1.isSSHRuntime)(config) || !config.coder) {
            return Promise.resolve((0, result_1.Ok)(config));
        }
        const coder = config.coder;
        let workspaceName = coder.workspaceName?.trim() ?? "";
        if (!coder.existingWorkspace) {
            // New workspace: derive name from unix workspace name if not provided
            if (!workspaceName) {
                workspaceName = `unix-${finalBranchName}`;
            }
            // Transform to Coder-compatible name (handles underscores, etc.)
            workspaceName = toCoderCompatibleName(workspaceName);
            // Validate against Coder's regex
            if (!CODER_NAME_REGEX.test(workspaceName)) {
                return Promise.resolve((0, result_1.Err)(`Workspace name "${finalBranchName}" cannot be converted to a valid Coder name. ` +
                    `Use only letters, numbers, and hyphens.`));
            }
        }
        else {
            // Existing workspace: name must be provided (selected from dropdown)
            if (!workspaceName) {
                return Promise.resolve((0, result_1.Err)("Coder workspace name is required for existing workspaces"));
            }
        }
        // Final validation
        if (!workspaceName) {
            return Promise.resolve((0, result_1.Err)("Coder workspace name is required"));
        }
        return Promise.resolve((0, result_1.Ok)({
            ...config,
            host: `${workspaceName}.coder`,
            coder: { ...coder, workspaceName },
        }));
    }
    /**
     * Validate before persisting workspace metadata.
     * Checks if a Coder workspace with this name already exists.
     */
    async validateBeforePersist(_finalBranchName, config) {
        if (!(0, runtime_1.isSSHRuntime)(config) || !config.coder) {
            return (0, result_1.Ok)(undefined);
        }
        // Skip for "existing" mode - user explicitly selected an existing workspace
        if (config.coder.existingWorkspace) {
            return (0, result_1.Ok)(undefined);
        }
        const workspaceName = config.coder.workspaceName;
        if (!workspaceName) {
            return (0, result_1.Ok)(undefined);
        }
        const exists = await this.coderService.workspaceExists(workspaceName);
        if (exists) {
            return (0, result_1.Err)(`A Coder workspace named "${workspaceName}" already exists. ` +
                `Either switch to "Existing" mode to use it, delete/rename it in Coder, ` +
                `or choose a different unix workspace name.`);
        }
        return (0, result_1.Ok)(undefined);
    }
    /**
     * Create workspace (fast path only - no SSH needed).
     * The Coder workspace may not exist yet, so we can't reach the SSH host.
     * Just compute the workspace path locally.
     */
    createWorkspace(params) {
        const workspacePath = this.getWorkspacePath(params.projectPath, params.directoryName);
        params.initLogger.logStep("Workspace path computed (Coder provisioning will follow)");
        return Promise.resolve({
            success: true,
            workspacePath,
        });
    }
    /**
     * Delete workspace: removes SSH files AND deletes Coder workspace (if Unix-managed).
     *
     * IMPORTANT: Only delete the Coder workspace once we're confident unix will commit
     * the deletion. In the non-force path, WorkspaceService.remove() aborts and keeps
     * workspace metadata when runtime.deleteWorkspace() fails.
     */
    async deleteWorkspace(projectPath, workspaceName, force, abortSignal) {
        // If this workspace is an existing Coder workspace that unix didn't create, just do SSH cleanup.
        if (this.coderConfig.existingWorkspace) {
            return super.deleteWorkspace(projectPath, workspaceName, force, abortSignal);
        }
        const coderWorkspaceName = this.coderConfig.workspaceName;
        if (!coderWorkspaceName) {
            log_1.log.warn("Coder workspace name not set, falling back to SSH-only deletion");
            return super.deleteWorkspace(projectPath, workspaceName, force, abortSignal);
        }
        // Check if Coder workspace still exists before attempting SSH operations.
        // If it's already gone, skip SSH cleanup (would hang trying to connect to non-existent host).
        const statusResult = await this.coderService.getWorkspaceStatus(coderWorkspaceName);
        if (statusResult.kind === "not_found") {
            log_1.log.debug("Coder workspace already deleted, skipping SSH cleanup", { coderWorkspaceName });
            return { success: true, deletedPath: this.getWorkspacePath(projectPath, workspaceName) };
        }
        if (statusResult.kind === "error") {
            // API errors (auth, network): fall through to SSH cleanup, let it fail naturally
            log_1.log.warn("Could not check Coder workspace status, proceeding with SSH cleanup", {
                coderWorkspaceName,
                error: statusResult.error,
            });
        }
        if (statusResult.kind === "ok") {
            // Workspace is being deleted or already deleted - skip SSH (would hang connecting to dying host)
            if (statusResult.status === "deleted" || statusResult.status === "deleting") {
                log_1.log.debug("Coder workspace is deleted/deleting, skipping SSH cleanup", {
                    coderWorkspaceName,
                    status: statusResult.status,
                });
                return { success: true, deletedPath: this.getWorkspacePath(projectPath, workspaceName) };
            }
        }
        const sshResult = await super.deleteWorkspace(projectPath, workspaceName, force, abortSignal);
        // In the normal (force=false) delete path, only delete the Coder workspace if the SSH delete
        // succeeded. If SSH delete failed (e.g., dirty workspace), WorkspaceService.remove() keeps the
        // workspace metadata and the user can retry.
        if (!sshResult.success && !force) {
            return sshResult;
        }
        try {
            log_1.log.debug(`Deleting Coder workspace "${coderWorkspaceName}"`);
            await this.coderService.deleteWorkspace(coderWorkspaceName);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log_1.log.error("Failed to delete Coder workspace", {
                coderWorkspaceName,
                error: message,
            });
            if (sshResult.success) {
                return {
                    success: false,
                    error: `SSH delete succeeded, but failed to delete Coder workspace: ${message}`,
                };
            }
            return {
                success: false,
                error: `SSH delete failed: ${sshResult.error}; Coder delete also failed: ${message}`,
            };
        }
        return sshResult;
    }
    /**
     * Fork workspace: delegates to SSHRuntime, but marks both source and fork
     * as existingWorkspace=true so neither can delete the shared Coder workspace.
     *
     * IMPORTANT: Also updates this instance's coderConfig so that if postCreateSetup
     * runs on this same runtime instance (for the forked workspace), it won't attempt
     * to create a new Coder workspace.
     */
    async forkWorkspace(params) {
        const result = await super.forkWorkspace(params);
        if (!result.success)
            return result;
        // Both workspaces now share the Coder workspace - mark as existing so
        // deleting either unix workspace won't destroy the underlying Coder workspace
        const sharedCoderConfig = { ...this.coderConfig, existingWorkspace: true };
        // Update this instance's config so postCreateSetup() skips coder create
        this.coderConfig = sharedCoderConfig;
        const sshConfig = this.getConfig();
        const sharedRuntimeConfig = { type: "ssh", ...sshConfig, coder: sharedCoderConfig };
        return {
            ...result,
            forkedRuntimeConfig: sharedRuntimeConfig,
            sourceRuntimeConfig: sharedRuntimeConfig,
        };
    }
    /**
     * Post-create setup: provision Coder workspace and configure SSH.
     * This runs after unix persists workspace metadata, so build logs stream to UI.
     */
    async postCreateSetup(params) {
        const { initLogger, abortSignal } = params;
        // Create Coder workspace if not connecting to an existing one
        if (!this.coderConfig.existingWorkspace) {
            // Validate required fields (workspaceName is set by finalizeConfig during workspace creation)
            const coderWorkspaceName = this.coderConfig.workspaceName;
            if (!coderWorkspaceName) {
                throw new Error("Coder workspace name is required (should be set by finalizeConfig)");
            }
            if (!this.coderConfig.template) {
                throw new Error("Coder template is required for new workspaces");
            }
            initLogger.logStep(`Creating Coder workspace "${coderWorkspaceName}"...`);
            try {
                for await (const line of this.coderService.createWorkspace(coderWorkspaceName, this.coderConfig.template, this.coderConfig.preset, abortSignal, this.coderConfig.templateOrg)) {
                    initLogger.logStdout(line);
                }
                initLogger.logStep("Coder workspace created successfully");
                // Wait for startup scripts to complete
                initLogger.logStep("Waiting for startup scripts...");
                for await (const line of this.coderService.waitForStartupScripts(coderWorkspaceName, abortSignal)) {
                    initLogger.logStdout(line);
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                log_1.log.error("Failed to create Coder workspace", { error, config: this.coderConfig });
                initLogger.logStderr(`Failed to create Coder workspace: ${errorMsg}`);
                throw new Error(`Failed to create Coder workspace: ${errorMsg}`);
            }
        }
        else if (this.coderConfig.workspaceName) {
            // For existing workspaces, wait for "stopping"/"canceling" to clear before SSH
            // (coder ssh --wait=yes can't autostart while a stop/cancel build is in progress)
            const workspaceName = this.coderConfig.workspaceName;
            let status = await this.coderService.getWorkspaceStatus(workspaceName, {
                signal: abortSignal,
            });
            if (status.kind === "ok" && (status.status === "stopping" || status.status === "canceling")) {
                initLogger.logStep(`Waiting for Coder workspace "${workspaceName}" to stop...`);
                while (status.kind === "ok" &&
                    (status.status === "stopping" || status.status === "canceling")) {
                    if (abortSignal?.aborted) {
                        throw new Error("Aborted while waiting for Coder workspace to stop");
                    }
                    await this.sleep(CODER_STATUS_POLL_INTERVAL_MS, abortSignal);
                    status = await this.coderService.getWorkspaceStatus(workspaceName, {
                        signal: abortSignal,
                    });
                }
            }
            // waitForStartupScripts (coder ssh --wait=yes) handles all other states:
            // - stopped: auto-starts, streams build logs, waits for scripts
            // - starting/pending: waits for build + scripts
            // - running: waits for scripts (fast if already done)
            initLogger.logStep(`Connecting to Coder workspace "${workspaceName}"...`);
            try {
                for await (const line of this.coderService.waitForStartupScripts(workspaceName, abortSignal)) {
                    initLogger.logStdout(line);
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                log_1.log.error("Failed waiting for Coder workspace", { error, config: this.coderConfig });
                initLogger.logStderr(`Failed connecting to Coder workspace: ${errorMsg}`);
                throw new Error(`Failed connecting to Coder workspace: ${errorMsg}`);
            }
        }
        // Ensure SSH config is set up for Coder workspaces
        initLogger.logStep("Configuring SSH for Coder...");
        try {
            await this.coderService.ensureSSHConfig();
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log_1.log.error("Failed to configure SSH for Coder", { error });
            initLogger.logStderr(`Failed to configure SSH: ${errorMsg}`);
            throw new Error(`Failed to configure SSH for Coder: ${errorMsg}`);
        }
        // Create parent directory for workspace (git clone won't create it)
        // This must happen after ensureSSHConfig() so SSH is configured
        initLogger.logStep("Preparing workspace directory...");
        const parentDir = path.posix.dirname(params.workspacePath);
        const mkdirResult = await (0, helpers_1.execBuffered)(this, `mkdir -p ${(0, tildeExpansion_1.expandTildeForSSH)(parentDir)}`, {
            cwd: "/tmp",
            timeout: 10,
            abortSignal,
        });
        if (mkdirResult.exitCode !== 0) {
            const errorMsg = mkdirResult.stderr || mkdirResult.stdout || "Unknown error";
            log_1.log.error("Failed to create workspace parent directory", { parentDir, error: errorMsg });
            initLogger.logStderr(`Failed to prepare workspace directory: ${errorMsg}`);
            throw new Error(`Failed to prepare workspace directory: ${errorMsg}`);
        }
        this.lastActivityAtMs = Date.now();
    }
}
exports.CoderSSHRuntime = CoderSSHRuntime;
//# sourceMappingURL=CoderSSHRuntime.js.map