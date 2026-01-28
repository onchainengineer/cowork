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
exports.CompactionHandler = void 0;
const fsPromises = __importStar(require("fs/promises"));
const assert_1 = __importDefault(require("../../common/utils/assert"));
const path = __importStar(require("path"));
const result_1 = require("../../common/types/result");
const message_1 = require("../../common/types/message");
const messageIds_1 = require("../../node/services/utils/messageIds");
const attachments_1 = require("../../common/constants/attachments");
const utils_1 = require("../../common/telemetry/utils");
const log_1 = require("../../node/services/log");
const recency_1 = require("../../common/utils/recency");
const extractEditedFiles_1 = require("../../common/utils/messages/extractEditedFiles");
/**
 * Check if a string is just a raw JSON object, which suggests the model
 * tried to output a tool call as text (happens when tools are disabled).
 *
 * A valid compaction summary should be prose text describing the conversation,
 * not a JSON blob. This general check catches any tool that might leak through.
 */
function looksLikeRawJsonObject(text) {
    const trimmed = text.trim();
    // Must be a JSON object (not array, not primitive)
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return false;
    }
    try {
        const parsed = JSON.parse(trimmed);
        // Must parse as a non-null, non-array object
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    }
    catch {
        return false;
    }
}
const POST_COMPACTION_STATE_FILENAME = "post-compaction.json";
function coerceFileEditDiffs(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const diffs = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            continue;
        }
        const filePath = item.path;
        const diff = item.diff;
        const truncated = item.truncated;
        if (typeof filePath !== "string")
            continue;
        const trimmedPath = filePath.trim();
        if (trimmedPath.length === 0)
            continue;
        if (typeof diff !== "string")
            continue;
        if (typeof truncated !== "boolean")
            continue;
        const clampedDiff = diff.length > attachments_1.MAX_FILE_CONTENT_SIZE ? diff.slice(0, attachments_1.MAX_FILE_CONTENT_SIZE) : diff;
        diffs.push({
            path: trimmedPath,
            diff: clampedDiff,
            truncated: truncated || diff.length > attachments_1.MAX_FILE_CONTENT_SIZE,
        });
        if (diffs.length >= attachments_1.MAX_EDITED_FILES) {
            break;
        }
    }
    return diffs;
}
function coercePersistedPostCompactionState(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const version = value.version;
    if (version !== 1) {
        return null;
    }
    const createdAt = value.createdAt;
    if (typeof createdAt !== "number") {
        return null;
    }
    const diffsRaw = value.diffs;
    const diffs = coerceFileEditDiffs(diffsRaw);
    return {
        version: 1,
        createdAt,
        diffs,
    };
}
/**
 * Handles history compaction for agent sessions
 *
 * Responsible for:
 * - Detecting compaction requests in stream events
 * - Replacing chat history with compacted summaries
 * - Preserving cumulative usage across compactions
 */
class CompactionHandler {
    workspaceId;
    historyService;
    sessionDir;
    postCompactionStatePath;
    persistedPendingStateLoaded = false;
    partialService;
    telemetryService;
    emitter;
    processedCompactionRequestIds = new Set();
    onCompactionComplete;
    /** Flag indicating post-compaction attachments should be generated on next turn */
    postCompactionAttachmentsPending = false;
    /** Cached file diffs extracted before history was cleared */
    cachedFileDiffs = [];
    constructor(options) {
        (0, assert_1.default)(options, "CompactionHandler requires options");
        (0, assert_1.default)(typeof options.sessionDir === "string", "sessionDir must be a string");
        const trimmedSessionDir = options.sessionDir.trim();
        (0, assert_1.default)(trimmedSessionDir.length > 0, "sessionDir must not be empty");
        this.workspaceId = options.workspaceId;
        this.historyService = options.historyService;
        this.sessionDir = trimmedSessionDir;
        this.postCompactionStatePath = path.join(trimmedSessionDir, POST_COMPACTION_STATE_FILENAME);
        this.partialService = options.partialService;
        this.telemetryService = options.telemetryService;
        this.emitter = options.emitter;
        this.onCompactionComplete = options.onCompactionComplete;
    }
    async loadPersistedPendingStateIfNeeded() {
        if (this.persistedPendingStateLoaded || this.postCompactionAttachmentsPending) {
            return;
        }
        this.persistedPendingStateLoaded = true;
        let raw;
        try {
            raw = await fsPromises.readFile(this.postCompactionStatePath, "utf-8");
        }
        catch {
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            log_1.log.warn("Invalid post-compaction state JSON; ignoring", { workspaceId: this.workspaceId });
            await this.deletePersistedPendingStateBestEffort();
            return;
        }
        const state = coercePersistedPostCompactionState(parsed);
        if (!state) {
            log_1.log.warn("Invalid post-compaction state schema; ignoring", { workspaceId: this.workspaceId });
            await this.deletePersistedPendingStateBestEffort();
            return;
        }
        // Note: We intentionally do not validate against chat history here.
        // The presence of this file is the source of truth that a compaction occurred (or at least started),
        // and pre-compaction diffs may have been deleted from history.
        this.cachedFileDiffs = state.diffs;
        this.postCompactionAttachmentsPending = true;
    }
    /**
     * Peek pending post-compaction diffs without consuming them.
     * Returns null if no compaction occurred, otherwise returns the cached diffs.
     */
    async peekPendingDiffs() {
        if (!this.postCompactionAttachmentsPending) {
            await this.loadPersistedPendingStateIfNeeded();
        }
        if (!this.postCompactionAttachmentsPending) {
            return null;
        }
        return this.cachedFileDiffs;
    }
    /**
     * Acknowledge that pending post-compaction state has been consumed successfully.
     * Clears in-memory state and deletes the persisted snapshot from disk.
     */
    async ackPendingDiffsConsumed() {
        // If we never loaded persisted state but it exists, clear it anyway.
        if (!this.postCompactionAttachmentsPending && !this.persistedPendingStateLoaded) {
            await this.loadPersistedPendingStateIfNeeded();
        }
        this.postCompactionAttachmentsPending = false;
        this.cachedFileDiffs = [];
        await this.deletePersistedPendingStateBestEffort();
    }
    /**
     * Drop pending post-compaction state (e.g., because it caused context_exceeded).
     */
    async discardPendingDiffs(reason) {
        await this.loadPersistedPendingStateIfNeeded();
        if (!this.postCompactionAttachmentsPending) {
            return;
        }
        log_1.log.warn("Discarding pending post-compaction state", {
            workspaceId: this.workspaceId,
            reason,
            trackedFiles: this.cachedFileDiffs.length,
        });
        await this.ackPendingDiffsConsumed();
    }
    async deletePersistedPendingStateBestEffort() {
        try {
            await fsPromises.unlink(this.postCompactionStatePath);
        }
        catch {
            // ignore
        }
    }
    async persistPendingStateBestEffort(diffs) {
        try {
            await fsPromises.mkdir(this.sessionDir, { recursive: true });
            const persisted = {
                version: 1,
                createdAt: Date.now(),
                diffs,
            };
            await fsPromises.writeFile(this.postCompactionStatePath, JSON.stringify(persisted));
        }
        catch (error) {
            log_1.log.warn("Failed to persist post-compaction state", {
                workspaceId: this.workspaceId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Peek at cached file paths without consuming them.
     * Returns paths of files that will be reinjected after compaction.
     * Returns null if no pending compaction attachments.
     */
    peekCachedFilePaths() {
        if (!this.postCompactionAttachmentsPending) {
            return null;
        }
        return this.cachedFileDiffs.map((diff) => diff.path);
    }
    /**
     * Handle compaction stream completion
     *
     * Detects when a compaction stream finishes, extracts the summary,
     * and performs history replacement atomically.
     */
    async handleCompletion(event) {
        // Check if the last user message is a compaction-request
        const historyResult = await this.historyService.getHistory(this.workspaceId);
        if (!historyResult.success) {
            return false;
        }
        const messages = historyResult.data;
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        const unixMeta = lastUserMsg?.metadata?.unixMetadata;
        const isCompaction = unixMeta?.type === "compaction-request";
        if (!isCompaction || !lastUserMsg) {
            return false;
        }
        // Dedupe: If we've already processed this compaction-request, skip
        if (this.processedCompactionRequestIds.has(lastUserMsg.id)) {
            return true;
        }
        const summary = event.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("");
        // Self-healing: Reject empty summaries (stream crashed before producing content)
        if (!summary.trim()) {
            // Log detailed part info to help debug why no text was produced
            const partsSummary = event.parts.map((p) => ({
                type: p.type,
                // Include preview for text-like parts to understand what the model produced
                preview: "text" in p && typeof p.text === "string" ? p.text.slice(0, 100) : undefined,
            }));
            log_1.log.warn("Compaction summary is empty - aborting compaction to prevent corrupted history", {
                workspaceId: this.workspaceId,
                model: event.metadata.model,
                partsCount: event.parts.length,
                parts: partsSummary,
            });
            // Don't mark as processed so user can retry
            return false;
        }
        // Self-healing: Reject compaction if summary is just a raw JSON object.
        // This happens when tools are disabled but the model still tries to output a tool call.
        // A valid summary should be prose text, not a JSON blob.
        if (looksLikeRawJsonObject(summary)) {
            log_1.log.warn("Compaction summary is a raw JSON object - aborting compaction to prevent corrupted history", {
                workspaceId: this.workspaceId,
                summaryPreview: summary.slice(0, 200),
            });
            // Don't mark as processed so user can retry
            return false;
        }
        // Check if this was an idle-compaction (auto-triggered due to inactivity)
        const isIdleCompaction = unixMeta?.type === "compaction-request" && unixMeta.source === "idle-compaction";
        // Mark as processed before performing compaction
        this.processedCompactionRequestIds.add(lastUserMsg.id);
        const result = await this.performCompaction(summary, event.metadata, messages, isIdleCompaction);
        if (!result.success) {
            log_1.log.error("Compaction failed:", result.error);
            return false;
        }
        const durationSecs = typeof event.metadata.duration === "number" ? event.metadata.duration / 1000 : 0;
        const inputTokens = event.metadata.contextUsage?.inputTokens ?? event.metadata.usage?.inputTokens ?? 0;
        const outputTokens = event.metadata.contextUsage?.outputTokens ?? event.metadata.usage?.outputTokens ?? 0;
        this.telemetryService?.capture({
            event: "compaction_completed",
            properties: {
                model: event.metadata.model,
                duration_b2: (0, utils_1.roundToBase2)(durationSecs),
                input_tokens_b2: (0, utils_1.roundToBase2)(inputTokens ?? 0),
                output_tokens_b2: (0, utils_1.roundToBase2)(outputTokens ?? 0),
                compaction_source: isIdleCompaction ? "idle" : "manual",
            },
        });
        // Notify that compaction completed (clears idle compaction pending state)
        this.onCompactionComplete?.();
        // Emit stream-end to frontend so UI knows compaction is complete
        this.emitChatEvent(event);
        return true;
    }
    /**
     * Perform history compaction by replacing all messages with a summary
     *
     * Steps:
     * 1. Clear entire history and get deleted sequence numbers
     * 2. Append summary message with metadata
     * 3. Emit delete event for old messages
     * 4. Emit summary message to frontend
     */
    async performCompaction(summary, metadata, messages, isIdleCompaction = false) {
        // CRITICAL: Delete partial.json BEFORE clearing history
        // This prevents a race condition where:
        // 1. CompactionHandler clears history and appends summary
        // 2. sendQueuedMessages triggers commitToHistory
        // 3. commitToHistory finds stale partial.json and appends it to history
        // By deleting partial first, commitToHistory becomes a no-op
        const deletePartialResult = await this.partialService.deletePartial(this.workspaceId);
        if (!deletePartialResult.success) {
            log_1.log.warn(`Failed to delete partial before compaction: ${deletePartialResult.error}`);
            // Continue anyway - the partial may not exist, which is fine
        }
        // Extract diffs BEFORE clearing history (they'll be gone after clear)
        this.cachedFileDiffs = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        // Persist pending state BEFORE clearing history so pre-compaction diffs survive crashes/restarts.
        // Best-effort: compaction must not fail just because persistence fails.
        await this.persistPendingStateBestEffort(this.cachedFileDiffs);
        // Clear entire history and get deleted sequences
        const clearResult = await this.historyService.clearHistory(this.workspaceId);
        if (!clearResult.success) {
            // We persist post-compaction state before clearing history for crash safety.
            // If clearHistory fails, the pre-compaction messages are still intact, so keeping the
            // persisted snapshot would cause redundant injection on the next send.
            this.cachedFileDiffs = [];
            await this.deletePersistedPendingStateBestEffort();
            return (0, result_1.Err)(`Failed to clear history: ${clearResult.error}`);
        }
        const deletedSequences = clearResult.data;
        // For idle compaction, preserve the original recency timestamp so the workspace
        // doesn't appear "recently used" in the sidebar. Use the shared recency utility
        // to ensure consistency with how the sidebar computes recency.
        let timestamp = Date.now();
        if (isIdleCompaction) {
            const recency = (0, recency_1.computeRecencyFromMessages)(messages);
            if (recency !== null) {
                timestamp = recency;
            }
        }
        // Create summary message with metadata.
        // We omit providerMetadata because it contains cacheCreationInputTokens from the
        // pre-compaction context, which inflates context usage display.
        // Note: We no longer store historicalUsage here. Cumulative costs are tracked in
        // session-usage.json, which is updated on every stream-end. If that file is deleted
        // or corrupted, pre-compaction costs are lost - this is acceptable since manual
        // file deletion is out of scope for data recovery.
        const summaryMessage = (0, message_1.createUnixMessage)((0, messageIds_1.createCompactionSummaryMessageId)(), "assistant", summary, {
            timestamp,
            compacted: isIdleCompaction ? "idle" : "user",
            model: metadata.model,
            usage: metadata.usage,
            duration: metadata.duration,
            systemMessageTokens: metadata.systemMessageTokens,
            unixMetadata: { type: "normal" },
        });
        // Append summary to history
        const appendResult = await this.historyService.appendToHistory(this.workspaceId, summaryMessage);
        if (!appendResult.success) {
            return (0, result_1.Err)(`Failed to append summary: ${appendResult.error}`);
        }
        // Set flag to trigger post-compaction attachment injection on next turn
        this.postCompactionAttachmentsPending = true;
        // Emit delete event for old messages
        if (deletedSequences.length > 0) {
            const deleteMessage = {
                type: "delete",
                historySequences: deletedSequences,
            };
            this.emitChatEvent(deleteMessage);
        }
        // Emit summary message to frontend (add type: "message" for discriminated union)
        this.emitChatEvent({ ...summaryMessage, type: "message" });
        return (0, result_1.Ok)(undefined);
    }
    /**
     * Emit chat event through the session's emitter
     */
    emitChatEvent(message) {
        this.emitter.emit("chat-event", {
            workspaceId: this.workspaceId,
            message,
        });
    }
}
exports.CompactionHandler = CompactionHandler;
//# sourceMappingURL=compactionHandler.js.map