"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAiStreamPlayer = void 0;
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const message_1 = require("../../../common/types/message");
const result_1 = require("../../../common/types/result");
const sendMessageError_1 = require("../../../node/services/utils/sendMessageError");
const log_1 = require("../../../node/services/log");
const mockAiRouter_1 = require("./mockAiRouter");
const mockAiStreamAdapter_1 = require("./mockAiStreamAdapter");
const tokenizer_1 = require("../../../node/utils/main/tokenizer");
const knownModels_1 = require("../../../common/constants/knownModels");
const MOCK_TOKENIZER_MODEL = knownModels_1.KNOWN_MODELS.GPT.id;
const TOKENIZE_TIMEOUT_MS = 150;
let tokenizerFallbackLogged = false;
let tokenizerUnavailableLogged = false;
function approximateTokenCount(text) {
    const normalizedLength = text.trim().length;
    if (normalizedLength === 0) {
        return 0;
    }
    return Math.max(1, Math.ceil(normalizedLength / 4));
}
async function tokenizeWithMockModel(text, context) {
    (0, assert_1.default)(typeof text === "string", `Mock stream ${context} expects string input`);
    // Prefer fast approximate token counting in mock mode.
    // We only use the real tokenizer if it's available and responds quickly.
    const approximateTokens = approximateTokenCount(text);
    let fallbackUsed = false;
    let timeoutId;
    let tokenizerErrorMessage;
    const fallbackPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
            fallbackUsed = true;
            resolve(approximateTokens);
        }, TOKENIZE_TIMEOUT_MS);
    });
    const actualPromise = (async () => {
        try {
            const tokenizer = await (0, tokenizer_1.getTokenizerForModel)(MOCK_TOKENIZER_MODEL);
            (0, assert_1.default)(typeof tokenizer.encoding === "string" && tokenizer.encoding.length > 0, `Tokenizer for ${MOCK_TOKENIZER_MODEL} must expose a non-empty encoding`);
            const tokens = await tokenizer.countTokens(text);
            (0, assert_1.default)(Number.isFinite(tokens) && tokens >= 0, `Tokenizer for ${MOCK_TOKENIZER_MODEL} returned invalid token count`);
            return tokens;
        }
        catch (error) {
            tokenizerErrorMessage = error instanceof Error ? error.message : String(error);
            return approximateTokens;
        }
    })();
    const tokens = await Promise.race([actualPromise, fallbackPromise]);
    if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
    }
    if (fallbackUsed && !tokenizerFallbackLogged) {
        tokenizerFallbackLogged = true;
        void actualPromise.then((resolvedTokens) => {
            log_1.log.debug(`[MockAiStreamPlayer] Tokenizer fallback used for ${context}; emitted ${approximateTokens}, background tokenizer returned ${resolvedTokens}`);
        });
    }
    if (tokenizerErrorMessage && !tokenizerUnavailableLogged) {
        tokenizerUnavailableLogged = true;
        log_1.log.debug(`[MockAiStreamPlayer] Tokenizer unavailable for ${context}; using approximate (${tokenizerErrorMessage})`);
    }
    (0, assert_1.default)(Number.isFinite(tokens) && tokens >= 0, `Token counting produced invalid count for ${context}`);
    return tokens;
}
class MockAiStreamPlayer {
    deps;
    streamStartGates = new Map();
    releasedStreamStartGates = new Set();
    router = new mockAiRouter_1.MockAiRouter();
    lastPromptByWorkspace = new Map();
    activeStreams = new Map();
    nextMockMessageId = 0;
    constructor(deps) {
        this.deps = deps;
    }
    debugGetLastPrompt(workspaceId) {
        return this.lastPromptByWorkspace.get(workspaceId) ?? null;
    }
    recordLastPrompt(workspaceId, messages) {
        try {
            const cloned = typeof structuredClone === "function"
                ? structuredClone(messages)
                : JSON.parse(JSON.stringify(messages));
            this.lastPromptByWorkspace.set(workspaceId, cloned);
        }
        catch {
            this.lastPromptByWorkspace.set(workspaceId, messages);
        }
    }
    isStreaming(workspaceId) {
        return this.activeStreams.has(workspaceId);
    }
    releaseStreamStartGate(workspaceId) {
        const gate = this.streamStartGates.get(workspaceId);
        if (!gate) {
            this.releasedStreamStartGates.add(workspaceId);
            return;
        }
        gate.resolve();
    }
    getStreamStartGate(workspaceId) {
        const existing = this.streamStartGates.get(workspaceId);
        if (existing) {
            return existing;
        }
        let resolve;
        const promise = new Promise((res) => {
            resolve = res;
        });
        const gate = { promise, resolve };
        this.streamStartGates.set(workspaceId, gate);
        return gate;
    }
    async waitForStreamStartGate(workspaceId, abortSignal) {
        if (this.releasedStreamStartGates.delete(workspaceId)) {
            return;
        }
        const gate = this.getStreamStartGate(workspaceId);
        let resolved = false;
        await new Promise((resolve) => {
            const finish = () => {
                if (resolved)
                    return;
                resolved = true;
                this.streamStartGates.delete(workspaceId);
                if (abortSignal) {
                    abortSignal.removeEventListener("abort", finish);
                }
                resolve();
            };
            void gate.promise.then(finish);
            if (abortSignal) {
                if (abortSignal.aborted) {
                    finish();
                    return;
                }
                abortSignal.addEventListener("abort", finish, { once: true });
            }
        });
    }
    stop(workspaceId) {
        const active = this.activeStreams.get(workspaceId);
        if (!active)
            return;
        active.cancelled = true;
        // Emit stream-abort event to mirror real streaming behavior
        this.deps.aiService.emit("stream-abort", {
            type: "stream-abort",
            workspaceId,
            messageId: active.messageId,
            reason: "user_cancelled",
        });
        this.cleanup(workspaceId);
    }
    async play(messages, workspaceId, options) {
        const abortSignal = options?.abortSignal;
        if (abortSignal?.aborted) {
            return (0, result_1.Ok)(undefined);
        }
        const latest = messages[messages.length - 1];
        if (!latest || latest.role !== "user") {
            return (0, result_1.Err)({ type: "unknown", raw: "Mock AI expected a user message" });
        }
        const latestText = this.extractText(latest);
        this.recordLastPrompt(workspaceId, messages);
        const reply = this.router.route({
            messages,
            latestUserMessage: latest,
            latestUserText: latestText,
        });
        const messageId = `msg-mock-${this.nextMockMessageId++}`;
        if (reply.waitForStreamStart) {
            await this.waitForStreamStartGate(workspaceId, abortSignal);
            if (abortSignal?.aborted) {
                return (0, result_1.Ok)(undefined);
            }
        }
        const events = (0, mockAiStreamAdapter_1.buildMockStreamEventsFromReply)(reply, {
            messageId,
            model: options?.model,
        });
        const streamStart = events.find((event) => event.kind === "stream-start");
        if (!streamStart) {
            return (0, result_1.Err)({ type: "unknown", raw: "Mock AI turn missing stream-start" });
        }
        const streamStartTimeoutMs = 5000;
        const streamStartPromise = new Promise((resolve) => {
            let resolved = false;
            // eslint-disable-next-line prefer-const -- assigned once but after cleanup() is defined
            let timeoutId;
            const onStreamStart = (event) => {
                if (event.workspaceId !== workspaceId || event.messageId !== messageId) {
                    return;
                }
                cleanup();
            };
            const cleanup = () => {
                if (resolved)
                    return;
                resolved = true;
                this.deps.aiService.off("stream-start", onStreamStart);
                clearTimeout(timeoutId);
                resolve();
            };
            this.deps.aiService.on("stream-start", onStreamStart);
            if (abortSignal) {
                if (abortSignal.aborted) {
                    cleanup();
                    return;
                }
                abortSignal.addEventListener("abort", cleanup, { once: true });
            }
            timeoutId = setTimeout(cleanup, streamStartTimeoutMs);
        });
        let historySequence = this.computeNextHistorySequence(messages);
        const assistantMessage = (0, message_1.createUnixMessage)(messageId, "assistant", "", {
            timestamp: Date.now(),
            model: streamStart.model,
        });
        if (abortSignal?.aborted) {
            return (0, result_1.Ok)(undefined);
        }
        const appendResult = await this.deps.historyService.appendToHistory(workspaceId, assistantMessage);
        if (!appendResult.success) {
            return (0, result_1.Err)({ type: "unknown", raw: appendResult.error });
        }
        if (abortSignal?.aborted) {
            const deleteResult = await this.deps.historyService.deleteMessage(workspaceId, messageId);
            if (!deleteResult.success) {
                log_1.log.error(`Failed to delete aborted mock assistant placeholder (${messageId}): ${deleteResult.error}`);
            }
            return (0, result_1.Ok)(undefined);
        }
        historySequence = assistantMessage.metadata?.historySequence ?? historySequence;
        // Cancel any existing stream before starting a new one
        if (this.isStreaming(workspaceId)) {
            this.stop(workspaceId);
        }
        this.scheduleEvents(workspaceId, events, messageId, historySequence);
        await streamStartPromise;
        if (abortSignal?.aborted) {
            return (0, result_1.Ok)(undefined);
        }
        return (0, result_1.Ok)(undefined);
    }
    async replayStream(_workspaceId) {
        // No-op for mock streams; events are deterministic and do not support mid-stream replay.
    }
    scheduleEvents(workspaceId, events, messageId, historySequence) {
        const timers = [];
        this.activeStreams.set(workspaceId, {
            timers,
            messageId,
            eventQueue: [],
            isProcessing: false,
            cancelled: false,
        });
        for (const event of events) {
            const timer = setTimeout(() => {
                this.enqueueEvent(workspaceId, messageId, () => this.dispatchEvent(workspaceId, event, messageId, historySequence));
            }, event.delay);
            timers.push(timer);
        }
    }
    enqueueEvent(workspaceId, messageId, handler) {
        const active = this.activeStreams.get(workspaceId);
        if (!active || active.cancelled || active.messageId !== messageId)
            return;
        active.eventQueue.push(handler);
        void this.processQueue(workspaceId);
    }
    async processQueue(workspaceId) {
        const active = this.activeStreams.get(workspaceId);
        if (!active || active.isProcessing)
            return;
        active.isProcessing = true;
        while (active.eventQueue.length > 0) {
            const handler = active.eventQueue.shift();
            if (!handler)
                break;
            try {
                await handler();
            }
            catch (error) {
                log_1.log.error(`Event handler error for ${workspaceId}:`, error);
            }
        }
        active.isProcessing = false;
    }
    async dispatchEvent(workspaceId, event, messageId, historySequence) {
        const active = this.activeStreams.get(workspaceId);
        if (!active || active.cancelled || active.messageId !== messageId) {
            return;
        }
        switch (event.kind) {
            case "stream-start": {
                const payload = {
                    type: "stream-start",
                    workspaceId,
                    messageId,
                    model: event.model,
                    historySequence,
                    startTime: Date.now(),
                    ...(event.mode && { mode: event.mode }),
                };
                this.deps.aiService.emit("stream-start", payload);
                break;
            }
            case "reasoning-delta": {
                // Mock streams use the same tokenization logic as real streams for consistency
                const tokens = await tokenizeWithMockModel(event.text, "reasoning-delta text");
                if (active.cancelled)
                    return;
                const payload = {
                    type: "reasoning-delta",
                    workspaceId,
                    messageId,
                    delta: event.text,
                    tokens,
                    timestamp: Date.now(),
                };
                this.deps.aiService.emit("reasoning-delta", payload);
                break;
            }
            case "tool-start": {
                // Mock streams use the same tokenization logic as real streams for consistency
                const inputText = JSON.stringify(event.args);
                const tokens = await tokenizeWithMockModel(inputText, "tool-call args");
                if (active.cancelled)
                    return;
                const payload = {
                    type: "tool-call-start",
                    workspaceId,
                    messageId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: event.args,
                    tokens,
                    timestamp: Date.now(),
                };
                this.deps.aiService.emit("tool-call-start", payload);
                break;
            }
            case "usage-delta": {
                const payload = {
                    type: "usage-delta",
                    workspaceId,
                    messageId,
                    usage: event.usage,
                    providerMetadata: event.providerMetadata,
                    cumulativeUsage: event.cumulativeUsage,
                    cumulativeProviderMetadata: event.cumulativeProviderMetadata,
                };
                this.deps.aiService.emit("usage-delta", payload);
                break;
            }
            case "tool-end": {
                const payload = {
                    type: "tool-call-end",
                    workspaceId,
                    messageId,
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    result: event.result,
                    timestamp: Date.now(),
                };
                this.deps.aiService.emit("tool-call-end", payload);
                break;
            }
            case "stream-delta": {
                // Mock streams use the same tokenization logic as real streams for consistency
                let tokens;
                try {
                    tokens = await tokenizeWithMockModel(event.text, "stream-delta text");
                }
                catch (error) {
                    log_1.log.error("tokenize failed for stream-delta", error);
                    throw error;
                }
                const payload = {
                    type: "stream-delta",
                    workspaceId,
                    messageId,
                    delta: event.text,
                    tokens,
                    timestamp: Date.now(),
                };
                this.deps.aiService.emit("stream-delta", payload);
                break;
            }
            case "stream-error": {
                const payload = event;
                this.deps.aiService.emit("error", (0, sendMessageError_1.createErrorEvent)(workspaceId, {
                    messageId,
                    error: payload.error,
                    errorType: payload.errorType,
                }));
                this.cleanup(workspaceId);
                break;
            }
            case "stream-end": {
                const payload = {
                    type: "stream-end",
                    workspaceId,
                    messageId,
                    metadata: {
                        model: event.metadata.model,
                        systemMessageTokens: event.metadata.systemMessageTokens,
                    },
                    parts: event.parts,
                };
                // Update history with completed message (mirrors real StreamManager behavior)
                // Fetch the current message from history to get its historySequence
                const historyResult = await this.deps.historyService.getHistory(workspaceId);
                if (active.cancelled)
                    return;
                if (historyResult.success) {
                    const existingMessage = historyResult.data.find((msg) => msg.id === messageId);
                    if (existingMessage?.metadata?.historySequence !== undefined) {
                        const completedMessage = {
                            id: messageId,
                            role: "assistant",
                            parts: event.parts,
                            metadata: {
                                ...existingMessage.metadata,
                                model: event.metadata.model,
                                systemMessageTokens: event.metadata.systemMessageTokens,
                            },
                        };
                        const updateResult = await this.deps.historyService.updateHistory(workspaceId, completedMessage);
                        if (!updateResult.success) {
                            log_1.log.error(`Failed to update history for ${messageId}: ${updateResult.error}`);
                        }
                    }
                }
                if (active.cancelled)
                    return;
                this.deps.aiService.emit("stream-end", payload);
                this.cleanup(workspaceId);
                break;
            }
        }
    }
    cleanup(workspaceId) {
        const active = this.activeStreams.get(workspaceId);
        if (!active)
            return;
        active.cancelled = true;
        // Clear all pending timers
        for (const timer of active.timers) {
            clearTimeout(timer);
        }
        // Clear event queue to prevent any pending events from processing
        active.eventQueue = [];
        this.activeStreams.delete(workspaceId);
    }
    extractText(message) {
        return message.parts
            .filter((part) => "text" in part)
            .map((part) => part.text)
            .join("");
    }
    computeNextHistorySequence(messages) {
        let maxSequence = 0;
        for (const message of messages) {
            const seq = message.metadata?.historySequence;
            if (typeof seq === "number" && seq > maxSequence) {
                maxSequence = seq;
            }
        }
        return maxSequence + 1;
    }
}
exports.MockAiStreamPlayer = MockAiStreamPlayer;
//# sourceMappingURL=mockAiStreamPlayer.js.map