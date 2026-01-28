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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSession = void 0;
const assert_1 = __importDefault(require("../../common/utils/assert"));
const events_1 = require("events");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const paths_1 = require("../../common/utils/paths");
const log_1 = require("../../node/services/log");
const workspace_1 = require("../../common/constants/workspace");
const workspaceDefaults_1 = require("../../constants/workspaceDefaults");
const schemas_1 = require("../../common/orpc/schemas");
const sendMessageError_1 = require("../../node/services/utils/sendMessageError");
const messageIds_1 = require("../../node/services/utils/messageIds");
const fileChangeTracker_1 = require("../../node/services/utils/fileChangeTracker");
const result_1 = require("../../common/types/result");
const policy_1 = require("../../common/utils/thinking/policy");
const message_1 = require("../../common/types/message");
const runtimeFactory_1 = require("../../node/runtime/runtimeFactory");
const runtimeHelpers_1 = require("../../node/runtime/runtimeHelpers");
const messageQueue_1 = require("./messageQueue");
const compactionHandler_1 = require("./compactionHandler");
const attachmentService_1 = require("./attachmentService");
const attachments_1 = require("../../common/constants/attachments");
const extractEditedFiles_1 = require("../../common/utils/messages/extractEditedFiles");
const modelCapabilities_1 = require("../../common/utils/ai/modelCapabilities");
const models_1 = require("../../common/utils/ai/models");
const agentSkillsService_1 = require("../../node/services/agentSkills/agentSkillsService");
const fileAtMentions_1 = require("../../node/services/fileAtMentions");
const PDF_MEDIA_TYPE = "application/pdf";
function normalizeMediaType(mediaType) {
    return mediaType.toLowerCase().trim().split(";")[0];
}
function estimateBase64DataUrlBytes(dataUrl) {
    if (!dataUrl.startsWith("data:"))
        return null;
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1)
        return null;
    const header = dataUrl.slice("data:".length, commaIndex);
    if (!header.includes(";base64"))
        return null;
    const base64 = dataUrl.slice(commaIndex + 1);
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.floor((base64.length * 3) / 4) - padding;
}
function isCompactionRequestMetadata(meta) {
    if (typeof meta !== "object" || meta === null)
        return false;
    const obj = meta;
    if (obj.type !== "compaction-request")
        return false;
    if (typeof obj.parsed !== "object" || obj.parsed === null)
        return false;
    return true;
}
const MAX_AGENT_SKILL_SNAPSHOT_CHARS = 50_000;
class AgentSession {
    workspaceId;
    config;
    historyService;
    partialService;
    aiService;
    initStateManager;
    backgroundProcessManager;
    onCompactionComplete;
    onPostCompactionStateChange;
    emitter = new events_1.EventEmitter();
    aiListeners = [];
    initListeners = [];
    disposed = false;
    streamStarting = false;
    messageQueue = new messageQueue_1.MessageQueue();
    compactionHandler;
    /** Tracks file state for detecting external edits. */
    fileChangeTracker = new fileChangeTracker_1.FileChangeTracker();
    /**
     * Track turns since last post-compaction attachment injection.
     * Start at max to trigger immediate injection on first turn after compaction.
     */
    turnsSinceLastAttachment = attachments_1.TURNS_BETWEEN_ATTACHMENTS;
    /**
     * Flag indicating compaction has occurred in this session.
     * Used to enable the cooldown-based attachment injection.
     */
    compactionOccurred = false;
    /**
     * When true, clear any persisted post-compaction state after the next successful non-compaction stream.
     *
     * This is intentionally delayed until stream-end so a crash mid-stream doesn't lose the diffs.
     */
    ackPendingPostCompactionStateOnStreamEnd = false;
    /**
     * Cache the last-known experiment state so we don't spam metadata refresh
     * when post-compaction context is disabled.
     */
    /** Track compaction requests that already retried with truncation. */
    compactionRetryAttempts = new Set();
    /**
     * Active compaction request metadata for retry decisions (cleared on stream end/abort).
     */
    /** Tracks the user message id that initiated the currently active stream (for retry guards). */
    activeStreamUserMessageId;
    /** Track user message ids that already retried without post-compaction injection. */
    postCompactionRetryAttempts = new Set();
    /** True once we see any model/tool output for the current stream (retry guard). */
    activeStreamHadAnyDelta = false;
    /** Tracks whether the current stream included post-compaction attachments. */
    activeStreamHadPostCompactionInjection = false;
    /** Context needed to retry the current stream (cleared on stream end/abort/error). */
    activeStreamContext;
    activeCompactionRequest;
    constructor(options) {
        (0, assert_1.default)(options, "AgentSession requires options");
        const { workspaceId, config, historyService, partialService, aiService, initStateManager, telemetryService, backgroundProcessManager, onCompactionComplete, onPostCompactionStateChange, } = options;
        (0, assert_1.default)(typeof workspaceId === "string", "workspaceId must be a string");
        const trimmedWorkspaceId = workspaceId.trim();
        (0, assert_1.default)(trimmedWorkspaceId.length > 0, "workspaceId must not be empty");
        this.workspaceId = trimmedWorkspaceId;
        this.config = config;
        this.historyService = historyService;
        this.partialService = partialService;
        this.aiService = aiService;
        this.initStateManager = initStateManager;
        this.backgroundProcessManager = backgroundProcessManager;
        this.onCompactionComplete = onCompactionComplete;
        this.onPostCompactionStateChange = onPostCompactionStateChange;
        this.compactionHandler = new compactionHandler_1.CompactionHandler({
            workspaceId: this.workspaceId,
            historyService: this.historyService,
            partialService: this.partialService,
            sessionDir: this.config.getSessionDir(this.workspaceId),
            telemetryService,
            emitter: this.emitter,
            onCompactionComplete,
        });
        this.attachAiListeners();
        this.attachInitListeners();
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        // Stop any active stream (fire and forget - disposal shouldn't block)
        void this.aiService.stopStream(this.workspaceId, { abandonPartial: true });
        // Terminate background processes for this workspace
        void this.backgroundProcessManager.cleanup(this.workspaceId);
        for (const { event, handler } of this.aiListeners) {
            this.aiService.off(event, handler);
        }
        this.aiListeners.length = 0;
        for (const { event, handler } of this.initListeners) {
            this.initStateManager.off(event, handler);
        }
        this.initListeners.length = 0;
        this.emitter.removeAllListeners();
    }
    onChatEvent(listener) {
        (0, assert_1.default)(typeof listener === "function", "listener must be a function");
        this.emitter.on("chat-event", listener);
        return () => {
            this.emitter.off("chat-event", listener);
        };
    }
    onMetadataEvent(listener) {
        (0, assert_1.default)(typeof listener === "function", "listener must be a function");
        this.emitter.on("metadata-event", listener);
        return () => {
            this.emitter.off("metadata-event", listener);
        };
    }
    async subscribeChat(listener) {
        this.assertNotDisposed("subscribeChat");
        (0, assert_1.default)(typeof listener === "function", "listener must be a function");
        const unsubscribe = this.onChatEvent(listener);
        await this.emitHistoricalEvents(listener);
        return unsubscribe;
    }
    async replayHistory(listener) {
        this.assertNotDisposed("replayHistory");
        (0, assert_1.default)(typeof listener === "function", "listener must be a function");
        await this.emitHistoricalEvents(listener);
    }
    emitMetadata(metadata) {
        this.assertNotDisposed("emitMetadata");
        this.emitter.emit("metadata-event", {
            workspaceId: this.workspaceId,
            metadata,
        });
    }
    async emitHistoricalEvents(listener) {
        // try/catch/finally guarantees caught-up is always sent, even if replay fails.
        // Without caught-up, the frontend stays in "Loading workspace..." forever.
        try {
            // Read partial BEFORE iterating history so we can skip the corresponding
            // placeholder message (which has empty parts). The partial has the real content.
            const streamInfo = this.aiService.getStreamInfo(this.workspaceId);
            const partial = await this.partialService.readPartial(this.workspaceId);
            const partialHistorySequence = partial?.metadata?.historySequence;
            // Load chat history (persisted messages from chat.jsonl)
            const historyResult = await this.historyService.getHistory(this.workspaceId);
            if (historyResult.success) {
                for (const message of historyResult.data) {
                    // Skip the placeholder message if we have a partial with the same historySequence.
                    // The placeholder has empty parts; the partial has the actual content.
                    // Without this, both get loaded and the empty placeholder may be shown as "last message".
                    if (partialHistorySequence !== undefined &&
                        message.metadata?.historySequence === partialHistorySequence) {
                        continue;
                    }
                    // Add type: "message" for discriminated union (messages from chat.jsonl don't have it)
                    listener({ workspaceId: this.workspaceId, message: { ...message, type: "message" } });
                }
            }
            if (streamInfo) {
                await this.aiService.replayStream(this.workspaceId);
            }
            else if (partial) {
                // Add type: "message" for discriminated union (partials from disk don't have it)
                listener({ workspaceId: this.workspaceId, message: { ...partial, type: "message" } });
            }
            // Replay init state BEFORE caught-up (treat as historical data)
            // This ensures init events are buffered correctly by the frontend,
            // preserving their natural timing characteristics from the hook execution.
            await this.initStateManager.replayInit(this.workspaceId);
        }
        catch (error) {
            log_1.log.error("Failed to replay history for workspace", {
                workspaceId: this.workspaceId,
                error,
            });
        }
        finally {
            // Send caught-up after ALL historical data (including init events)
            // This signals frontend that replay is complete and future events are real-time
            listener({
                workspaceId: this.workspaceId,
                message: { type: "caught-up" },
            });
        }
    }
    async ensureMetadata(args) {
        this.assertNotDisposed("ensureMetadata");
        (0, assert_1.default)(args, "ensureMetadata requires arguments");
        const { workspacePath, projectName, runtimeConfig } = args;
        (0, assert_1.default)(typeof workspacePath === "string", "workspacePath must be a string");
        const trimmedWorkspacePath = workspacePath.trim();
        (0, assert_1.default)(trimmedWorkspacePath.length > 0, "workspacePath must not be empty");
        const normalizedWorkspacePath = path.resolve(trimmedWorkspacePath);
        const existing = await this.aiService.getWorkspaceMetadata(this.workspaceId);
        if (existing.success) {
            // Metadata already exists, verify workspace path matches
            const metadata = existing.data;
            // For in-place workspaces (projectPath === name), use path directly
            // Otherwise reconstruct using runtime's worktree pattern
            const isInPlace = metadata.projectPath === metadata.name;
            const expectedPath = isInPlace
                ? metadata.projectPath
                : (() => {
                    const runtime = (0, runtimeFactory_1.createRuntime)(metadata.runtimeConfig, {
                        projectPath: metadata.projectPath,
                        workspaceName: metadata.name,
                    });
                    return runtime.getWorkspacePath(metadata.projectPath, metadata.name);
                })();
            (0, assert_1.default)(expectedPath === normalizedWorkspacePath, `Existing metadata workspace path mismatch for ${this.workspaceId}: expected ${expectedPath}, got ${normalizedWorkspacePath}`);
            return;
        }
        // Detect in-place workspace: if workspacePath is not under srcBaseDir,
        // it's a direct workspace (e.g., for CLI/benchmarks) rather than a worktree
        const srcBaseDir = this.config.srcDir;
        const normalizedSrcBaseDir = path.resolve(srcBaseDir);
        const isUnderSrcBaseDir = normalizedWorkspacePath.startsWith(normalizedSrcBaseDir + path.sep);
        let derivedProjectPath;
        let workspaceName;
        let derivedProjectName;
        if (isUnderSrcBaseDir) {
            // Standard worktree mode: workspace is under ~/.unix/src/project/branch
            derivedProjectPath = path.dirname(normalizedWorkspacePath);
            workspaceName = paths_1.PlatformPaths.basename(normalizedWorkspacePath);
            derivedProjectName =
                projectName && projectName.trim().length > 0
                    ? projectName.trim()
                    : paths_1.PlatformPaths.basename(derivedProjectPath) || "unknown";
        }
        else {
            // In-place mode: workspace is a standalone directory
            // Store the workspace path directly by setting projectPath === name
            derivedProjectPath = normalizedWorkspacePath;
            workspaceName = normalizedWorkspacePath;
            derivedProjectName =
                projectName && projectName.trim().length > 0
                    ? projectName.trim()
                    : paths_1.PlatformPaths.basename(normalizedWorkspacePath) || "unknown";
        }
        const metadata = {
            id: this.workspaceId,
            name: workspaceName,
            projectName: derivedProjectName,
            projectPath: derivedProjectPath,
            namedWorkspacePath: normalizedWorkspacePath,
            runtimeConfig: runtimeConfig ?? workspace_1.DEFAULT_RUNTIME_CONFIG,
        };
        // Write metadata directly to config.json (single source of truth)
        await this.config.addWorkspace(derivedProjectPath, metadata);
        this.emitMetadata(metadata);
    }
    async sendMessage(message, options) {
        this.assertNotDisposed("sendMessage");
        (0, assert_1.default)(typeof message === "string", "sendMessage requires a string message");
        const trimmedMessage = message.trim();
        const fileParts = options?.fileParts;
        // Edits are implemented as truncate+replace. If the frontend omits fileParts,
        // preserve the original message's attachments.
        let preservedEditFileParts;
        if (options?.editMessageId && fileParts === undefined) {
            const historyResult = await this.historyService.getHistory(this.workspaceId);
            if (historyResult.success) {
                const targetMessage = historyResult.data.find((msg) => msg.id === options.editMessageId);
                const fileParts = targetMessage?.parts.filter((part) => part.type === "file");
                if (fileParts && fileParts.length > 0) {
                    preservedEditFileParts = fileParts;
                }
            }
        }
        const hasFiles = (fileParts?.length ?? 0) > 0 || (preservedEditFileParts?.length ?? 0) > 0;
        if (trimmedMessage.length === 0 && !hasFiles) {
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)("Empty message not allowed. Use interruptStream() to interrupt active streams."));
        }
        if (options?.editMessageId) {
            // Interrupt an existing stream or compaction, if active
            if (this.aiService.isStreaming(this.workspaceId)) {
                // MUST use abandonPartial=true to prevent handleAbort from performing partial compaction
                // with mismatched history (since we're about to truncate it)
                const stopResult = await this.interruptStream({ abandonPartial: true });
                if (!stopResult.success) {
                    return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(stopResult.error));
                }
            }
            // Find the truncation target: the edited message or any immediately-preceding snapshots.
            // (snapshots are persisted immediately before their corresponding user message)
            let truncateTargetId = options.editMessageId;
            const historyResult = await this.historyService.getHistory(this.workspaceId);
            if (historyResult.success) {
                const messages = historyResult.data;
                const editIndex = messages.findIndex((m) => m.id === options.editMessageId);
                if (editIndex > 0) {
                    // Walk backwards over contiguous synthetic snapshots so we don't orphan them.
                    for (let i = editIndex - 1; i >= 0; i--) {
                        const msg = messages[i];
                        const isSnapshot = msg.metadata?.synthetic &&
                            (msg.metadata?.fileAtMentionSnapshot ?? msg.metadata?.agentSkillSnapshot);
                        if (!isSnapshot)
                            break;
                        truncateTargetId = msg.id;
                    }
                }
            }
            const truncateResult = await this.historyService.truncateAfterMessage(this.workspaceId, truncateTargetId);
            if (!truncateResult.success) {
                const isMissingEditTarget = truncateResult.error.includes("Message with ID") &&
                    truncateResult.error.includes("not found in history");
                if (isMissingEditTarget) {
                    // This can happen if the frontend is briefly out-of-sync with persisted history
                    // (e.g., compaction/truncation completed and removed the message while the UI still
                    // shows it as editable). Treat as a no-op truncation so the user can recover.
                    log_1.log.warn("editMessageId not found in history; proceeding without truncation", {
                        workspaceId: this.workspaceId,
                        editMessageId: options.editMessageId,
                        error: truncateResult.error,
                    });
                }
                else {
                    return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(truncateResult.error));
                }
            }
        }
        const messageId = (0, messageIds_1.createUserMessageId)();
        const additionalParts = preservedEditFileParts && preservedEditFileParts.length > 0
            ? preservedEditFileParts
            : fileParts && fileParts.length > 0
                ? fileParts.map((part, index) => {
                    (0, assert_1.default)(typeof part.url === "string", `file part [${index}] must include url string content (got ${typeof part.url}): ${JSON.stringify(part).slice(0, 200)}`);
                    (0, assert_1.default)(part.url.startsWith("data:"), `file part [${index}] url must be a data URL (got: ${part.url.slice(0, 50)}...)`);
                    (0, assert_1.default)(typeof part.mediaType === "string" && part.mediaType.trim().length > 0, `file part [${index}] must include a mediaType (got ${typeof part.mediaType}): ${JSON.stringify(part).slice(0, 200)}`);
                    if (part.filename !== undefined) {
                        (0, assert_1.default)(typeof part.filename === "string", `file part [${index}] filename must be a string if present (got ${typeof part.filename}): ${JSON.stringify(part).slice(0, 200)}`);
                    }
                    return {
                        type: "file",
                        url: part.url,
                        mediaType: part.mediaType,
                        filename: part.filename,
                    };
                })
                : undefined;
        // toolPolicy is properly typed via Zod schema inference
        const typedToolPolicy = options?.toolPolicy;
        // unixMetadata is z.any() in schema - cast to proper type
        const typedUnixMetadata = options?.unixMetadata;
        const isCompactionRequest = isCompactionRequestMetadata(typedUnixMetadata);
        // Validate model BEFORE persisting message to prevent orphaned messages on invalid model
        if (!options?.model || options.model.trim().length === 0) {
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)("No model specified. Please select a model using /model."));
        }
        // Defense-in-depth: reject PDFs for models we know don't support them.
        // (Frontend should also block this, but it's easy to bypass via IPC / older clients.)
        const effectiveFileParts = preservedEditFileParts && preservedEditFileParts.length > 0
            ? preservedEditFileParts.map((part) => ({
                url: part.url,
                mediaType: part.mediaType,
                filename: part.filename,
            }))
            : fileParts;
        if (effectiveFileParts && effectiveFileParts.length > 0) {
            const pdfParts = effectiveFileParts.filter((part) => normalizeMediaType(part.mediaType) === PDF_MEDIA_TYPE);
            if (pdfParts.length > 0) {
                const caps = (0, modelCapabilities_1.getModelCapabilities)(options.model);
                if (caps && !caps.supportsPdfInput) {
                    return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(`Model ${options.model} does not support PDF input.`));
                }
                if (caps?.maxPdfSizeMb !== undefined) {
                    const maxBytes = caps.maxPdfSizeMb * 1024 * 1024;
                    for (const part of pdfParts) {
                        const bytes = estimateBase64DataUrlBytes(part.url);
                        if (bytes !== null && bytes > maxBytes) {
                            const actualMb = (bytes / (1024 * 1024)).toFixed(1);
                            const label = part.filename ?? "PDF";
                            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(`${label} is ${actualMb}MB, but ${options.model} allows up to ${caps.maxPdfSizeMb}MB per PDF.`));
                        }
                    }
                }
            }
        }
        // Validate model string format (must be "provider:model-id")
        if (!(0, models_1.isValidModelFormat)(options.model)) {
            return (0, result_1.Err)({
                type: "invalid_model_string",
                message: `Invalid model string format: "${options.model}". Expected "provider:model-id"`,
            });
        }
        const userMessage = (0, message_1.createUnixMessage)(messageId, "user", message, {
            timestamp: Date.now(),
            toolPolicy: typedToolPolicy,
            unixMetadata: typedUnixMetadata, // Pass through frontend metadata as black-box
        }, additionalParts);
        // Materialize @file mentions from the user message into a snapshot.
        // This ensures prompt-cache stability: we read files once and persist the content,
        // so subsequent turns don't re-read (which would change the prompt prefix if files changed).
        // File changes after this point are surfaced via <system-file-update> diffs instead.
        const snapshotResult = await this.materializeFileAtMentionsSnapshot(trimmedMessage);
        let skillSnapshotResult = null;
        try {
            skillSnapshotResult = await this.materializeAgentSkillSnapshot(typedUnixMetadata, options?.disableWorkspaceAgents);
        }
        catch (error) {
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(error instanceof Error ? error.message : String(error)));
        }
        // Persist snapshots (if any) BEFORE the user message so they precede it in the prompt.
        // Order matters: @file snapshot first, then agent-skill snapshot.
        if (snapshotResult?.snapshotMessage) {
            const snapshotAppendResult = await this.historyService.appendToHistory(this.workspaceId, snapshotResult.snapshotMessage);
            if (!snapshotAppendResult.success) {
                return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(snapshotAppendResult.error));
            }
        }
        if (skillSnapshotResult?.snapshotMessage) {
            const skillSnapshotAppendResult = await this.historyService.appendToHistory(this.workspaceId, skillSnapshotResult.snapshotMessage);
            if (!skillSnapshotAppendResult.success) {
                return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(skillSnapshotAppendResult.error));
            }
        }
        const appendResult = await this.historyService.appendToHistory(this.workspaceId, userMessage);
        if (!appendResult.success) {
            // Note: If we get here with snapshots, one or more snapshots may already be persisted but user message
            // failed. This is a rare edge case (disk full mid-operation). The next edit will clean up
            // the orphan via the truncation logic that removes preceding snapshots.
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(appendResult.error));
        }
        // Workspace may be tearing down while we await filesystem IO.
        // If so, skip event emission + streaming to avoid races with dispose().
        if (this.disposed) {
            return (0, result_1.Ok)(undefined);
        }
        // Emit snapshots first (if any), then user message - maintains prompt ordering in UI
        if (snapshotResult?.snapshotMessage) {
            this.emitChatEvent({ ...snapshotResult.snapshotMessage, type: "message" });
        }
        if (skillSnapshotResult?.snapshotMessage) {
            this.emitChatEvent({ ...skillSnapshotResult.snapshotMessage, type: "message" });
        }
        // Add type: "message" for discriminated union (createUnixMessage doesn't add it)
        this.emitChatEvent({ ...userMessage, type: "message" });
        this.streamStarting = true;
        try {
            // If this is a compaction request, terminate background processes first
            // They won't be included in the summary, so continuing with orphaned processes would be confusing
            if (isCompactionRequest) {
                await this.backgroundProcessManager.cleanup(this.workspaceId);
                if (this.disposed) {
                    return (0, result_1.Ok)(undefined);
                }
            }
            // If this is a compaction request with follow-up content, queue it for auto-send after compaction
            // Use the type guard result to access followUpContent with proper typing
            // Supports both new `followUpContent` and legacy `continueMessage` for backwards compatibility
            if (isCompactionRequest && typedUnixMetadata && options) {
                const compactionMeta = typedUnixMetadata;
                const followUpContent = compactionMeta.parsed.followUpContent;
                const legacyContinueMessage = compactionMeta.parsed.continueMessage;
                // Prefer new field, fall back to legacy
                const rawFollowUp = followUpContent ?? legacyContinueMessage;
                if (rawFollowUp) {
                    const followUpText = followUpContent?.text ?? legacyContinueMessage?.text ?? "";
                    // Normalize attachments: newer metadata uses `fileParts`, older persisted entries used `imageParts`.
                    const followUpFileParts = followUpContent?.fileParts ?? legacyContinueMessage?.imageParts;
                    // Process the follow-up content (handles reviews -> text formatting + metadata)
                    const { finalText, metadata } = (0, message_1.prepareUserMessageForSend)({
                        text: followUpText,
                        fileParts: followUpFileParts,
                        reviews: followUpContent?.reviews ?? legacyContinueMessage?.reviews,
                    }, followUpContent?.unixMetadata ?? legacyContinueMessage?.unixMetadata);
                    // Derive agentId: new field has it directly, legacy may use `mode` field.
                    // Legacy `mode` was "exec" | "plan" and maps directly to agentId.
                    const legacyMode = legacyContinueMessage?.mode;
                    const effectiveAgentId = followUpContent?.agentId ?? legacyContinueMessage?.agentId ?? legacyMode ?? "exec";
                    // Use model/agentId from follow-up content - these were captured from the user's
                    // original settings when compaction was triggered (compaction uses its own
                    // agentId "compact" and potentially a different model for summarization).
                    const followUpModel = followUpContent?.model ?? legacyContinueMessage?.model ?? options.model;
                    // Build options for the queued message (strip compaction-specific fields)
                    // agentId determines tool policy via resolveToolPolicyForAgent in aiService
                    const sanitizedOptions = {
                        model: followUpModel,
                        agentId: effectiveAgentId,
                        thinkingLevel: options.thinkingLevel,
                        additionalSystemInstructions: options.additionalSystemInstructions,
                        providerOptions: options.providerOptions,
                        experiments: options.experiments,
                        disableWorkspaceAgents: options.disableWorkspaceAgents,
                    };
                    if (followUpFileParts && followUpFileParts.length > 0) {
                        sanitizedOptions.fileParts = followUpFileParts;
                    }
                    // Add metadata with reviews if present
                    if (metadata) {
                        sanitizedOptions.unixMetadata = metadata;
                    }
                    const dedupeKey = JSON.stringify({
                        text: finalText.trim(),
                        files: (followUpFileParts ?? []).map((part) => `${part.mediaType}:${part.url}`),
                    });
                    if (this.messageQueue.addOnce(finalText, sanitizedOptions, dedupeKey)) {
                        this.emitQueuedMessageChanged();
                    }
                }
            }
            if (this.disposed) {
                return (0, result_1.Ok)(undefined);
            }
            // Must await here so the finally block runs after streaming completes,
            // not immediately when the Promise is returned. This keeps streamStarting=true
            // for the entire duration of streaming, allowing follow-up messages to be queued.
            const result = await this.streamWithHistory(options.model, options);
            return result;
        }
        finally {
            this.streamStarting = false;
        }
    }
    async resumeStream(options) {
        this.assertNotDisposed("resumeStream");
        (0, assert_1.default)(options, "resumeStream requires options");
        const { model } = options;
        (0, assert_1.default)(typeof model === "string" && model.trim().length > 0, "resumeStream requires a model");
        // Guard against auto-retry starting a second stream while the initial send is
        // still waiting for init hooks to complete.
        if (this.streamStarting || this.aiService.isStreaming(this.workspaceId)) {
            return (0, result_1.Ok)(undefined);
        }
        this.streamStarting = true;
        try {
            // Must await here so the finally block runs after streaming completes,
            // not immediately when the Promise is returned.
            const result = await this.streamWithHistory(model, options);
            return result;
        }
        finally {
            this.streamStarting = false;
        }
    }
    async interruptStream(options) {
        this.assertNotDisposed("interruptStream");
        // For hard interrupts, delete partial BEFORE stopping to prevent abort handler
        // from committing it. For soft interrupts, defer to stream-abort handler since
        // the stream continues running and would recreate the partial.
        if (options?.abandonPartial && !options?.soft) {
            const deleteResult = await this.partialService.deletePartial(this.workspaceId);
            if (!deleteResult.success) {
                return (0, result_1.Err)(deleteResult.error);
            }
        }
        const stopResult = await this.aiService.stopStream(this.workspaceId, {
            ...options,
            abortReason: "user",
        });
        if (!stopResult.success) {
            return (0, result_1.Err)(stopResult.error);
        }
        return (0, result_1.Ok)(undefined);
    }
    async streamWithHistory(modelString, options, openaiTruncationModeOverride, disablePostCompactionAttachments) {
        if (this.disposed) {
            return (0, result_1.Ok)(undefined);
        }
        // Reset per-stream flags (used for retries / crash-safe bookkeeping).
        this.ackPendingPostCompactionStateOnStreamEnd = false;
        this.activeStreamHadAnyDelta = false;
        this.activeStreamHadPostCompactionInjection = false;
        this.activeStreamContext = {
            modelString,
            options,
            openaiTruncationModeOverride,
        };
        this.activeStreamUserMessageId = undefined;
        const commitResult = await this.partialService.commitToHistory(this.workspaceId);
        if (!commitResult.success) {
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(commitResult.error));
        }
        const historyResult = await this.historyService.getHistory(this.workspaceId);
        if (!historyResult.success) {
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)(historyResult.error));
        }
        // Capture the current user message id so retries are stable across assistant message ids.
        const lastUserMessage = [...historyResult.data].reverse().find((m) => m.role === "user");
        this.activeStreamUserMessageId = lastUserMessage?.id;
        if (historyResult.data.length === 0) {
            return (0, result_1.Err)((0, sendMessageError_1.createUnknownSendMessageError)("Cannot resume stream: workspace history is empty. Send a new message instead."));
        }
        this.activeCompactionRequest = this.resolveCompactionRequest(historyResult.data, modelString, options);
        // Check for external file edits (timestamp-based polling)
        const changedFileAttachments = await this.fileChangeTracker.getChangedAttachments();
        // Check if post-compaction attachments should be injected.
        const postCompactionAttachments = disablePostCompactionAttachments === true
            ? null
            : await this.getPostCompactionAttachmentsIfNeeded();
        this.activeStreamHadPostCompactionInjection =
            postCompactionAttachments !== null && postCompactionAttachments.length > 0;
        // Enforce thinking policy for the specified model (single source of truth)
        // This ensures model-specific requirements are met regardless of where the request originates
        const effectiveThinkingLevel = options?.thinkingLevel
            ? (0, policy_1.enforceThinkingPolicy)(modelString, options.thinkingLevel)
            : undefined;
        // Bind recordFileState to this session for the propose_plan tool
        const recordFileState = this.fileChangeTracker.record.bind(this.fileChangeTracker);
        const streamResult = await this.aiService.streamMessage(historyResult.data, this.workspaceId, modelString, effectiveThinkingLevel, options?.toolPolicy, undefined, options?.additionalSystemInstructions, options?.maxOutputTokens, options?.providerOptions, options?.agentId, recordFileState, changedFileAttachments.length > 0 ? changedFileAttachments : undefined, postCompactionAttachments, options?.experiments, options?.system1Model, options?.system1ThinkingLevel, options?.disableWorkspaceAgents, () => !this.messageQueue.isEmpty(), openaiTruncationModeOverride);
        if (!streamResult.success) {
            this.activeCompactionRequest = undefined;
            // If stream startup failed before any stream events were emitted (e.g., missing API key),
            // emit a synthetic stream-error so the UI can surface the failure immediately.
            if (streamResult.error.type !== "runtime_not_ready" &&
                streamResult.error.type !== "runtime_start_failed") {
                const streamError = (0, sendMessageError_1.buildStreamErrorEventData)(streamResult.error);
                await this.handleStreamError(streamError);
            }
        }
        return streamResult;
    }
    resolveCompactionRequest(history, modelString, options) {
        for (let index = history.length - 1; index >= 0; index -= 1) {
            const message = history[index];
            if (message.role !== "user") {
                continue;
            }
            if (!isCompactionRequestMetadata(message.metadata?.unixMetadata)) {
                return undefined;
            }
            return {
                id: message.id,
                modelString,
                options,
            };
        }
        return undefined;
    }
    async clearFailedAssistantMessage(messageId, reason) {
        const [partialResult, deleteMessageResult] = await Promise.all([
            this.partialService.deletePartial(this.workspaceId),
            this.historyService.deleteMessage(this.workspaceId, messageId),
        ]);
        if (!partialResult.success) {
            log_1.log.warn("Failed to clear partial before retry", {
                workspaceId: this.workspaceId,
                reason,
                error: partialResult.error,
            });
        }
        if (!deleteMessageResult.success &&
            !(typeof deleteMessageResult.error === "string" &&
                deleteMessageResult.error.includes("not found in history"))) {
            log_1.log.warn("Failed to delete failed assistant placeholder", {
                workspaceId: this.workspaceId,
                reason,
                error: deleteMessageResult.error,
            });
        }
    }
    async finalizeCompactionRetry(messageId) {
        this.activeCompactionRequest = undefined;
        this.resetActiveStreamState();
        this.emitChatEvent({
            type: "stream-abort",
            workspaceId: this.workspaceId,
            messageId,
        });
        await this.clearFailedAssistantMessage(messageId, "compaction-retry");
    }
    isSonnet45Model(modelString) {
        const normalized = (0, models_1.normalizeGatewayModel)(modelString);
        const [provider, modelName] = normalized.split(":", 2);
        return provider === "anthropic" && modelName?.toLowerCase().startsWith("claude-sonnet-4-5");
    }
    withAnthropic1MContext(modelString, options) {
        if (options) {
            return {
                ...options,
                providerOptions: {
                    ...options.providerOptions,
                    anthropic: {
                        ...options.providerOptions?.anthropic,
                        use1MContext: true,
                    },
                },
            };
        }
        return {
            model: modelString,
            agentId: workspaceDefaults_1.WORKSPACE_DEFAULTS.agentId,
            providerOptions: {
                anthropic: {
                    use1MContext: true,
                },
            },
        };
    }
    isGptClassModel(modelString) {
        const normalized = (0, models_1.normalizeGatewayModel)(modelString);
        const [provider, modelName] = normalized.split(":", 2);
        return provider === "openai" && modelName?.toLowerCase().startsWith("gpt-");
    }
    async maybeRetryCompactionOnContextExceeded(data) {
        if (data.errorType !== "context_exceeded") {
            return false;
        }
        const context = this.activeCompactionRequest;
        if (!context) {
            return false;
        }
        const isGptClass = this.isGptClassModel(context.modelString);
        const isSonnet45 = this.isSonnet45Model(context.modelString);
        if (!isGptClass && !isSonnet45) {
            return false;
        }
        if (isSonnet45) {
            const use1MContext = context.options?.providerOptions?.anthropic?.use1MContext ?? false;
            if (use1MContext) {
                return false;
            }
        }
        if (this.compactionRetryAttempts.has(context.id)) {
            return false;
        }
        this.compactionRetryAttempts.add(context.id);
        const retryLabel = isSonnet45 ? "Anthropic 1M context" : "OpenAI truncation";
        log_1.log.info(`Compaction hit context limit; retrying once with ${retryLabel}`, {
            workspaceId: this.workspaceId,
            model: context.modelString,
            compactionRequestId: context.id,
        });
        await this.finalizeCompactionRetry(data.messageId);
        const retryOptions = isSonnet45
            ? this.withAnthropic1MContext(context.modelString, context.options)
            : context.options;
        this.streamStarting = true;
        let retryResult;
        try {
            retryResult = await this.streamWithHistory(context.modelString, retryOptions, isGptClass ? "auto" : undefined);
        }
        finally {
            this.streamStarting = false;
        }
        if (!retryResult.success) {
            log_1.log.error("Compaction retry failed to start", {
                workspaceId: this.workspaceId,
                error: retryResult.error,
            });
            return false;
        }
        return true;
    }
    async maybeRetryWithoutPostCompactionOnContextExceeded(data) {
        if (data.errorType !== "context_exceeded") {
            return false;
        }
        // Only retry if we actually injected post-compaction context.
        if (!this.activeStreamHadPostCompactionInjection) {
            return false;
        }
        // Guardrail: don't retry if we've already emitted any meaningful output.
        if (this.activeStreamHadAnyDelta) {
            return false;
        }
        const requestId = this.activeStreamUserMessageId;
        const context = this.activeStreamContext;
        if (!requestId || !context) {
            return false;
        }
        if (this.postCompactionRetryAttempts.has(requestId)) {
            return false;
        }
        this.postCompactionRetryAttempts.add(requestId);
        log_1.log.info("Post-compaction context hit context limit; retrying once without it", {
            workspaceId: this.workspaceId,
            requestId,
            model: context.modelString,
        });
        // The post-compaction diffs are likely the culprit; discard them so we don't loop.
        try {
            await this.compactionHandler.discardPendingDiffs("context_exceeded");
            this.onPostCompactionStateChange?.();
        }
        catch (error) {
            log_1.log.warn("Failed to discard pending post-compaction state", {
                workspaceId: this.workspaceId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        // Abort the failed assistant placeholder and clean up persisted partial/history state.
        this.resetActiveStreamState();
        this.emitChatEvent({
            type: "stream-abort",
            workspaceId: this.workspaceId,
            messageId: data.messageId,
        });
        await this.clearFailedAssistantMessage(data.messageId, "post-compaction-retry");
        // Retry the same request, but without post-compaction injection.
        this.streamStarting = true;
        let retryResult;
        try {
            retryResult = await this.streamWithHistory(context.modelString, context.options, context.openaiTruncationModeOverride, true);
        }
        finally {
            this.streamStarting = false;
        }
        if (!retryResult.success) {
            log_1.log.error("Post-compaction retry failed to start", {
                workspaceId: this.workspaceId,
                error: retryResult.error,
            });
            return false;
        }
        return true;
    }
    resetActiveStreamState() {
        this.activeStreamContext = undefined;
        this.activeStreamUserMessageId = undefined;
        this.activeStreamHadPostCompactionInjection = false;
        this.activeStreamHadAnyDelta = false;
        this.ackPendingPostCompactionStateOnStreamEnd = false;
    }
    async handleStreamError(data) {
        const hadCompactionRequest = this.activeCompactionRequest !== undefined;
        if (await this.maybeRetryCompactionOnContextExceeded({
            messageId: data.messageId,
            errorType: data.errorType,
        })) {
            return;
        }
        if (await this.maybeRetryWithoutPostCompactionOnContextExceeded({
            messageId: data.messageId,
            errorType: data.errorType,
        })) {
            return;
        }
        this.activeCompactionRequest = undefined;
        this.resetActiveStreamState();
        if (hadCompactionRequest && !this.disposed) {
            this.clearQueue();
        }
        this.emitChatEvent((0, sendMessageError_1.createStreamErrorMessage)(data));
    }
    attachAiListeners() {
        const forward = (event, handler) => {
            const wrapped = (...args) => {
                const [payload] = args;
                if (typeof payload === "object" &&
                    payload !== null &&
                    "workspaceId" in payload &&
                    payload.workspaceId !== this.workspaceId) {
                    return;
                }
                void handler(payload);
            };
            this.aiListeners.push({ event, handler: wrapped });
            this.aiService.on(event, wrapped);
        };
        forward("stream-start", (payload) => this.emitChatEvent(payload));
        forward("stream-delta", (payload) => {
            this.activeStreamHadAnyDelta = true;
            this.emitChatEvent(payload);
        });
        forward("tool-call-start", (payload) => {
            this.activeStreamHadAnyDelta = true;
            this.emitChatEvent(payload);
        });
        forward("bash-output", (payload) => {
            this.activeStreamHadAnyDelta = true;
            this.emitChatEvent(payload);
        });
        forward("tool-call-delta", (payload) => {
            this.activeStreamHadAnyDelta = true;
            this.emitChatEvent(payload);
        });
        forward("tool-call-end", (payload) => {
            this.activeStreamHadAnyDelta = true;
            this.emitChatEvent(payload);
            // Post-compaction context state depends on plan writes + tracked file diffs.
            // Trigger a metadata refresh so the right sidebar updates immediately.
            if (payload.type === "tool-call-end" &&
                (payload.toolName === "propose_plan" || payload.toolName.startsWith("file_edit_"))) {
                this.onPostCompactionStateChange?.();
            }
        });
        forward("reasoning-delta", (payload) => {
            this.activeStreamHadAnyDelta = true;
            this.emitChatEvent(payload);
        });
        forward("reasoning-end", (payload) => this.emitChatEvent(payload));
        forward("usage-delta", (payload) => this.emitChatEvent(payload));
        forward("stream-abort", (payload) => {
            const hadCompactionRequest = this.activeCompactionRequest !== undefined;
            this.activeCompactionRequest = undefined;
            this.resetActiveStreamState();
            if (hadCompactionRequest && !this.disposed) {
                this.clearQueue();
            }
            this.emitChatEvent(payload);
        });
        forward("runtime-status", (payload) => this.emitChatEvent(payload));
        forward("stream-end", async (payload) => {
            this.activeCompactionRequest = undefined;
            const handled = await this.compactionHandler.handleCompletion(payload);
            if (!handled) {
                this.emitChatEvent(payload);
                if (this.ackPendingPostCompactionStateOnStreamEnd) {
                    this.ackPendingPostCompactionStateOnStreamEnd = false;
                    try {
                        await this.compactionHandler.ackPendingDiffsConsumed();
                    }
                    catch (error) {
                        log_1.log.warn("Failed to ack pending post-compaction state", {
                            workspaceId: this.workspaceId,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                    this.onPostCompactionStateChange?.();
                }
            }
            else {
                // Compaction completed - notify to trigger metadata refresh
                // This allows the frontend to get updated postCompaction state
                this.onCompactionComplete?.();
            }
            this.resetActiveStreamState();
            // Stream end: auto-send queued messages
            this.sendQueuedMessages();
        });
        const errorHandler = (...args) => {
            const [raw] = args;
            if (typeof raw !== "object" ||
                raw === null ||
                !("workspaceId" in raw) ||
                raw.workspaceId !== this.workspaceId) {
                return;
            }
            const data = raw;
            void this.handleStreamError({
                messageId: data.messageId,
                error: data.error,
                errorType: data.errorType,
            });
        };
        this.aiListeners.push({ event: "error", handler: errorHandler });
        this.aiService.on("error", errorHandler);
    }
    attachInitListeners() {
        const forward = (event, handler) => {
            const wrapped = (...args) => {
                const [payload] = args;
                if (typeof payload === "object" &&
                    payload !== null &&
                    "workspaceId" in payload &&
                    payload.workspaceId !== this.workspaceId) {
                    return;
                }
                // Strip workspaceId from payload before forwarding (WorkspaceInitEvent doesn't include it)
                const { workspaceId: _, ...message } = payload;
                handler(message);
            };
            this.initListeners.push({ event, handler: wrapped });
            this.initStateManager.on(event, wrapped);
        };
        forward("init-start", (payload) => this.emitChatEvent(payload));
        forward("init-output", (payload) => this.emitChatEvent(payload));
        forward("init-end", (payload) => this.emitChatEvent(payload));
    }
    // Public method to emit chat events (used by init hooks and other workspace events)
    emitChatEvent(message) {
        // NOTE: Workspace teardown does not await in-flight async work (sendMessage(), stopStream(), etc).
        // Those code paths can still try to emit events after dispose; drop them rather than crashing.
        if (this.disposed) {
            return;
        }
        this.emitter.emit("chat-event", {
            workspaceId: this.workspaceId,
            message,
        });
    }
    isStreamStarting() {
        return this.streamStarting;
    }
    queueMessage(message, options) {
        this.assertNotDisposed("queueMessage");
        this.messageQueue.add(message, options);
        this.emitQueuedMessageChanged();
        // Signal to bash_output that it should return early to process the queued message
        this.backgroundProcessManager.setMessageQueued(this.workspaceId, true);
    }
    clearQueue() {
        this.assertNotDisposed("clearQueue");
        this.messageQueue.clear();
        this.emitQueuedMessageChanged();
        this.backgroundProcessManager.setMessageQueued(this.workspaceId, false);
    }
    /**
     * Restore queued messages to input box.
     * Called by IPC handler on user-initiated interrupt.
     */
    restoreQueueToInput() {
        this.assertNotDisposed("restoreQueueToInput");
        if (!this.messageQueue.isEmpty()) {
            const displayText = this.messageQueue.getDisplayText();
            const fileParts = this.messageQueue.getFileParts();
            this.messageQueue.clear();
            this.emitQueuedMessageChanged();
            this.emitChatEvent({
                type: "restore-to-input",
                workspaceId: this.workspaceId,
                text: displayText,
                fileParts: fileParts,
            });
        }
    }
    emitQueuedMessageChanged() {
        this.emitChatEvent({
            type: "queued-message-changed",
            workspaceId: this.workspaceId,
            queuedMessages: this.messageQueue.getMessages(),
            displayText: this.messageQueue.getDisplayText(),
            fileParts: this.messageQueue.getFileParts(),
            reviews: this.messageQueue.getReviews(),
            hasCompactionRequest: this.messageQueue.hasCompactionRequest(),
        });
    }
    /**
     * Send queued messages if any exist.
     * Called when tool execution completes, stream ends, or user clicks send immediately.
     */
    sendQueuedMessages() {
        // sendQueuedMessages can race with teardown (e.g. workspace.remove) because we
        // trigger it off stream/tool events and disposal does not await stopStream().
        // If the session is already disposed, do nothing.
        if (this.disposed) {
            return;
        }
        // Clear the queued message flag (even if queue is empty, to handle race conditions)
        this.backgroundProcessManager.setMessageQueued(this.workspaceId, false);
        if (!this.messageQueue.isEmpty()) {
            const { message, options } = this.messageQueue.produceMessage();
            this.messageQueue.clear();
            this.emitQueuedMessageChanged();
            void this.sendMessage(message, options);
        }
    }
    /**
     * Record file state for change detection.
     * Called by tools (e.g., propose_plan) after reading/writing files.
     */
    recordFileState(filePath, state) {
        this.fileChangeTracker.record(filePath, state);
    }
    /** Get the count of tracked files for UI display. */
    getTrackedFilesCount() {
        return this.fileChangeTracker.count;
    }
    /** Get the paths of tracked files for UI display. */
    getTrackedFilePaths() {
        return this.fileChangeTracker.paths;
    }
    /** Clear all tracked file state (e.g., on /clear). */
    clearFileState() {
        this.fileChangeTracker.clear();
    }
    /**
     * Get post-compaction attachments if they should be injected this turn.
     *
     * Logic:
     * - On first turn after compaction: inject immediately, clear file state cache
     * - Subsequent turns: inject every TURNS_BETWEEN_ATTACHMENTS turns
     *
     * @returns Attachments to inject, or null if none needed
     */
    async getPostCompactionAttachmentsIfNeeded() {
        // Check if compaction just occurred (immediate injection with cached diffs)
        const pendingDiffs = await this.compactionHandler.peekPendingDiffs();
        if (pendingDiffs !== null) {
            this.ackPendingPostCompactionStateOnStreamEnd = true;
            this.compactionOccurred = true;
            this.turnsSinceLastAttachment = 0;
            // Clear file state cache since history context is gone
            this.fileChangeTracker.clear();
            // Load exclusions and persistent TODO state (local workspace session data)
            const excludedItems = await this.loadExcludedItems();
            const todoAttachment = await this.loadTodoListAttachment(excludedItems);
            // Get runtime for reading plan file
            const metadataResult = await this.aiService.getWorkspaceMetadata(this.workspaceId);
            if (!metadataResult.success) {
                // Can't get metadata, skip plan reference but still include other attachments
                const attachments = [];
                if (todoAttachment) {
                    attachments.push(todoAttachment);
                }
                const editedFilesRef = attachmentService_1.AttachmentService.generateEditedFilesAttachment(pendingDiffs);
                if (editedFilesRef) {
                    attachments.push(editedFilesRef);
                }
                return attachments;
            }
            const runtime = (0, runtimeHelpers_1.createRuntimeForWorkspace)(metadataResult.data);
            const attachments = await attachmentService_1.AttachmentService.generatePostCompactionAttachments(metadataResult.data.name, metadataResult.data.projectName, this.workspaceId, pendingDiffs, runtime, excludedItems);
            if (todoAttachment) {
                // Insert TODO after plan (if present), otherwise first.
                const planIndex = attachments.findIndex((att) => att.type === "plan_file_reference");
                const insertIndex = planIndex === -1 ? 0 : planIndex + 1;
                attachments.splice(insertIndex, 0, todoAttachment);
            }
            return attachments;
        }
        // Increment turn counter
        this.turnsSinceLastAttachment++;
        // Check cooldown for subsequent injections (re-read from current history)
        if (this.compactionOccurred && this.turnsSinceLastAttachment >= attachments_1.TURNS_BETWEEN_ATTACHMENTS) {
            this.turnsSinceLastAttachment = 0;
            return this.generatePostCompactionAttachments();
        }
        return null;
    }
    /**
     * Generate post-compaction attachments by extracting diffs from message history.
     */
    async generatePostCompactionAttachments() {
        const historyResult = await this.historyService.getHistory(this.workspaceId);
        if (!historyResult.success) {
            return [];
        }
        const fileDiffs = (0, extractEditedFiles_1.extractEditedFileDiffs)(historyResult.data);
        // Load exclusions and persistent TODO state (local workspace session data)
        const excludedItems = await this.loadExcludedItems();
        const todoAttachment = await this.loadTodoListAttachment(excludedItems);
        // Get runtime for reading plan file
        const metadataResult = await this.aiService.getWorkspaceMetadata(this.workspaceId);
        if (!metadataResult.success) {
            // Can't get metadata, skip plan reference but still include other attachments
            const attachments = [];
            if (todoAttachment) {
                attachments.push(todoAttachment);
            }
            const editedFilesRef = attachmentService_1.AttachmentService.generateEditedFilesAttachment(fileDiffs);
            if (editedFilesRef) {
                attachments.push(editedFilesRef);
            }
            return attachments;
        }
        const runtime = (0, runtimeHelpers_1.createRuntimeForWorkspace)(metadataResult.data);
        const attachments = await attachmentService_1.AttachmentService.generatePostCompactionAttachments(metadataResult.data.name, metadataResult.data.projectName, this.workspaceId, fileDiffs, runtime, excludedItems);
        if (todoAttachment) {
            // Insert TODO after plan (if present), otherwise first.
            const planIndex = attachments.findIndex((att) => att.type === "plan_file_reference");
            const insertIndex = planIndex === -1 ? 0 : planIndex + 1;
            attachments.splice(insertIndex, 0, todoAttachment);
        }
        return attachments;
    }
    /**
     * Materialize @file mentions from a user message into a persisted snapshot message.
     *
     * This reads the referenced files once and creates a synthetic message containing
     * their content. The snapshot is persisted to history so subsequent sends don't
     * re-read the files (which would bust prompt cache if files changed).
     *
     * Also registers file state for change detection via <system-file-update> diffs.
     *
     * @returns The snapshot message and list of materialized mentions, or null if no mentions found
     */
    async materializeFileAtMentionsSnapshot(messageText) {
        // Guard for test mocks that may not implement getWorkspaceMetadata
        if (typeof this.aiService.getWorkspaceMetadata !== "function") {
            return null;
        }
        const metadataResult = await this.aiService.getWorkspaceMetadata(this.workspaceId);
        if (!metadataResult.success) {
            log_1.log.debug("Cannot materialize @file mentions: workspace metadata not found", {
                workspaceId: this.workspaceId,
            });
            return null;
        }
        const metadata = metadataResult.data;
        const runtime = (0, runtimeHelpers_1.createRuntimeForWorkspace)(metadata);
        const workspacePath = runtime.getWorkspacePath(metadata.projectPath, metadata.name);
        const materialized = await (0, fileAtMentions_1.materializeFileAtMentions)(messageText, {
            runtime,
            workspacePath,
        });
        if (materialized.length === 0) {
            return null;
        }
        // Register file state for each successfully read file (for change detection)
        for (const mention of materialized) {
            if (mention.content !== undefined &&
                mention.modifiedTimeMs !== undefined &&
                mention.resolvedPath) {
                this.recordFileState(mention.resolvedPath, {
                    content: mention.content,
                    timestamp: mention.modifiedTimeMs,
                });
            }
        }
        // Create a synthetic snapshot message (not persisted here - caller handles persistence)
        const tokens = materialized.map((m) => m.token);
        const blocks = materialized.map((m) => m.block).join("\n\n");
        const snapshotId = (0, messageIds_1.createFileSnapshotMessageId)();
        const snapshotMessage = (0, message_1.createUnixMessage)(snapshotId, "user", blocks, {
            timestamp: Date.now(),
            synthetic: true,
            fileAtMentionSnapshot: tokens,
        });
        return { snapshotMessage, materializedTokens: tokens };
    }
    async materializeAgentSkillSnapshot(unixMetadata, disableWorkspaceAgents) {
        if (!unixMetadata || unixMetadata.type !== "agent-skill") {
            return null;
        }
        // Guard for test mocks that may not implement getWorkspaceMetadata.
        if (typeof this.aiService.getWorkspaceMetadata !== "function") {
            return null;
        }
        const parsedName = schemas_1.SkillNameSchema.safeParse(unixMetadata.skillName);
        if (!parsedName.success) {
            throw new Error(`Invalid agent skill name: ${unixMetadata.skillName}`);
        }
        const metadataResult = await this.aiService.getWorkspaceMetadata(this.workspaceId);
        if (!metadataResult.success) {
            throw new Error("Cannot materialize agent skill: workspace metadata not found");
        }
        const metadata = metadataResult.data;
        const runtime = (0, runtimeFactory_1.createRuntime)(metadata.runtimeConfig, {
            projectPath: metadata.projectPath,
            workspaceName: metadata.name,
        });
        // In-place workspaces (CLI/benchmarks) have projectPath === name.
        // Use the path directly instead of reconstructing via getWorkspacePath.
        const isInPlace = metadata.projectPath === metadata.name;
        const workspacePath = isInPlace
            ? metadata.projectPath
            : runtime.getWorkspacePath(metadata.projectPath, metadata.name);
        // When workspace agents are disabled, resolve skills from the project path instead of
        // the worktree so skill invocation uses the same precedence/discovery root as the UI.
        const skillDiscoveryPath = disableWorkspaceAgents ? metadata.projectPath : workspacePath;
        const resolved = await (0, agentSkillsService_1.readAgentSkill)(runtime, skillDiscoveryPath, parsedName.data);
        const skill = resolved.package;
        const body = skill.body.length > MAX_AGENT_SKILL_SNAPSHOT_CHARS
            ? `${skill.body.slice(0, MAX_AGENT_SKILL_SNAPSHOT_CHARS)}\n\n[Skill body truncated to ${MAX_AGENT_SKILL_SNAPSHOT_CHARS} characters]`
            : skill.body;
        const snapshotText = `<agent-skill name="${skill.frontmatter.name}" scope="${skill.scope}">\n${body}\n</agent-skill>`;
        const sha256 = (0, crypto_1.createHash)("sha256").update(snapshotText).digest("hex");
        // Dedupe: if we recently persisted the same snapshot, avoid inserting again.
        const historyResult = await this.historyService.getHistory(this.workspaceId);
        if (historyResult.success) {
            const recentMessages = historyResult.data.slice(Math.max(0, historyResult.data.length - 5));
            const recentSnapshot = [...recentMessages]
                .reverse()
                .find((msg) => msg.metadata?.synthetic && msg.metadata?.agentSkillSnapshot);
            const recentMeta = recentSnapshot?.metadata?.agentSkillSnapshot;
            if (recentMeta &&
                recentMeta.skillName === skill.frontmatter.name &&
                recentMeta.sha256 === sha256) {
                return null;
            }
        }
        const snapshotId = (0, messageIds_1.createAgentSkillSnapshotMessageId)();
        const snapshotMessage = (0, message_1.createUnixMessage)(snapshotId, "user", snapshotText, {
            timestamp: Date.now(),
            synthetic: true,
            agentSkillSnapshot: {
                skillName: skill.frontmatter.name,
                scope: skill.scope,
                sha256,
            },
        });
        return { snapshotMessage };
    }
    /**
     * Load excluded items from the exclusions file.
     * Returns empty set if file doesn't exist or can't be read.
     */
    async loadExcludedItems() {
        const exclusionsPath = path.join(this.config.getSessionDir(this.workspaceId), "exclusions.json");
        try {
            const data = await (0, promises_1.readFile)(exclusionsPath, "utf-8");
            const exclusions = JSON.parse(data);
            return new Set(exclusions.excludedItems);
        }
        catch {
            return new Set();
        }
    }
    coerceTodoItems(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        const result = [];
        for (const item of value) {
            if (!item || typeof item !== "object")
                continue;
            const content = item.content;
            const status = item.status;
            if (typeof content !== "string")
                continue;
            if (status !== "pending" && status !== "in_progress" && status !== "completed")
                continue;
            result.push({ content, status });
        }
        return result;
    }
    async loadTodoListAttachment(excludedItems) {
        if (excludedItems.has("todo")) {
            return null;
        }
        const todoPath = path.join(this.config.getSessionDir(this.workspaceId), "todos.json");
        try {
            const data = await (0, promises_1.readFile)(todoPath, "utf-8");
            const parsed = JSON.parse(data);
            const todos = this.coerceTodoItems(parsed);
            if (todos.length === 0) {
                return null;
            }
            return {
                type: "todo_list",
                todos,
            };
        }
        catch {
            // File missing or unreadable
            return null;
        }
    }
    /** Delegate to FileChangeTracker for external file change detection. */
    async getChangedFileAttachments() {
        return this.fileChangeTracker.getChangedAttachments();
    }
    /**
     * Peek at cached file paths from pending compaction.
     * Returns paths that will be reinjected, or null if no pending compaction.
     */
    getPendingTrackedFilePaths() {
        return this.compactionHandler.peekCachedFilePaths();
    }
    assertNotDisposed(operation) {
        (0, assert_1.default)(!this.disposed, `AgentSession.${operation} called after dispose`);
    }
}
exports.AgentSession = AgentSession;
//# sourceMappingURL=agentSession.js.map