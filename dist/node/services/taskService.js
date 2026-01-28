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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const fsPromises = __importStar(require("fs/promises"));
const mutexMap_1 = require("../../node/utils/concurrency/mutexMap");
const asyncMutex_1 = require("../../node/utils/concurrency/asyncMutex");
const log_1 = require("../../node/services/log");
const git_1 = require("../../node/git");
const agentDefinitionsService_1 = require("../../node/services/agentDefinitions/agentDefinitionsService");
const forkRuntimeUpdates_1 = require("../../node/services/utils/forkRuntimeUpdates");
const runtimeHelpers_1 = require("../../node/runtime/runtimeHelpers");
const runtimeFactory_1 = require("../../node/runtime/runtimeFactory");
const workspaceValidation_1 = require("../../common/utils/validation/workspaceValidation");
const result_1 = require("../../common/types/result");
const tasks_1 = require("../../common/types/tasks");
const message_1 = require("../../common/types/message");
const messageIds_1 = require("../../node/services/utils/messageIds");
const models_1 = require("../../common/utils/ai/models");
const workspaceDefaults_1 = require("../../constants/workspaceDefaults");
const schemas_1 = require("../../common/orpc/schemas");
const toolParts_1 = require("../../common/types/toolParts");
const toolDefinitions_1 = require("../../common/utils/tools/toolDefinitions");
const sendMessageError_1 = require("../../node/services/utils/sendMessageError");
const policy_1 = require("../../common/utils/thinking/policy");
const taskQueueDebug_1 = require("../../node/services/taskQueueDebug");
const secrets_1 = require("../../common/types/secrets");
const COMPLETED_REPORT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const COMPLETED_REPORT_CACHE_MAX_ENTRIES = 128;
function isToolCallEndEvent(value) {
    return (typeof value === "object" &&
        value !== null &&
        "type" in value &&
        value.type === "tool-call-end" &&
        "workspaceId" in value &&
        typeof value.workspaceId === "string");
}
function isStreamEndEvent(value) {
    return (typeof value === "object" &&
        value !== null &&
        "type" in value &&
        value.type === "stream-end" &&
        "workspaceId" in value &&
        typeof value.workspaceId === "string");
}
function coerceNonEmptyString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function isSuccessfulToolResult(value) {
    return (typeof value === "object" &&
        value !== null &&
        "success" in value &&
        value.success === true);
}
function sanitizeAgentTypeForName(agentType) {
    const normalized = agentType
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/-+/g, "-")
        .replace(/^[_-]+|[_-]+$/g, "");
    return normalized.length > 0 ? normalized : "agent";
}
function buildAgentWorkspaceName(agentType, workspaceId) {
    const safeType = sanitizeAgentTypeForName(agentType);
    const base = `agent_${safeType}_${workspaceId}`;
    // Hard cap to validation limit (64). Ensure stable suffix is preserved.
    if (base.length <= 64)
        return base;
    const suffix = `_${workspaceId}`;
    const maxPrefixLen = 64 - suffix.length;
    const prefix = `agent_${safeType}`.slice(0, Math.max(0, maxPrefixLen));
    const name = `${prefix}${suffix}`;
    return name.length <= 64 ? name : `agent_${workspaceId}`.slice(0, 64);
}
function getIsoNow() {
    return new Date().toISOString();
}
class TaskService {
    config;
    historyService;
    partialService;
    aiService;
    workspaceService;
    initStateManager;
    // Serialize stream-end/tool-call-end processing per workspace to avoid races (e.g.
    // stream-end observing awaiting_report before agent_report handling flips the status).
    workspaceEventLocks = new mutexMap_1.MutexMap();
    mutex = new asyncMutex_1.AsyncMutex();
    pendingWaitersByTaskId = new Map();
    pendingStartWaitersByTaskId = new Map();
    // Tracks workspaces currently blocked in a foreground wait (e.g. a task tool call awaiting
    // agent_report). Used to avoid scheduler deadlocks when maxParallelAgentTasks is low and tasks
    // spawn nested tasks in the foreground.
    foregroundAwaitCountByWorkspaceId = new Map();
    // Cache completed reports so callers can retrieve them even after the task workspace is removed.
    // Bounded by TTL + max entries (see COMPLETED_REPORT_CACHE_*).
    completedReportsByTaskId = new Map();
    remindedAwaitingReport = new Set();
    constructor(config, historyService, partialService, aiService, workspaceService, initStateManager) {
        this.config = config;
        this.historyService = historyService;
        this.partialService = partialService;
        this.aiService = aiService;
        this.workspaceService = workspaceService;
        this.initStateManager = initStateManager;
        this.aiService.on("tool-call-end", (payload) => {
            if (!isToolCallEndEvent(payload))
                return;
            if (payload.toolName !== "agent_report")
                return;
            // Ignore failed agent_report attempts (e.g. tool rejected due to active descendants).
            if (!isSuccessfulToolResult(payload.result))
                return;
            void this.workspaceEventLocks
                .withLock(payload.workspaceId, async () => {
                await this.handleAgentReport(payload);
            })
                .catch((error) => {
                log_1.log.error("TaskService.handleAgentReport failed", { error });
            });
        });
        this.aiService.on("stream-end", (payload) => {
            if (!isStreamEndEvent(payload))
                return;
            void this.workspaceEventLocks
                .withLock(payload.workspaceId, async () => {
                await this.handleStreamEnd(payload);
            })
                .catch((error) => {
                log_1.log.error("TaskService.handleStreamEnd failed", { error });
            });
        });
    }
    // Prefer per-agent settings so tasks inherit the correct agent defaults;
    // fall back to legacy workspace settings for older configs.
    resolveWorkspaceAISettings(workspace, agentId) {
        const normalizedAgentId = typeof agentId === "string" && agentId.trim().length > 0
            ? agentId.trim().toLowerCase()
            : undefined;
        return ((normalizedAgentId ? workspace.aiSettingsByAgent?.[normalizedAgentId] : undefined) ??
            workspace.aiSettings);
    }
    async emitWorkspaceMetadata(workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "emitWorkspaceMetadata: workspaceId must be non-empty");
        const allMetadata = await this.config.getAllWorkspaceMetadata();
        const metadata = allMetadata.find((m) => m.id === workspaceId) ?? null;
        this.workspaceService.emit("metadata", { workspaceId, metadata });
    }
    async editWorkspaceEntry(workspaceId, updater, options) {
        (0, strict_1.default)(workspaceId.length > 0, "editWorkspaceEntry: workspaceId must be non-empty");
        let found = false;
        await this.config.editConfig((config) => {
            for (const [_projectPath, project] of config.projects) {
                const ws = project.workspaces.find((w) => w.id === workspaceId);
                if (!ws)
                    continue;
                updater(ws);
                found = true;
                return config;
            }
            if (options?.allowMissing) {
                return config;
            }
            throw new Error(`editWorkspaceEntry: workspace ${workspaceId} not found`);
        });
        return found;
    }
    async initialize() {
        await this.maybeStartQueuedTasks();
        const config = this.config.loadConfigOrDefault();
        const awaitingReportTasks = this.listAgentTaskWorkspaces(config).filter((t) => t.taskStatus === "awaiting_report");
        const runningTasks = this.listAgentTaskWorkspaces(config).filter((t) => t.taskStatus === "running");
        for (const task of awaitingReportTasks) {
            if (!task.id)
                continue;
            // Avoid resuming a task while it still has active descendants (it shouldn't report yet).
            const hasActiveDescendants = this.hasActiveDescendantAgentTasks(config, task.id);
            if (hasActiveDescendants) {
                continue;
            }
            // Restart-safety: if this task stream ends again without agent_report, fall back immediately.
            this.remindedAwaitingReport.add(task.id);
            const model = task.taskModelString ?? models_1.defaultModel;
            const resumeResult = await this.workspaceService.resumeStream(task.id, {
                model,
                agentId: task.agentId ?? workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
                thinkingLevel: task.taskThinkingLevel,
                toolPolicy: [{ regex_match: "^agent_report$", action: "require" }],
                additionalSystemInstructions: "This task is awaiting its final agent_report. Call agent_report exactly once now.",
            });
            if (!resumeResult.success) {
                log_1.log.error("Failed to resume awaiting_report task on startup", {
                    taskId: task.id,
                    error: resumeResult.error,
                });
                await this.fallbackReportMissingAgentReport({
                    projectPath: task.projectPath,
                    workspace: task,
                });
            }
        }
        for (const task of runningTasks) {
            if (!task.id)
                continue;
            // Best-effort: if unix restarted mid-stream, nudge the agent to continue and report.
            // Only do this when the task has no running descendants, to avoid duplicate spawns.
            const hasActiveDescendants = this.hasActiveDescendantAgentTasks(config, task.id);
            if (hasActiveDescendants) {
                continue;
            }
            const model = task.taskModelString ?? models_1.defaultModel;
            await this.workspaceService.sendMessage(task.id, "Unix restarted while this task was running. Continue where you left off. " +
                "When you have a final answer, call agent_report exactly once.", {
                model,
                agentId: task.agentId ?? workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
                thinkingLevel: task.taskThinkingLevel,
                experiments: task.taskExperiments,
            });
        }
    }
    startWorkspaceInit(workspaceId, projectPath) {
        (0, strict_1.default)(workspaceId.length > 0, "startWorkspaceInit: workspaceId must be non-empty");
        (0, strict_1.default)(projectPath.length > 0, "startWorkspaceInit: projectPath must be non-empty");
        this.initStateManager.startInit(workspaceId, projectPath);
        return {
            logStep: (message) => this.initStateManager.appendOutput(workspaceId, message, false),
            logStdout: (line) => this.initStateManager.appendOutput(workspaceId, line, false),
            logStderr: (line) => this.initStateManager.appendOutput(workspaceId, line, true),
            logComplete: (exitCode) => void this.initStateManager.endInit(workspaceId, exitCode),
        };
    }
    async create(args) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const parentWorkspaceId = coerceNonEmptyString(args.parentWorkspaceId);
            if (!parentWorkspaceId) {
                return (0, result_1.Err)("Task.create: parentWorkspaceId is required");
            }
            if (args.kind !== "agent") {
                return (0, result_1.Err)("Task.create: unsupported kind");
            }
            const prompt = coerceNonEmptyString(args.prompt);
            if (!prompt) {
                return (0, result_1.Err)("Task.create: prompt is required");
            }
            const agentIdRaw = coerceNonEmptyString(args.agentId ?? args.agentType);
            if (!agentIdRaw) {
                return (0, result_1.Err)("Task.create: agentId is required");
            }
            const normalizedAgentId = agentIdRaw.trim().toLowerCase();
            const parsedAgentId = schemas_1.AgentIdSchema.safeParse(normalizedAgentId);
            if (!parsedAgentId.success) {
                return (0, result_1.Err)(`Task.create: invalid agentId (${normalizedAgentId})`);
            }
            const agentId = parsedAgentId.data;
            const agentType = agentId; // Legacy alias for on-disk compatibility.
            const _lock = __addDisposableResource(env_1, await this.mutex.acquire(), true);
            // Validate parent exists and fetch runtime context.
            const parentMetaResult = await this.aiService.getWorkspaceMetadata(parentWorkspaceId);
            if (!parentMetaResult.success) {
                return (0, result_1.Err)(`Task.create: parent workspace not found (${parentMetaResult.error})`);
            }
            const parentMeta = parentMetaResult.data;
            // Enforce nesting depth.
            const cfg = this.config.loadConfigOrDefault();
            const taskSettings = cfg.taskSettings ?? tasks_1.DEFAULT_TASK_SETTINGS;
            const parentEntry = this.findWorkspaceEntry(cfg, parentWorkspaceId);
            if (parentEntry?.workspace.taskStatus === "reported") {
                return (0, result_1.Err)("Task.create: cannot spawn new tasks after agent_report");
            }
            const requestedDepth = this.getTaskDepth(cfg, parentWorkspaceId) + 1;
            if (requestedDepth > taskSettings.maxTaskNestingDepth) {
                return (0, result_1.Err)(`Task.create: maxTaskNestingDepth exceeded (requestedDepth=${requestedDepth}, max=${taskSettings.maxTaskNestingDepth})`);
            }
            // Enforce parallelism (global).
            const activeCount = this.countActiveAgentTasks(cfg);
            const shouldQueue = activeCount >= taskSettings.maxParallelAgentTasks;
            const taskId = this.config.generateStableId();
            const workspaceName = buildAgentWorkspaceName(agentId, taskId);
            const nameValidation = (0, workspaceValidation_1.validateWorkspaceName)(workspaceName);
            if (!nameValidation.valid) {
                return (0, result_1.Err)(`Task.create: generated workspace name invalid (${nameValidation.error ?? "unknown error"})`);
            }
            const parentAiSettings = this.resolveWorkspaceAISettings(parentMeta, agentId);
            const inheritedModelString = typeof args.modelString === "string" && args.modelString.trim().length > 0
                ? args.modelString.trim()
                : (parentAiSettings?.model ?? models_1.defaultModel);
            const inheritedThinkingLevel = args.thinkingLevel ?? parentAiSettings?.thinkingLevel ?? "off";
            const subagentDefaults = cfg.agentAiDefaults?.[agentId] ?? cfg.subagentAiDefaults?.[agentId];
            const taskModelString = subagentDefaults?.modelString ?? inheritedModelString;
            const canonicalModel = (0, models_1.normalizeGatewayModel)(taskModelString).trim();
            const requestedThinkingLevel = subagentDefaults?.thinkingLevel ?? inheritedThinkingLevel;
            const effectiveThinkingLevel = (0, policy_1.enforceThinkingPolicy)(canonicalModel, requestedThinkingLevel);
            const parentRuntimeConfig = parentMeta.runtimeConfig;
            const taskRuntimeConfig = parentRuntimeConfig;
            const runtime = (0, runtimeHelpers_1.createRuntimeForWorkspace)({
                runtimeConfig: taskRuntimeConfig,
                projectPath: parentMeta.projectPath,
                name: parentMeta.name,
            });
            // Validate the agent definition exists and is runnable as a sub-agent.
            const isInPlace = parentMeta.projectPath === parentMeta.name;
            const parentWorkspacePath = isInPlace
                ? parentMeta.projectPath
                : runtime.getWorkspacePath(parentMeta.projectPath, parentMeta.name);
            // Helper to build error hint with all available runnable agents
            const getRunnableHint = async () => {
                try {
                    const allAgents = await (0, agentDefinitionsService_1.discoverAgentDefinitions)(runtime, parentWorkspacePath);
                    const runnableIds = allAgents.filter((a) => a.subagentRunnable).map((a) => a.id);
                    return runnableIds.length > 0
                        ? `Runnable agentIds: ${runnableIds.join(", ")}`
                        : "No runnable agents available";
                }
                catch {
                    return "Could not discover available agents";
                }
            };
            let skipInitHook = false;
            try {
                const definition = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, parentWorkspacePath, agentId);
                if (definition.frontmatter.subagent?.runnable !== true) {
                    const hint = await getRunnableHint();
                    return (0, result_1.Err)(`Task.create: agentId is not runnable as a sub-agent (${agentId}). ${hint}`);
                }
                skipInitHook = definition.frontmatter.subagent?.skip_init_hook === true;
            }
            catch {
                const hint = await getRunnableHint();
                return (0, result_1.Err)(`Task.create: unknown agentId (${agentId}). ${hint}`);
            }
            const createdAt = getIsoNow();
            (0, taskQueueDebug_1.taskQueueDebug)("TaskService.create decision", {
                parentWorkspaceId,
                taskId,
                agentId,
                workspaceName,
                createdAt,
                activeCount,
                maxParallelAgentTasks: taskSettings.maxParallelAgentTasks,
                shouldQueue,
                runtimeType: taskRuntimeConfig.type,
                promptLength: prompt.length,
                model: taskModelString,
                thinkingLevel: effectiveThinkingLevel,
            });
            if (shouldQueue) {
                const trunkBranch = coerceNonEmptyString(parentMeta.name);
                if (!trunkBranch) {
                    return (0, result_1.Err)("Task.create: parent workspace name missing (cannot queue task)");
                }
                // NOTE: Queued tasks are persisted immediately, but their workspace is created later
                // when a parallel slot is available. This ensures queued tasks don't create worktrees
                // or run init hooks until they actually start.
                const workspacePath = runtime.getWorkspacePath(parentMeta.projectPath, workspaceName);
                (0, taskQueueDebug_1.taskQueueDebug)("TaskService.create queued (persist-only)", {
                    taskId,
                    workspaceName,
                    parentWorkspaceId,
                    trunkBranch,
                    workspacePath,
                });
                await this.config.editConfig((config) => {
                    let projectConfig = config.projects.get(parentMeta.projectPath);
                    if (!projectConfig) {
                        projectConfig = { workspaces: [] };
                        config.projects.set(parentMeta.projectPath, projectConfig);
                    }
                    projectConfig.workspaces.push({
                        path: workspacePath,
                        id: taskId,
                        name: workspaceName,
                        title: args.title,
                        createdAt,
                        runtimeConfig: taskRuntimeConfig,
                        aiSettings: { model: canonicalModel, thinkingLevel: effectiveThinkingLevel },
                        parentWorkspaceId,
                        agentId,
                        agentType,
                        taskStatus: "queued",
                        taskPrompt: prompt,
                        taskTrunkBranch: trunkBranch,
                        taskModelString,
                        taskThinkingLevel: effectiveThinkingLevel,
                        taskExperiments: args.experiments,
                    });
                    return config;
                });
                // Emit metadata update so the UI sees the workspace immediately.
                await this.emitWorkspaceMetadata(taskId);
                // NOTE: Do NOT persist the prompt into chat history until the task actually starts.
                // Otherwise the frontend treats "last message is user" as an interrupted stream and
                // will auto-retry / backoff-spam resume attempts while the task is queued.
                (0, taskQueueDebug_1.taskQueueDebug)("TaskService.create queued persisted (prompt stored in config)", {
                    taskId,
                    workspaceName,
                });
                // Schedule queue processing (best-effort).
                void this.maybeStartQueuedTasks();
                (0, taskQueueDebug_1.taskQueueDebug)("TaskService.create queued scheduled maybeStartQueuedTasks", { taskId });
                return (0, result_1.Ok)({ taskId, kind: "agent", status: "queued" });
            }
            const initLogger = this.startWorkspaceInit(taskId, parentMeta.projectPath);
            // Note: Local project-dir runtimes share the same directory (unsafe by design).
            // For worktree/ssh runtimes we attempt a fork first; otherwise fall back to createWorkspace.
            const forkResult = await runtime.forkWorkspace({
                projectPath: parentMeta.projectPath,
                sourceWorkspaceName: parentMeta.name,
                newWorkspaceName: workspaceName,
                initLogger,
            });
            const { forkedRuntimeConfig } = await (0, forkRuntimeUpdates_1.applyForkRuntimeUpdates)(this.config, parentWorkspaceId, parentRuntimeConfig, forkResult);
            if (forkResult.sourceRuntimeConfig) {
                // Ensure UI gets the updated runtimeConfig for the parent workspace.
                await this.emitWorkspaceMetadata(parentWorkspaceId);
            }
            const runtimeForTaskWorkspace = (0, runtimeFactory_1.createRuntime)(forkedRuntimeConfig, {
                projectPath: parentMeta.projectPath,
                workspaceName,
            });
            let trunkBranch;
            if (forkResult.success && forkResult.sourceBranch) {
                trunkBranch = forkResult.sourceBranch;
            }
            else {
                // Fork failed - validate parentMeta.name is a valid local branch.
                // For non-git projects (LocalRuntime), git commands fail - fall back to "main".
                try {
                    const localBranches = await (0, git_1.listLocalBranches)(parentMeta.projectPath);
                    if (localBranches.includes(parentMeta.name)) {
                        trunkBranch = parentMeta.name;
                    }
                    else {
                        trunkBranch = await (0, git_1.detectDefaultTrunkBranch)(parentMeta.projectPath, localBranches);
                    }
                }
                catch {
                    trunkBranch = "main";
                }
            }
            const createResult = forkResult.success
                ? { success: true, workspacePath: forkResult.workspacePath }
                : await runtime.createWorkspace({
                    projectPath: parentMeta.projectPath,
                    branchName: workspaceName,
                    trunkBranch,
                    directoryName: workspaceName,
                    initLogger,
                });
            if (!createResult.success || !createResult.workspacePath) {
                initLogger.logComplete(-1);
                return (0, result_1.Err)(`Task.create: failed to create agent workspace (${createResult.error ?? "unknown error"})`);
            }
            const workspacePath = createResult.workspacePath;
            (0, taskQueueDebug_1.taskQueueDebug)("TaskService.create started (workspace created)", {
                taskId,
                workspaceName,
                workspacePath,
                trunkBranch,
                forkSuccess: forkResult.success,
            });
            // Persist workspace entry before starting work so it's durable across crashes.
            await this.config.editConfig((config) => {
                let projectConfig = config.projects.get(parentMeta.projectPath);
                if (!projectConfig) {
                    projectConfig = { workspaces: [] };
                    config.projects.set(parentMeta.projectPath, projectConfig);
                }
                projectConfig.workspaces.push({
                    path: workspacePath,
                    id: taskId,
                    name: workspaceName,
                    title: args.title,
                    createdAt,
                    runtimeConfig: forkedRuntimeConfig,
                    aiSettings: { model: canonicalModel, thinkingLevel: effectiveThinkingLevel },
                    agentId,
                    parentWorkspaceId,
                    agentType,
                    taskStatus: "running",
                    taskTrunkBranch: trunkBranch,
                    taskModelString,
                    taskThinkingLevel: effectiveThinkingLevel,
                    taskExperiments: args.experiments,
                });
                return config;
            });
            // Emit metadata update so the UI sees the workspace immediately.
            await this.emitWorkspaceMetadata(taskId);
            // Kick init (best-effort, async).
            const secrets = (0, secrets_1.secretsToRecord)(this.config.getProjectSecrets(parentMeta.projectPath));
            (0, runtimeFactory_1.runBackgroundInit)(runtimeForTaskWorkspace, {
                projectPath: parentMeta.projectPath,
                branchName: workspaceName,
                trunkBranch,
                workspacePath,
                initLogger,
                env: secrets,
                skipInitHook,
            }, taskId);
            // Start immediately (counts towards parallel limit).
            const sendResult = await this.workspaceService.sendMessage(taskId, prompt, {
                model: taskModelString,
                agentId,
                thinkingLevel: effectiveThinkingLevel,
                experiments: args.experiments,
            });
            if (!sendResult.success) {
                const message = typeof sendResult.error === "string"
                    ? sendResult.error
                    : (0, sendMessageError_1.formatSendMessageError)(sendResult.error).message;
                await this.rollbackFailedTaskCreate(runtimeForTaskWorkspace, parentMeta.projectPath, workspaceName, taskId);
                return (0, result_1.Err)(message);
            }
            return (0, result_1.Ok)({ taskId, kind: "agent", status: "running" });
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            const result_2 = __disposeResources(env_1);
            if (result_2)
                await result_2;
        }
    }
    async terminateDescendantAgentTask(ancestorWorkspaceId, taskId) {
        (0, strict_1.default)(ancestorWorkspaceId.length > 0, "terminateDescendantAgentTask: ancestorWorkspaceId must be non-empty");
        (0, strict_1.default)(taskId.length > 0, "terminateDescendantAgentTask: taskId must be non-empty");
        const terminatedTaskIds = [];
        {
            const env_2 = { stack: [], error: void 0, hasError: false };
            try {
                const _lock = __addDisposableResource(env_2, await this.mutex.acquire(), true);
                const cfg = this.config.loadConfigOrDefault();
                const entry = this.findWorkspaceEntry(cfg, taskId);
                if (!entry?.workspace.parentWorkspaceId) {
                    return (0, result_1.Err)("Task not found");
                }
                const index = this.buildAgentTaskIndex(cfg);
                if (!this.isDescendantAgentTaskUsingParentById(index.parentById, ancestorWorkspaceId, taskId)) {
                    return (0, result_1.Err)("Task is not a descendant of this workspace");
                }
                // Terminate the entire subtree to avoid orphaned descendant tasks.
                const descendants = this.listDescendantAgentTaskIdsFromIndex(index, taskId);
                const toTerminate = Array.from(new Set([taskId, ...descendants]));
                // Delete leaves first to avoid leaving children with missing parents.
                const parentById = index.parentById;
                const depthById = new Map();
                for (const id of toTerminate) {
                    depthById.set(id, this.getTaskDepthFromParentById(parentById, id));
                }
                toTerminate.sort((a, b) => (depthById.get(b) ?? 0) - (depthById.get(a) ?? 0));
                const terminationError = new Error("Task terminated");
                for (const id of toTerminate) {
                    // Best-effort: stop any active stream immediately to avoid further token usage.
                    try {
                        const stopResult = await this.aiService.stopStream(id, { abandonPartial: true });
                        if (!stopResult.success) {
                            log_1.log.debug("terminateDescendantAgentTask: stopStream failed", { taskId: id });
                        }
                    }
                    catch (error) {
                        log_1.log.debug("terminateDescendantAgentTask: stopStream threw", { taskId: id, error });
                    }
                    this.remindedAwaitingReport.delete(id);
                    this.completedReportsByTaskId.delete(id);
                    this.rejectWaiters(id, terminationError);
                    const removeResult = await this.workspaceService.remove(id, true);
                    if (!removeResult.success) {
                        return (0, result_1.Err)(`Failed to remove task workspace (${id}): ${removeResult.error}`);
                    }
                    terminatedTaskIds.push(id);
                }
            }
            catch (e_2) {
                env_2.error = e_2;
                env_2.hasError = true;
            }
            finally {
                const result_3 = __disposeResources(env_2);
                if (result_3)
                    await result_3;
            }
        }
        // Free slots and start any queued tasks (best-effort).
        await this.maybeStartQueuedTasks();
        return (0, result_1.Ok)({ terminatedTaskIds });
    }
    async rollbackFailedTaskCreate(runtime, projectPath, workspaceName, taskId) {
        try {
            await this.config.removeWorkspace(taskId);
        }
        catch (error) {
            log_1.log.error("Task.create rollback: failed to remove workspace from config", {
                taskId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        this.workspaceService.emit("metadata", { workspaceId: taskId, metadata: null });
        try {
            const deleteResult = await runtime.deleteWorkspace(projectPath, workspaceName, true);
            if (!deleteResult.success) {
                log_1.log.error("Task.create rollback: failed to delete workspace", {
                    taskId,
                    error: deleteResult.error,
                });
            }
        }
        catch (error) {
            log_1.log.error("Task.create rollback: runtime.deleteWorkspace threw", {
                taskId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        try {
            const sessionDir = this.config.getSessionDir(taskId);
            await fsPromises.rm(sessionDir, { recursive: true, force: true });
        }
        catch (error) {
            log_1.log.error("Task.create rollback: failed to remove session directory", {
                taskId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    isForegroundAwaiting(workspaceId) {
        const count = this.foregroundAwaitCountByWorkspaceId.get(workspaceId);
        return typeof count === "number" && count > 0;
    }
    startForegroundAwait(workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "startForegroundAwait: workspaceId must be non-empty");
        const current = this.foregroundAwaitCountByWorkspaceId.get(workspaceId) ?? 0;
        (0, strict_1.default)(Number.isInteger(current) && current >= 0, "startForegroundAwait: expected non-negative integer counter");
        this.foregroundAwaitCountByWorkspaceId.set(workspaceId, current + 1);
        return () => {
            const current = this.foregroundAwaitCountByWorkspaceId.get(workspaceId) ?? 0;
            (0, strict_1.default)(Number.isInteger(current) && current > 0, "startForegroundAwait cleanup: expected positive integer counter");
            if (current <= 1) {
                this.foregroundAwaitCountByWorkspaceId.delete(workspaceId);
            }
            else {
                this.foregroundAwaitCountByWorkspaceId.set(workspaceId, current - 1);
            }
        };
    }
    waitForAgentReport(taskId, options) {
        (0, strict_1.default)(taskId.length > 0, "waitForAgentReport: taskId must be non-empty");
        const cached = this.completedReportsByTaskId.get(taskId);
        if (cached) {
            const nowMs = Date.now();
            if (cached.expiresAtMs > nowMs) {
                return Promise.resolve({ reportMarkdown: cached.reportMarkdown, title: cached.title });
            }
            this.completedReportsByTaskId.delete(taskId);
        }
        const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000; // 10 minutes
        (0, strict_1.default)(Number.isFinite(timeoutMs) && timeoutMs > 0, "waitForAgentReport: timeoutMs invalid");
        const requestingWorkspaceId = coerceNonEmptyString(options?.requestingWorkspaceId);
        return new Promise((resolve, reject) => {
            // Validate existence early to avoid waiting on never-resolving task IDs.
            const cfg = this.config.loadConfigOrDefault();
            const taskWorkspaceEntry = this.findWorkspaceEntry(cfg, taskId);
            if (!taskWorkspaceEntry) {
                reject(new Error("Task not found"));
                return;
            }
            let timeout = null;
            let startWaiter = null;
            let abortListener = null;
            let stopBlockingRequester = requestingWorkspaceId
                ? this.startForegroundAwait(requestingWorkspaceId)
                : null;
            const startReportTimeout = () => {
                if (timeout)
                    return;
                timeout = setTimeout(() => {
                    entry.cleanup();
                    reject(new Error("Timed out waiting for agent_report"));
                }, timeoutMs);
            };
            const cleanupStartWaiter = () => {
                if (!startWaiter)
                    return;
                startWaiter.cleanup();
                startWaiter = null;
            };
            const entry = {
                createdAt: Date.now(),
                resolve: (report) => {
                    entry.cleanup();
                    resolve(report);
                },
                reject: (error) => {
                    entry.cleanup();
                    reject(error);
                },
                cleanup: () => {
                    const current = this.pendingWaitersByTaskId.get(taskId);
                    if (current) {
                        const next = current.filter((w) => w !== entry);
                        if (next.length === 0) {
                            this.pendingWaitersByTaskId.delete(taskId);
                        }
                        else {
                            this.pendingWaitersByTaskId.set(taskId, next);
                        }
                    }
                    cleanupStartWaiter();
                    if (timeout) {
                        clearTimeout(timeout);
                        timeout = null;
                    }
                    if (abortListener && options?.abortSignal) {
                        options.abortSignal.removeEventListener("abort", abortListener);
                        abortListener = null;
                    }
                    if (stopBlockingRequester) {
                        try {
                            stopBlockingRequester();
                        }
                        finally {
                            stopBlockingRequester = null;
                        }
                    }
                },
            };
            const list = this.pendingWaitersByTaskId.get(taskId) ?? [];
            list.push(entry);
            this.pendingWaitersByTaskId.set(taskId, list);
            // Don't start the execution timeout while the task is still queued.
            // The timer starts once the child actually begins running (queued -> running).
            const initialStatus = taskWorkspaceEntry.workspace.taskStatus;
            if (initialStatus === "queued") {
                const startWaiterEntry = {
                    createdAt: Date.now(),
                    start: startReportTimeout,
                    cleanup: () => {
                        const currentStartWaiters = this.pendingStartWaitersByTaskId.get(taskId);
                        if (currentStartWaiters) {
                            const next = currentStartWaiters.filter((w) => w !== startWaiterEntry);
                            if (next.length === 0) {
                                this.pendingStartWaitersByTaskId.delete(taskId);
                            }
                            else {
                                this.pendingStartWaitersByTaskId.set(taskId, next);
                            }
                        }
                    },
                };
                startWaiter = startWaiterEntry;
                const currentStartWaiters = this.pendingStartWaitersByTaskId.get(taskId) ?? [];
                currentStartWaiters.push(startWaiterEntry);
                this.pendingStartWaitersByTaskId.set(taskId, currentStartWaiters);
                // Close the race where the task starts between the initial config read and registering the waiter.
                const cfgAfterRegister = this.config.loadConfigOrDefault();
                const afterEntry = this.findWorkspaceEntry(cfgAfterRegister, taskId);
                if (afterEntry?.workspace.taskStatus !== "queued") {
                    cleanupStartWaiter();
                    startReportTimeout();
                }
                // If the awaited task is queued and the caller is blocked in the foreground, ensure the
                // scheduler runs after the waiter is registered. This avoids deadlocks when
                // maxParallelAgentTasks is low.
                if (requestingWorkspaceId) {
                    void this.maybeStartQueuedTasks();
                }
            }
            else {
                startReportTimeout();
            }
            if (options?.abortSignal) {
                if (options.abortSignal.aborted) {
                    entry.cleanup();
                    reject(new Error("Interrupted"));
                    return;
                }
                abortListener = () => {
                    entry.cleanup();
                    reject(new Error("Interrupted"));
                };
                options.abortSignal.addEventListener("abort", abortListener, { once: true });
            }
        });
    }
    getAgentTaskStatus(taskId) {
        (0, strict_1.default)(taskId.length > 0, "getAgentTaskStatus: taskId must be non-empty");
        const cfg = this.config.loadConfigOrDefault();
        const entry = this.findWorkspaceEntry(cfg, taskId);
        const status = entry?.workspace.taskStatus;
        return status ?? null;
    }
    hasActiveDescendantAgentTasksForWorkspace(workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "hasActiveDescendantAgentTasksForWorkspace: workspaceId must be non-empty");
        const cfg = this.config.loadConfigOrDefault();
        return this.hasActiveDescendantAgentTasks(cfg, workspaceId);
    }
    listActiveDescendantAgentTaskIds(workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "listActiveDescendantAgentTaskIds: workspaceId must be non-empty");
        const cfg = this.config.loadConfigOrDefault();
        const index = this.buildAgentTaskIndex(cfg);
        const activeStatuses = new Set(["queued", "running", "awaiting_report"]);
        const result = [];
        const stack = [...(index.childrenByParent.get(workspaceId) ?? [])];
        while (stack.length > 0) {
            const next = stack.pop();
            const status = index.byId.get(next)?.taskStatus;
            if (status && activeStatuses.has(status)) {
                result.push(next);
            }
            const children = index.childrenByParent.get(next);
            if (children) {
                for (const child of children) {
                    stack.push(child);
                }
            }
        }
        return result;
    }
    listDescendantAgentTasks(workspaceId, options) {
        (0, strict_1.default)(workspaceId.length > 0, "listDescendantAgentTasks: workspaceId must be non-empty");
        const statuses = options?.statuses;
        const statusFilter = statuses && statuses.length > 0 ? new Set(statuses) : null;
        const cfg = this.config.loadConfigOrDefault();
        const index = this.buildAgentTaskIndex(cfg);
        const result = [];
        const stack = [];
        for (const childTaskId of index.childrenByParent.get(workspaceId) ?? []) {
            stack.push({ taskId: childTaskId, depth: 1 });
        }
        while (stack.length > 0) {
            const next = stack.pop();
            const entry = index.byId.get(next.taskId);
            if (!entry)
                continue;
            (0, strict_1.default)(entry.parentWorkspaceId, `listDescendantAgentTasks: task ${next.taskId} is missing parentWorkspaceId`);
            const status = entry.taskStatus ?? "running";
            if (!statusFilter || statusFilter.has(status)) {
                result.push({
                    taskId: next.taskId,
                    status,
                    parentWorkspaceId: entry.parentWorkspaceId,
                    agentType: entry.agentType,
                    workspaceName: entry.name,
                    title: entry.title,
                    createdAt: entry.createdAt,
                    modelString: entry.aiSettings?.model,
                    thinkingLevel: entry.aiSettings?.thinkingLevel,
                    depth: next.depth,
                });
            }
            for (const childTaskId of index.childrenByParent.get(next.taskId) ?? []) {
                stack.push({ taskId: childTaskId, depth: next.depth + 1 });
            }
        }
        // Stable ordering: oldest first, then depth (ties by taskId for determinism).
        result.sort((a, b) => {
            const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
            const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
            if (aTime !== bTime)
                return aTime - bTime;
            if (a.depth !== b.depth)
                return a.depth - b.depth;
            return a.taskId.localeCompare(b.taskId);
        });
        return result;
    }
    filterDescendantAgentTaskIds(ancestorWorkspaceId, taskIds) {
        (0, strict_1.default)(ancestorWorkspaceId.length > 0, "filterDescendantAgentTaskIds: ancestorWorkspaceId required");
        (0, strict_1.default)(Array.isArray(taskIds), "filterDescendantAgentTaskIds: taskIds must be an array");
        const cfg = this.config.loadConfigOrDefault();
        const parentById = this.buildAgentTaskIndex(cfg).parentById;
        const nowMs = Date.now();
        this.cleanupExpiredCompletedReports(nowMs);
        const result = [];
        for (const taskId of taskIds) {
            if (typeof taskId !== "string" || taskId.length === 0)
                continue;
            if (this.isDescendantAgentTaskUsingParentById(parentById, ancestorWorkspaceId, taskId)) {
                result.push(taskId);
                continue;
            }
            // Preserve scope checks for tasks whose workspace was cleaned up after completion.
            const cached = this.completedReportsByTaskId.get(taskId);
            if (cached && cached.expiresAtMs > nowMs) {
                if (cached.ancestorWorkspaceIds.includes(ancestorWorkspaceId)) {
                    result.push(taskId);
                }
            }
        }
        return result;
    }
    listDescendantAgentTaskIdsFromIndex(index, workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "listDescendantAgentTaskIdsFromIndex: workspaceId must be non-empty");
        const result = [];
        const stack = [...(index.childrenByParent.get(workspaceId) ?? [])];
        while (stack.length > 0) {
            const next = stack.pop();
            result.push(next);
            const children = index.childrenByParent.get(next);
            if (children) {
                for (const child of children) {
                    stack.push(child);
                }
            }
        }
        return result;
    }
    isDescendantAgentTask(ancestorWorkspaceId, taskId) {
        (0, strict_1.default)(ancestorWorkspaceId.length > 0, "isDescendantAgentTask: ancestorWorkspaceId required");
        (0, strict_1.default)(taskId.length > 0, "isDescendantAgentTask: taskId required");
        const cfg = this.config.loadConfigOrDefault();
        const parentById = this.buildAgentTaskIndex(cfg).parentById;
        if (this.isDescendantAgentTaskUsingParentById(parentById, ancestorWorkspaceId, taskId)) {
            return true;
        }
        // The task workspace may have been removed after it reported (cleanup). Preserve scope checks
        // by consulting the completed-report cache, which tracks the task's ancestor chain.
        const nowMs = Date.now();
        this.cleanupExpiredCompletedReports(nowMs);
        const cached = this.completedReportsByTaskId.get(taskId);
        if (cached && cached.expiresAtMs > nowMs) {
            return cached.ancestorWorkspaceIds.includes(ancestorWorkspaceId);
        }
        return false;
    }
    isDescendantAgentTaskUsingParentById(parentById, ancestorWorkspaceId, taskId) {
        let current = taskId;
        for (let i = 0; i < 32; i++) {
            const parent = parentById.get(current);
            if (!parent)
                return false;
            if (parent === ancestorWorkspaceId)
                return true;
            current = parent;
        }
        throw new Error(`isDescendantAgentTaskUsingParentById: possible parentWorkspaceId cycle starting at ${taskId}`);
    }
    // --- Internal orchestration ---
    listAncestorWorkspaceIdsUsingParentById(parentById, taskId) {
        const ancestors = [];
        let current = taskId;
        for (let i = 0; i < 32; i++) {
            const parent = parentById.get(current);
            if (!parent)
                return ancestors;
            ancestors.push(parent);
            current = parent;
        }
        throw new Error(`listAncestorWorkspaceIdsUsingParentById: possible parentWorkspaceId cycle starting at ${taskId}`);
    }
    listAgentTaskWorkspaces(config) {
        const tasks = [];
        for (const [projectPath, project] of config.projects) {
            for (const workspace of project.workspaces) {
                if (!workspace.id)
                    continue;
                if (!workspace.parentWorkspaceId)
                    continue;
                tasks.push({ ...workspace, projectPath });
            }
        }
        return tasks;
    }
    buildAgentTaskIndex(config) {
        const byId = new Map();
        const childrenByParent = new Map();
        const parentById = new Map();
        for (const task of this.listAgentTaskWorkspaces(config)) {
            const taskId = task.id;
            byId.set(taskId, task);
            const parent = task.parentWorkspaceId;
            if (!parent)
                continue;
            parentById.set(taskId, parent);
            const list = childrenByParent.get(parent) ?? [];
            list.push(taskId);
            childrenByParent.set(parent, list);
        }
        return { byId, childrenByParent, parentById };
    }
    countActiveAgentTasks(config) {
        let activeCount = 0;
        for (const task of this.listAgentTaskWorkspaces(config)) {
            const status = task.taskStatus ?? "running";
            // If this task workspace is blocked in a foreground wait, do not count it towards parallelism.
            // This prevents deadlocks where a task spawns a nested task in the foreground while
            // maxParallelAgentTasks is low (e.g. 1).
            // Note: StreamManager can still report isStreaming() while a tool call is executing, so
            // isStreaming is not a reliable signal for "actively doing work" here.
            if (status === "running" && task.id && this.isForegroundAwaiting(task.id)) {
                continue;
            }
            if (status === "running" || status === "awaiting_report") {
                activeCount += 1;
                continue;
            }
            // Defensive: a task may still be streaming even after it transitioned to another status
            // (e.g. tool-call-end happened but the stream hasn't ended yet). Count it as active so we
            // never exceed the configured parallel limit.
            if (task.id && this.aiService.isStreaming(task.id)) {
                activeCount += 1;
            }
        }
        return activeCount;
    }
    hasActiveDescendantAgentTasks(config, workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "hasActiveDescendantAgentTasks: workspaceId must be non-empty");
        const index = this.buildAgentTaskIndex(config);
        const activeStatuses = new Set(["queued", "running", "awaiting_report"]);
        const stack = [...(index.childrenByParent.get(workspaceId) ?? [])];
        while (stack.length > 0) {
            const next = stack.pop();
            const status = index.byId.get(next)?.taskStatus;
            if (status && activeStatuses.has(status)) {
                return true;
            }
            const children = index.childrenByParent.get(next);
            if (children) {
                for (const child of children) {
                    stack.push(child);
                }
            }
        }
        return false;
    }
    getTaskDepth(config, workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "getTaskDepth: workspaceId must be non-empty");
        return this.getTaskDepthFromParentById(this.buildAgentTaskIndex(config).parentById, workspaceId);
    }
    getTaskDepthFromParentById(parentById, workspaceId) {
        let depth = 0;
        let current = workspaceId;
        for (let i = 0; i < 32; i++) {
            const parent = parentById.get(current);
            if (!parent)
                break;
            depth += 1;
            current = parent;
        }
        if (depth >= 32) {
            throw new Error(`getTaskDepthFromParentById: possible parentWorkspaceId cycle starting at ${workspaceId}`);
        }
        return depth;
    }
    async maybeStartQueuedTasks() {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const _lock = __addDisposableResource(env_3, await this.mutex.acquire(), true);
            const configAtStart = this.config.loadConfigOrDefault();
            const taskSettingsAtStart = configAtStart.taskSettings ?? tasks_1.DEFAULT_TASK_SETTINGS;
            const activeCount = this.countActiveAgentTasks(configAtStart);
            const availableSlots = Math.max(0, taskSettingsAtStart.maxParallelAgentTasks - activeCount);
            (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks summary", {
                activeCount,
                maxParallelAgentTasks: taskSettingsAtStart.maxParallelAgentTasks,
                availableSlots,
            });
            if (availableSlots === 0)
                return;
            const queuedTaskIds = this.listAgentTaskWorkspaces(configAtStart)
                .filter((t) => t.taskStatus === "queued" && typeof t.id === "string")
                .sort((a, b) => {
                const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
                const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
                return aTime - bTime;
            })
                .map((t) => t.id);
            (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks candidates", {
                queuedCount: queuedTaskIds.length,
                queuedIds: queuedTaskIds,
            });
            for (const taskId of queuedTaskIds) {
                const config = this.config.loadConfigOrDefault();
                const taskSettings = config.taskSettings ?? tasks_1.DEFAULT_TASK_SETTINGS;
                (0, strict_1.default)(Number.isFinite(taskSettings.maxParallelAgentTasks) &&
                    taskSettings.maxParallelAgentTasks > 0, "TaskService.maybeStartQueuedTasks: maxParallelAgentTasks must be a positive number");
                const activeCount = this.countActiveAgentTasks(config);
                if (activeCount >= taskSettings.maxParallelAgentTasks) {
                    break;
                }
                const taskEntry = this.findWorkspaceEntry(config, taskId);
                if (!taskEntry?.workspace.parentWorkspaceId)
                    continue;
                const task = taskEntry.workspace;
                if (task.taskStatus !== "queued")
                    continue;
                // Defensive: tasks can begin streaming before taskStatus flips to "running".
                if (this.aiService.isStreaming(taskId)) {
                    (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks queued-but-streaming; marking running", {
                        taskId,
                    });
                    await this.setTaskStatus(taskId, "running");
                    continue;
                }
                (0, strict_1.default)(typeof task.name === "string" && task.name.trim().length > 0, "Task name missing");
                const parentId = coerceNonEmptyString(task.parentWorkspaceId);
                if (!parentId) {
                    log_1.log.error("Queued task missing parentWorkspaceId; cannot start", { taskId });
                    continue;
                }
                const parentEntry = this.findWorkspaceEntry(config, parentId);
                if (!parentEntry) {
                    log_1.log.error("Queued task parent not found; cannot start", { taskId, parentId });
                    continue;
                }
                const parentWorkspaceName = coerceNonEmptyString(parentEntry.workspace.name);
                if (!parentWorkspaceName) {
                    log_1.log.error("Queued task parent missing workspace name; cannot start", {
                        taskId,
                        parentId,
                    });
                    continue;
                }
                const taskRuntimeConfig = task.runtimeConfig ?? parentEntry.workspace.runtimeConfig;
                if (!taskRuntimeConfig) {
                    log_1.log.error("Queued task missing runtimeConfig; cannot start", { taskId });
                    continue;
                }
                const parentRuntimeConfig = parentEntry.workspace.runtimeConfig ?? taskRuntimeConfig;
                const workspaceName = task.name.trim();
                const runtime = (0, runtimeHelpers_1.createRuntimeForWorkspace)({
                    runtimeConfig: taskRuntimeConfig,
                    projectPath: taskEntry.projectPath,
                    name: workspaceName,
                });
                let runtimeForTaskWorkspace = runtime;
                let forkedRuntimeConfig = taskRuntimeConfig;
                let workspacePath = coerceNonEmptyString(task.path) ??
                    runtime.getWorkspacePath(taskEntry.projectPath, workspaceName);
                let workspaceExists = false;
                try {
                    await runtime.stat(workspacePath);
                    workspaceExists = true;
                }
                catch {
                    workspaceExists = false;
                }
                const inMemoryInit = this.initStateManager.getInitState(taskId);
                const persistedInit = inMemoryInit
                    ? null
                    : await this.initStateManager.readInitStatus(taskId);
                // Re-check capacity after awaiting IO to avoid dequeuing work (worktree creation/init) when
                // another task became active in the meantime.
                const latestConfig = this.config.loadConfigOrDefault();
                const latestTaskSettings = latestConfig.taskSettings ?? tasks_1.DEFAULT_TASK_SETTINGS;
                const latestActiveCount = this.countActiveAgentTasks(latestConfig);
                if (latestActiveCount >= latestTaskSettings.maxParallelAgentTasks) {
                    (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks became full mid-loop", {
                        taskId,
                        activeCount: latestActiveCount,
                        maxParallelAgentTasks: latestTaskSettings.maxParallelAgentTasks,
                    });
                    break;
                }
                // Ensure the workspace exists before starting. Queued tasks should not create worktrees/directories
                // until they are actually dequeued.
                let trunkBranch = typeof task.taskTrunkBranch === "string" && task.taskTrunkBranch.trim().length > 0
                    ? task.taskTrunkBranch.trim()
                    : parentWorkspaceName;
                if (trunkBranch.length === 0) {
                    trunkBranch = "main";
                }
                let shouldRunInit = !inMemoryInit && !persistedInit;
                let initLogger = null;
                const getInitLogger = () => {
                    if (initLogger)
                        return initLogger;
                    initLogger = this.startWorkspaceInit(taskId, taskEntry.projectPath);
                    return initLogger;
                };
                (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks start attempt", {
                    taskId,
                    workspaceName,
                    parentId,
                    parentWorkspaceName,
                    runtimeType: taskRuntimeConfig.type,
                    workspacePath,
                    workspaceExists,
                    trunkBranch,
                    shouldRunInit,
                    inMemoryInit: Boolean(inMemoryInit),
                    persistedInit: Boolean(persistedInit),
                });
                // If the workspace doesn't exist yet, create it now (fork preferred, else createWorkspace).
                if (!workspaceExists) {
                    shouldRunInit = true;
                    const initLogger = getInitLogger();
                    const forkResult = await runtime.forkWorkspace({
                        projectPath: taskEntry.projectPath,
                        sourceWorkspaceName: parentWorkspaceName,
                        newWorkspaceName: workspaceName,
                        initLogger,
                    });
                    const { forkedRuntimeConfig: resolvedForkedRuntimeConfig } = await (0, forkRuntimeUpdates_1.applyForkRuntimeUpdates)(this.config, parentId, parentRuntimeConfig, forkResult);
                    forkedRuntimeConfig = resolvedForkedRuntimeConfig;
                    if (forkResult.sourceRuntimeConfig) {
                        // Ensure UI gets the updated runtimeConfig for the parent workspace.
                        await this.emitWorkspaceMetadata(parentId);
                    }
                    runtimeForTaskWorkspace = (0, runtimeFactory_1.createRuntime)(forkedRuntimeConfig, {
                        projectPath: taskEntry.projectPath,
                        workspaceName,
                    });
                    trunkBranch = forkResult.success ? (forkResult.sourceBranch ?? trunkBranch) : trunkBranch;
                    const createResult = forkResult.success
                        ? { success: true, workspacePath: forkResult.workspacePath }
                        : await runtime.createWorkspace({
                            projectPath: taskEntry.projectPath,
                            branchName: workspaceName,
                            trunkBranch,
                            directoryName: workspaceName,
                            initLogger,
                        });
                    if (!createResult.success || !createResult.workspacePath) {
                        initLogger.logComplete(-1);
                        const errorMessage = createResult.error ?? "unknown error";
                        log_1.log.error("Failed to create queued task workspace", { taskId, error: errorMessage });
                        (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks createWorkspace failed", {
                            taskId,
                            error: errorMessage,
                            forkSuccess: forkResult.success,
                        });
                        continue;
                    }
                    workspacePath = createResult.workspacePath;
                    workspaceExists = true;
                    (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks workspace created", {
                        taskId,
                        workspacePath,
                        forkSuccess: forkResult.success,
                        trunkBranch,
                    });
                    // Persist any corrected path/trunkBranch for restart-safe init.
                    await this.editWorkspaceEntry(taskId, (ws) => {
                        ws.path = workspacePath;
                        ws.taskTrunkBranch = trunkBranch;
                        ws.runtimeConfig = forkedRuntimeConfig;
                    }, { allowMissing: true });
                }
                // If init has not yet run for this workspace, start it now (best-effort, async).
                // This is intentionally coupled to task start so queued tasks don't run init hooks
                // (SSH sync, .unix/init scripts, etc.) until they actually begin execution.
                if (shouldRunInit) {
                    const initLogger = getInitLogger();
                    (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks initWorkspace starting", {
                        taskId,
                        workspacePath,
                        trunkBranch,
                    });
                    const secrets = (0, secrets_1.secretsToRecord)(this.config.getProjectSecrets(taskEntry.projectPath));
                    let skipInitHook = false;
                    const agentIdRaw = coerceNonEmptyString(task.agentId ?? task.agentType);
                    if (agentIdRaw) {
                        const parsedAgentId = schemas_1.AgentIdSchema.safeParse(agentIdRaw.trim().toLowerCase());
                        if (parsedAgentId.success) {
                            const isInPlace = taskEntry.projectPath === parentWorkspaceName;
                            const parentWorkspacePath = coerceNonEmptyString(parentEntry.workspace.path) ??
                                (isInPlace
                                    ? taskEntry.projectPath
                                    : runtime.getWorkspacePath(taskEntry.projectPath, parentWorkspaceName));
                            try {
                                const definition = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, parentWorkspacePath, parsedAgentId.data);
                                skipInitHook = definition.frontmatter.subagent?.skip_init_hook === true;
                            }
                            catch (error) {
                                log_1.log.debug("Queued task: failed to read agent definition for skip_init_hook", {
                                    taskId,
                                    agentId: parsedAgentId.data,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                            }
                        }
                    }
                    (0, runtimeFactory_1.runBackgroundInit)(runtimeForTaskWorkspace, {
                        projectPath: taskEntry.projectPath,
                        branchName: workspaceName,
                        trunkBranch,
                        workspacePath,
                        initLogger,
                        env: secrets,
                        skipInitHook,
                    }, taskId);
                }
                const model = task.taskModelString ?? models_1.defaultModel;
                const queuedPrompt = coerceNonEmptyString(task.taskPrompt);
                if (queuedPrompt) {
                    (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks sendMessage starting (dequeue)", {
                        taskId,
                        model,
                        promptLength: queuedPrompt.length,
                    });
                    const sendResult = await this.workspaceService.sendMessage(taskId, queuedPrompt, {
                        model,
                        agentId: task.agentId ?? workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
                        thinkingLevel: task.taskThinkingLevel,
                        experiments: task.taskExperiments,
                    }, { allowQueuedAgentTask: true });
                    if (!sendResult.success) {
                        log_1.log.error("Failed to start queued task via sendMessage", {
                            taskId,
                            error: sendResult.error,
                        });
                        continue;
                    }
                }
                else {
                    // Backward compatibility: older queued tasks persisted their prompt in chat history.
                    (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks resumeStream starting (legacy dequeue)", {
                        taskId,
                        model,
                    });
                    const resumeResult = await this.workspaceService.resumeStream(taskId, {
                        model,
                        agentId: task.agentId ?? workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
                        thinkingLevel: task.taskThinkingLevel,
                        experiments: task.taskExperiments,
                    }, { allowQueuedAgentTask: true });
                    if (!resumeResult.success) {
                        log_1.log.error("Failed to start queued task", { taskId, error: resumeResult.error });
                        (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks resumeStream failed", {
                            taskId,
                            error: resumeResult.error,
                        });
                        continue;
                    }
                }
                await this.setTaskStatus(taskId, "running");
                (0, taskQueueDebug_1.taskQueueDebug)("TaskService.maybeStartQueuedTasks started", { taskId });
            }
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            const result_4 = __disposeResources(env_3);
            if (result_4)
                await result_4;
        }
    }
    async setTaskStatus(workspaceId, status) {
        (0, strict_1.default)(workspaceId.length > 0, "setTaskStatus: workspaceId must be non-empty");
        await this.editWorkspaceEntry(workspaceId, (ws) => {
            ws.taskStatus = status;
            if (status === "running") {
                ws.taskPrompt = undefined;
            }
        });
        await this.emitWorkspaceMetadata(workspaceId);
        if (status === "running") {
            const waiters = this.pendingStartWaitersByTaskId.get(workspaceId);
            if (!waiters || waiters.length === 0)
                return;
            this.pendingStartWaitersByTaskId.delete(workspaceId);
            for (const waiter of waiters) {
                try {
                    waiter.start();
                }
                catch (error) {
                    log_1.log.error("Task start waiter callback failed", { workspaceId, error });
                }
            }
        }
    }
    async handleStreamEnd(event) {
        const workspaceId = event.workspaceId;
        const cfg = this.config.loadConfigOrDefault();
        const entry = this.findWorkspaceEntry(cfg, workspaceId);
        if (!entry)
            return;
        // Parent workspaces must not end while they have active background tasks.
        // Enforce by auto-resuming the stream with a directive to await outstanding tasks.
        if (!entry.workspace.parentWorkspaceId) {
            const hasActiveDescendants = this.hasActiveDescendantAgentTasks(cfg, workspaceId);
            if (!hasActiveDescendants) {
                return;
            }
            if (this.aiService.isStreaming(workspaceId)) {
                return;
            }
            const activeTaskIds = this.listActiveDescendantAgentTaskIds(workspaceId);
            const parentAgentId = entry.workspace.agentId ?? workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId;
            const parentAiSettings = this.resolveWorkspaceAISettings(entry.workspace, parentAgentId);
            const model = parentAiSettings?.model ?? models_1.defaultModel;
            const resumeResult = await this.workspaceService.resumeStream(workspaceId, {
                model,
                agentId: parentAgentId,
                thinkingLevel: parentAiSettings?.thinkingLevel,
                additionalSystemInstructions: `You have active background sub-agent task(s) (${activeTaskIds.join(", ")}). ` +
                    "You MUST NOT end your turn while any sub-agent tasks are queued/running/awaiting_report. " +
                    "Call task_await now to wait for them to finish (omit timeout_secs to wait up to 10 minutes). " +
                    "If any tasks are still queued/running/awaiting_report after that, call task_await again. " +
                    "Only once all tasks are completed should you write your final response, integrating their reports.",
            });
            if (!resumeResult.success) {
                log_1.log.error("Failed to resume parent with active background tasks", {
                    workspaceId,
                    error: resumeResult.error,
                });
            }
            return;
        }
        const status = entry.workspace.taskStatus;
        if (status === "reported")
            return;
        // Never allow a task to finish/report while it still has active descendant tasks.
        // We'll auto-resume this task once the last descendant reports.
        const hasActiveDescendants = this.hasActiveDescendantAgentTasks(cfg, workspaceId);
        if (hasActiveDescendants) {
            if (status === "awaiting_report") {
                await this.setTaskStatus(workspaceId, "running");
            }
            return;
        }
        const reportArgs = this.findAgentReportArgsInParts(event.parts);
        if (reportArgs) {
            await this.finalizeAgentTaskReport(workspaceId, entry, reportArgs);
            return;
        }
        // If a task stream ends without agent_report, request it once.
        if (status === "awaiting_report" && this.remindedAwaitingReport.has(workspaceId)) {
            await this.fallbackReportMissingAgentReport(entry);
            return;
        }
        await this.setTaskStatus(workspaceId, "awaiting_report");
        this.remindedAwaitingReport.add(workspaceId);
        const model = entry.workspace.taskModelString ?? models_1.defaultModel;
        await this.workspaceService.sendMessage(workspaceId, "Your stream ended without calling agent_report. Call agent_report exactly once now with your final report.", {
            model,
            agentId: entry.workspace.agentId ?? workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
            thinkingLevel: entry.workspace.taskThinkingLevel,
            toolPolicy: [{ regex_match: "^agent_report$", action: "require" }],
        });
    }
    async fallbackReportMissingAgentReport(entry) {
        const childWorkspaceId = entry.workspace.id;
        const parentWorkspaceId = entry.workspace.parentWorkspaceId;
        if (!childWorkspaceId || !parentWorkspaceId) {
            return;
        }
        const agentType = entry.workspace.agentType ?? "agent";
        const lastText = await this.readLatestAssistantText(childWorkspaceId);
        const reportMarkdown = "*(Note: this agent task did not call `agent_report`; " +
            "posting its last assistant output as a fallback.)*\n\n" +
            (lastText?.trim().length ? lastText : "(No assistant output found.)");
        // Notify clients immediately even if we can't delete the workspace yet.
        await this.editWorkspaceEntry(childWorkspaceId, (ws) => {
            ws.taskStatus = "reported";
            ws.reportedAt = getIsoNow();
        }, { allowMissing: true });
        await this.emitWorkspaceMetadata(childWorkspaceId);
        await this.deliverReportToParent(parentWorkspaceId, entry, {
            reportMarkdown,
            title: `Subagent (${agentType}) report (fallback)`,
        });
        this.resolveWaiters(childWorkspaceId, {
            reportMarkdown,
            title: `Subagent (${agentType}) report (fallback)`,
        });
        await this.maybeStartQueuedTasks();
        await this.cleanupReportedLeafTask(childWorkspaceId);
        const postCfg = this.config.loadConfigOrDefault();
        const hasActiveDescendants = this.hasActiveDescendantAgentTasks(postCfg, parentWorkspaceId);
        if (!hasActiveDescendants && !this.aiService.isStreaming(parentWorkspaceId)) {
            const resumeResult = await this.workspaceService.resumeStream(parentWorkspaceId, {
                model: entry.workspace.taskModelString ?? models_1.defaultModel,
                agentId: workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
            });
            if (!resumeResult.success) {
                log_1.log.error("Failed to auto-resume parent after fallback report", {
                    parentWorkspaceId,
                    error: resumeResult.error,
                });
            }
        }
    }
    async readLatestAssistantText(workspaceId) {
        const partial = await this.partialService.readPartial(workspaceId);
        if (partial && partial.role === "assistant") {
            const text = this.concatTextParts(partial).trim();
            if (text.length > 0)
                return text;
        }
        const historyResult = await this.historyService.getHistory(workspaceId);
        if (!historyResult.success) {
            log_1.log.error("Failed to read history for fallback report", {
                workspaceId,
                error: historyResult.error,
            });
            return null;
        }
        const ordered = [...historyResult.data].sort((a, b) => {
            const aSeq = a.metadata?.historySequence ?? -1;
            const bSeq = b.metadata?.historySequence ?? -1;
            return aSeq - bSeq;
        });
        for (let i = ordered.length - 1; i >= 0; i--) {
            const msg = ordered[i];
            if (msg?.role !== "assistant")
                continue;
            const text = this.concatTextParts(msg).trim();
            if (text.length > 0)
                return text;
        }
        return null;
    }
    concatTextParts(msg) {
        let combined = "";
        for (const part of msg.parts) {
            if (!part || typeof part !== "object")
                continue;
            const maybeText = part;
            if (maybeText.type !== "text")
                continue;
            if (typeof maybeText.text !== "string")
                continue;
            combined += maybeText.text;
        }
        return combined;
    }
    async handleAgentReport(event) {
        const childWorkspaceId = event.workspaceId;
        if (!isSuccessfulToolResult(event.result)) {
            return;
        }
        const cfgBeforeReport = this.config.loadConfigOrDefault();
        const childEntryBeforeReport = this.findWorkspaceEntry(cfgBeforeReport, childWorkspaceId);
        if (childEntryBeforeReport?.workspace.taskStatus === "reported") {
            return;
        }
        if (this.hasActiveDescendantAgentTasks(cfgBeforeReport, childWorkspaceId)) {
            log_1.log.error("agent_report called while task has active descendants; ignoring", {
                childWorkspaceId,
            });
            return;
        }
        // Read report payload from the tool-call input (persisted in partial/history).
        const reportArgs = await this.readLatestAgentReportArgs(childWorkspaceId);
        if (!reportArgs) {
            log_1.log.error("agent_report tool-call args not found", { childWorkspaceId });
            return;
        }
        await this.finalizeAgentTaskReport(childWorkspaceId, childEntryBeforeReport, reportArgs, {
            stopStream: true,
        });
    }
    async finalizeAgentTaskReport(childWorkspaceId, childEntry, reportArgs, options) {
        (0, strict_1.default)(childWorkspaceId.length > 0, "finalizeAgentTaskReport: childWorkspaceId must be non-empty");
        (0, strict_1.default)(typeof reportArgs.reportMarkdown === "string" && reportArgs.reportMarkdown.length > 0, "finalizeAgentTaskReport: reportMarkdown must be non-empty");
        const cfgBeforeReport = this.config.loadConfigOrDefault();
        const statusBefore = this.findWorkspaceEntry(cfgBeforeReport, childWorkspaceId)?.workspace
            .taskStatus;
        if (statusBefore === "reported") {
            return;
        }
        // Notify clients immediately even if we can't delete the workspace yet.
        await this.editWorkspaceEntry(childWorkspaceId, (ws) => {
            ws.taskStatus = "reported";
            ws.reportedAt = getIsoNow();
        }, { allowMissing: true });
        await this.emitWorkspaceMetadata(childWorkspaceId);
        if (options?.stopStream) {
            // `agent_report` is terminal. Stop the child stream immediately to prevent any further token
            // usage and to ensure parallelism accounting never "frees" a slot while the stream is still
            // active (Claude/Anthropic can emit tool calls before the final assistant block completes).
            try {
                const stopResult = await this.aiService.stopStream(childWorkspaceId, {
                    abandonPartial: true,
                });
                if (!stopResult.success) {
                    log_1.log.debug("Failed to stop task stream after agent_report", {
                        workspaceId: childWorkspaceId,
                        error: stopResult.error,
                    });
                }
            }
            catch (error) {
                log_1.log.debug("Failed to stop task stream after agent_report (threw)", {
                    workspaceId: childWorkspaceId,
                    error,
                });
            }
        }
        const cfgAfterReport = this.config.loadConfigOrDefault();
        const latestChildEntry = this.findWorkspaceEntry(cfgAfterReport, childWorkspaceId) ?? childEntry;
        const parentWorkspaceId = latestChildEntry?.workspace.parentWorkspaceId;
        if (!parentWorkspaceId) {
            const reason = latestChildEntry
                ? "missing parentWorkspaceId"
                : "workspace not found in config";
            log_1.log.debug("Ignoring agent_report: workspace is not an agent task", {
                childWorkspaceId,
                reason,
            });
            // Best-effort: resolve any foreground waiters even if we can't deliver to a parent.
            this.resolveWaiters(childWorkspaceId, reportArgs);
            void this.maybeStartQueuedTasks();
            return;
        }
        await this.deliverReportToParent(parentWorkspaceId, latestChildEntry, reportArgs);
        // Resolve foreground waiters.
        this.resolveWaiters(childWorkspaceId, reportArgs);
        // Free slot and start queued tasks.
        await this.maybeStartQueuedTasks();
        // Attempt cleanup of reported tasks (leaf-first).
        await this.cleanupReportedLeafTask(childWorkspaceId);
        // Auto-resume any parent stream that was waiting on a task tool call (restart-safe).
        const postCfg = this.config.loadConfigOrDefault();
        if (!this.findWorkspaceEntry(postCfg, parentWorkspaceId)) {
            // Parent may have been cleaned up (e.g. it already reported and this was its last descendant).
            return;
        }
        const hasActiveDescendants = this.hasActiveDescendantAgentTasks(postCfg, parentWorkspaceId);
        if (!hasActiveDescendants && !this.aiService.isStreaming(parentWorkspaceId)) {
            const resumeResult = await this.workspaceService.resumeStream(parentWorkspaceId, {
                model: latestChildEntry?.workspace.taskModelString ?? models_1.defaultModel,
                agentId: workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
            });
            if (!resumeResult.success) {
                log_1.log.error("Failed to auto-resume parent after agent_report", {
                    parentWorkspaceId,
                    error: resumeResult.error,
                });
            }
        }
    }
    cleanupExpiredCompletedReports(nowMs = Date.now()) {
        for (const [taskId, entry] of this.completedReportsByTaskId) {
            if (entry.expiresAtMs <= nowMs) {
                this.completedReportsByTaskId.delete(taskId);
            }
        }
    }
    enforceCompletedReportCacheLimit() {
        while (this.completedReportsByTaskId.size > COMPLETED_REPORT_CACHE_MAX_ENTRIES) {
            const first = this.completedReportsByTaskId.keys().next();
            if (first.done)
                break;
            this.completedReportsByTaskId.delete(first.value);
        }
    }
    resolveWaiters(taskId, report) {
        const nowMs = Date.now();
        this.cleanupExpiredCompletedReports(nowMs);
        const cfg = this.config.loadConfigOrDefault();
        const parentById = this.buildAgentTaskIndex(cfg).parentById;
        const ancestorWorkspaceIds = this.listAncestorWorkspaceIdsUsingParentById(parentById, taskId);
        this.completedReportsByTaskId.set(taskId, {
            reportMarkdown: report.reportMarkdown,
            title: report.title,
            expiresAtMs: nowMs + COMPLETED_REPORT_CACHE_TTL_MS,
            ancestorWorkspaceIds,
        });
        this.enforceCompletedReportCacheLimit();
        const waiters = this.pendingWaitersByTaskId.get(taskId);
        if (!waiters || waiters.length === 0) {
            return;
        }
        this.pendingWaitersByTaskId.delete(taskId);
        for (const waiter of waiters) {
            try {
                waiter.cleanup();
                waiter.resolve(report);
            }
            catch {
                // ignore
            }
        }
    }
    rejectWaiters(taskId, error) {
        const waiters = this.pendingWaitersByTaskId.get(taskId);
        if (!waiters || waiters.length === 0) {
            return;
        }
        for (const waiter of [...waiters]) {
            try {
                waiter.reject(error);
            }
            catch (rejectError) {
                log_1.log.error("Task waiter reject callback failed", { taskId, error: rejectError });
            }
        }
    }
    async readLatestAgentReportArgs(workspaceId) {
        const partial = await this.partialService.readPartial(workspaceId);
        if (partial) {
            const args = this.findAgentReportArgsInMessage(partial);
            if (args)
                return args;
        }
        const historyResult = await this.historyService.getHistory(workspaceId);
        if (!historyResult.success) {
            log_1.log.error("Failed to read history for agent_report args", {
                workspaceId,
                error: historyResult.error,
            });
            return null;
        }
        // Scan newest-first.
        const ordered = [...historyResult.data].sort((a, b) => {
            const aSeq = a.metadata?.historySequence ?? -1;
            const bSeq = b.metadata?.historySequence ?? -1;
            return bSeq - aSeq;
        });
        for (const msg of ordered) {
            const args = this.findAgentReportArgsInMessage(msg);
            if (args)
                return args;
        }
        return null;
    }
    findAgentReportArgsInParts(parts) {
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            if (!(0, toolParts_1.isDynamicToolPart)(part))
                continue;
            if (part.toolName !== "agent_report")
                continue;
            if (part.state !== "output-available")
                continue;
            if (!isSuccessfulToolResult(part.output))
                continue;
            const parsed = toolDefinitions_1.AgentReportToolArgsSchema.safeParse(part.input);
            if (!parsed.success)
                continue;
            return parsed.data;
        }
        return null;
    }
    findAgentReportArgsInMessage(msg) {
        return this.findAgentReportArgsInParts(msg.parts);
    }
    async deliverReportToParent(parentWorkspaceId, childEntry, report) {
        const agentType = childEntry?.workspace.agentType ?? "agent";
        const childWorkspaceId = childEntry?.workspace.id;
        const output = {
            status: "completed",
            ...(childWorkspaceId ? { taskId: childWorkspaceId } : {}),
            reportMarkdown: report.reportMarkdown,
            title: report.title,
            agentType,
        };
        const parsedOutput = toolDefinitions_1.TaskToolResultSchema.safeParse(output);
        if (!parsedOutput.success) {
            log_1.log.error("Task tool output schema validation failed", { error: parsedOutput.error.message });
            return;
        }
        // If someone is actively awaiting this report (foreground task tool call or task_await),
        // skip injecting a synthetic history message to avoid duplicating the report in context.
        if (childWorkspaceId) {
            const waiters = this.pendingWaitersByTaskId.get(childWorkspaceId);
            if (waiters && waiters.length > 0) {
                return;
            }
        }
        // Restart-safe: if the parent has a pending task tool call in partial.json (interrupted stream),
        // finalize it with the report. Avoid rewriting persisted history to keep earlier messages immutable.
        if (!this.aiService.isStreaming(parentWorkspaceId)) {
            const finalizedPending = await this.tryFinalizePendingTaskToolCallInPartial(parentWorkspaceId, parsedOutput.data);
            if (finalizedPending) {
                return;
            }
        }
        // Background tasks: append a synthetic user message containing the report so earlier history
        // remains immutable (append-only) and prompt caches can still reuse the prefix.
        const titlePrefix = report.title ?? `Subagent (${agentType}) report`;
        const xml = [
            "<mux_subagent_report>",
            `<task_id>${childWorkspaceId ?? ""}</task_id>`,
            `<agent_type>${agentType}</agent_type>`,
            `<title>${titlePrefix}</title>`,
            "<report_markdown>",
            report.reportMarkdown,
            "</report_markdown>",
            "</mux_subagent_report>",
        ].join("\n");
        const messageId = (0, messageIds_1.createTaskReportMessageId)();
        const reportMessage = (0, message_1.createUnixMessage)(messageId, "user", xml, {
            timestamp: Date.now(),
            synthetic: true,
        });
        const appendResult = await this.historyService.appendToHistory(parentWorkspaceId, reportMessage);
        if (!appendResult.success) {
            log_1.log.error("Failed to append synthetic subagent report to parent history", {
                parentWorkspaceId,
                error: appendResult.error,
            });
        }
    }
    async tryFinalizePendingTaskToolCallInPartial(workspaceId, output) {
        const parsedOutput = toolDefinitions_1.TaskToolResultSchema.safeParse(output);
        if (!parsedOutput.success || parsedOutput.data.status !== "completed") {
            log_1.log.error("tryFinalizePendingTaskToolCallInPartial: invalid output", {
                error: parsedOutput.success ? "status is not 'completed'" : parsedOutput.error.message,
            });
            return false;
        }
        const partial = await this.partialService.readPartial(workspaceId);
        if (!partial) {
            return false;
        }
        const pendingParts = partial.parts.filter((p) => (0, toolParts_1.isDynamicToolPart)(p) && p.toolName === "task" && p.state === "input-available");
        if (pendingParts.length === 0) {
            return false;
        }
        if (pendingParts.length > 1) {
            log_1.log.error("tryFinalizePendingTaskToolCallInPartial: multiple pending task tool calls", {
                workspaceId,
            });
            return false;
        }
        const toolCallId = pendingParts[0].toolCallId;
        const parsedInput = toolDefinitions_1.TaskToolArgsSchema.safeParse(pendingParts[0].input);
        if (!parsedInput.success) {
            log_1.log.error("tryFinalizePendingTaskToolCallInPartial: task input validation failed", {
                workspaceId,
                error: parsedInput.error.message,
            });
            return false;
        }
        const updated = {
            ...partial,
            parts: partial.parts.map((part) => {
                if (!(0, toolParts_1.isDynamicToolPart)(part))
                    return part;
                if (part.toolCallId !== toolCallId)
                    return part;
                if (part.toolName !== "task")
                    return part;
                if (part.state === "output-available")
                    return part;
                return { ...part, state: "output-available", output: parsedOutput.data };
            }),
        };
        const writeResult = await this.partialService.writePartial(workspaceId, updated);
        if (!writeResult.success) {
            log_1.log.error("Failed to write finalized task tool output to partial", {
                workspaceId,
                error: writeResult.error,
            });
            return false;
        }
        this.workspaceService.emit("chat", {
            workspaceId,
            message: {
                type: "tool-call-end",
                workspaceId,
                messageId: updated.id,
                toolCallId,
                toolName: "task",
                result: parsedOutput.data,
                timestamp: Date.now(),
            },
        });
        return true;
    }
    async cleanupReportedLeafTask(workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "cleanupReportedLeafTask: workspaceId must be non-empty");
        let currentWorkspaceId = workspaceId;
        const visited = new Set();
        for (let depth = 0; depth < 32; depth++) {
            if (visited.has(currentWorkspaceId)) {
                log_1.log.error("cleanupReportedLeafTask: possible parentWorkspaceId cycle", {
                    workspaceId: currentWorkspaceId,
                });
                return;
            }
            visited.add(currentWorkspaceId);
            const config = this.config.loadConfigOrDefault();
            const entry = this.findWorkspaceEntry(config, currentWorkspaceId);
            if (!entry)
                return;
            const ws = entry.workspace;
            const parentWorkspaceId = ws.parentWorkspaceId;
            if (!parentWorkspaceId)
                return;
            if (ws.taskStatus !== "reported")
                return;
            const hasChildren = this.listAgentTaskWorkspaces(config).some((t) => t.parentWorkspaceId === currentWorkspaceId);
            if (hasChildren)
                return;
            const removeResult = await this.workspaceService.remove(currentWorkspaceId, true);
            if (!removeResult.success) {
                log_1.log.error("Failed to auto-delete reported task workspace", {
                    workspaceId: currentWorkspaceId,
                    error: removeResult.error,
                });
                return;
            }
            currentWorkspaceId = parentWorkspaceId;
        }
        log_1.log.error("cleanupReportedLeafTask: exceeded max parent traversal depth", {
            workspaceId,
        });
    }
    findWorkspaceEntry(config, workspaceId) {
        for (const [projectPath, project] of config.projects) {
            for (const workspace of project.workspaces) {
                if (workspace.id === workspaceId) {
                    return { projectPath, workspace };
                }
            }
        }
        return null;
    }
}
exports.TaskService = TaskService;
//# sourceMappingURL=taskService.js.map