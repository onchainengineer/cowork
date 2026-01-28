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
const bun_test_1 = require("bun:test");
const compactionHandler_1 = require("./compactionHandler");
const fsPromises = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const message_1 = require("../../common/types/message");
const result_1 = require("../../common/types/result");
const createMockHistoryService = () => {
    let getHistoryResult = (0, result_1.Ok)([]);
    let clearHistoryResult = (0, result_1.Ok)([]);
    let appendToHistoryResult = (0, result_1.Ok)(undefined);
    const getHistory = (0, bun_test_1.mock)((_) => Promise.resolve(getHistoryResult));
    const clearHistory = (0, bun_test_1.mock)((_) => Promise.resolve(clearHistoryResult));
    const appendToHistory = (0, bun_test_1.mock)((_, __) => Promise.resolve(appendToHistoryResult));
    const updateHistory = (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined)));
    const truncateAfterMessage = (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined)));
    return {
        getHistory,
        clearHistory,
        appendToHistory,
        updateHistory,
        truncateAfterMessage,
        // Allow setting mock return values
        mockGetHistory: (result) => {
            getHistoryResult = result;
        },
        mockClearHistory: (result) => {
            clearHistoryResult = result;
        },
        mockAppendToHistory: (result) => {
            appendToHistoryResult = result;
        },
    };
};
const createMockPartialService = () => {
    let deletePartialResult = (0, result_1.Ok)(undefined);
    const deletePartial = (0, bun_test_1.mock)((_) => Promise.resolve(deletePartialResult));
    const readPartial = (0, bun_test_1.mock)((_) => Promise.resolve(null));
    const writePartial = (0, bun_test_1.mock)((_, __) => Promise.resolve((0, result_1.Ok)(undefined)));
    const commitToHistory = (0, bun_test_1.mock)((_) => Promise.resolve((0, result_1.Ok)(undefined)));
    return {
        deletePartial,
        readPartial,
        writePartial,
        commitToHistory,
        // Allow setting mock return values
        mockDeletePartial: (result) => {
            deletePartialResult = result;
        },
    };
};
const createMockEmitter = () => {
    const events = [];
    const emitter = {
        emit: (_event, data) => {
            events.push({ event: _event, data });
            return true;
        },
    };
    return { emitter: emitter, events };
};
const createCompactionRequest = (id = "req-1") => (0, message_1.createUnixMessage)(id, "user", "Please summarize the conversation", {
    historySequence: 0,
    unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
});
const createStreamEndEvent = (summary, metadata) => ({
    type: "stream-end",
    workspaceId: "test-workspace",
    messageId: "msg-id",
    parts: [{ type: "text", text: summary }],
    metadata: {
        model: "claude-3-5-sonnet-20241022",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: undefined },
        duration: 1500,
        ...metadata,
    },
});
// DRY helper to set up successful compaction scenario
const setupSuccessfulCompaction = (mockHistoryService, messages = [createCompactionRequest()], clearedSequences) => {
    mockHistoryService.mockGetHistory((0, result_1.Ok)(messages));
    mockHistoryService.mockClearHistory((0, result_1.Ok)(clearedSequences ?? messages.map((_, i) => i)));
    mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
};
(0, bun_test_1.describe)("CompactionHandler", () => {
    let handler;
    let mockHistoryService;
    let mockPartialService;
    let mockEmitter;
    let telemetryCapture;
    let telemetryService;
    let sessionDir;
    let emittedEvents;
    const workspaceId = "test-workspace";
    (0, bun_test_1.beforeEach)(async () => {
        const { emitter, events } = createMockEmitter();
        mockEmitter = emitter;
        emittedEvents = events;
        telemetryCapture = (0, bun_test_1.mock)((_payload) => {
            void _payload;
        });
        telemetryService = { capture: telemetryCapture };
        sessionDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-compaction-handler-"));
        mockHistoryService = createMockHistoryService();
        mockPartialService = createMockPartialService();
        handler = new compactionHandler_1.CompactionHandler({
            workspaceId,
            historyService: mockHistoryService,
            partialService: mockPartialService,
            sessionDir,
            telemetryService,
            emitter: mockEmitter,
        });
    });
    (0, bun_test_1.describe)("handleCompletion() - Normal Compaction Flow", () => {
        (0, bun_test_1.it)("should return false when no compaction request found", async () => {
            const normalMsg = (0, message_1.createUnixMessage)("msg1", "user", "Hello", {
                historySequence: 0,
                unixMetadata: { type: "normal" },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([normalMsg]));
            const event = createStreamEndEvent("Summary");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory.mock.calls).toHaveLength(0);
        });
        (0, bun_test_1.it)("should return false when historyService fails", async () => {
            mockHistoryService.mockGetHistory((0, result_1.Err)("Database error"));
            const event = createStreamEndEvent("Summary");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
        });
        (0, bun_test_1.it)("should capture compaction_completed telemetry on successful compaction", async () => {
            const compactionReq = createCompactionRequest();
            setupSuccessfulCompaction(mockHistoryService, [compactionReq]);
            const event = createStreamEndEvent("Summary", {
                duration: 1500,
                // Prefer contextUsage (context size) over total usage.
                contextUsage: { inputTokens: 1000, outputTokens: 333, totalTokens: undefined },
            });
            await handler.handleCompletion(event);
            (0, bun_test_1.expect)(telemetryCapture.mock.calls).toHaveLength(1);
            const payload = telemetryCapture.mock.calls[0][0];
            (0, bun_test_1.expect)(payload.event).toBe("compaction_completed");
            if (payload.event !== "compaction_completed") {
                throw new Error("Expected compaction_completed payload");
            }
            (0, bun_test_1.expect)(payload.properties).toEqual({
                model: "claude-3-5-sonnet-20241022",
                // 1.5s -> 2
                duration_b2: 2,
                // 1000 -> 1024
                input_tokens_b2: 1024,
                // 333 -> 512
                output_tokens_b2: 512,
                compaction_source: "manual",
            });
        });
        (0, bun_test_1.it)("persists pending diffs to disk and reloads them on restart", async () => {
            const compactionReq = createCompactionRequest();
            const fileEditMessage = {
                id: "assistant-edit",
                role: "assistant",
                parts: [
                    {
                        type: "dynamic-tool",
                        toolCallId: "t1",
                        toolName: "file_edit_replace_string",
                        state: "output-available",
                        input: { file_path: "/tmp/foo.ts" },
                        output: { success: true, diff: "@@ -1 +1 @@\n-foo\n+bar\n" },
                    },
                ],
                metadata: { timestamp: 1234 },
            };
            setupSuccessfulCompaction(mockHistoryService, [fileEditMessage, compactionReq]);
            const event = createStreamEndEvent("Summary");
            const handled = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(handled).toBe(true);
            const persistedPath = path.join(sessionDir, "post-compaction.json");
            const raw = await fsPromises.readFile(persistedPath, "utf-8");
            const parsed = JSON.parse(raw);
            (0, bun_test_1.expect)(parsed.version).toBe(1);
            const diffs = parsed.diffs;
            (0, bun_test_1.expect)(Array.isArray(diffs)).toBe(true);
            if (Array.isArray(diffs)) {
                (0, bun_test_1.expect)(diffs[0]?.path).toBe("/tmp/foo.ts");
                (0, bun_test_1.expect)(diffs[0]?.diff).toContain("@@ -1 +1 @@");
            }
            // Simulate a restart: create a new handler and load from disk.
            const { emitter: newEmitter } = createMockEmitter();
            const reloaded = new compactionHandler_1.CompactionHandler({
                workspaceId,
                historyService: mockHistoryService,
                partialService: mockPartialService,
                sessionDir,
                telemetryService,
                emitter: newEmitter,
            });
            const pending = await reloaded.peekPendingDiffs();
            (0, bun_test_1.expect)(pending).not.toBeNull();
            (0, bun_test_1.expect)(pending?.[0]?.path).toBe("/tmp/foo.ts");
            await reloaded.ackPendingDiffsConsumed();
            let exists = true;
            try {
                await fsPromises.stat(persistedPath);
            }
            catch {
                exists = false;
            }
            (0, bun_test_1.expect)(exists).toBe(false);
        });
        (0, bun_test_1.it)("should return true when successful", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Complete summary");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(true);
        });
        (0, bun_test_1.it)("should join multiple text parts from event.parts", async () => {
            const compactionReq = createCompactionRequest();
            setupSuccessfulCompaction(mockHistoryService, [compactionReq]);
            // Create event with multiple text parts
            const event = {
                type: "stream-end",
                workspaceId: "test-workspace",
                messageId: "msg-id",
                parts: [
                    { type: "text", text: "Part 1 " },
                    { type: "text", text: "Part 2 " },
                    { type: "text", text: "Part 3" },
                ],
                metadata: {
                    model: "claude-3-5-sonnet-20241022",
                    usage: { inputTokens: 100, outputTokens: 50, totalTokens: undefined },
                    duration: 1500,
                },
            };
            await handler.handleCompletion(event);
            const appendedMsg = mockHistoryService.appendToHistory.mock.calls[0][1];
            (0, bun_test_1.expect)(appendedMsg.parts[0].text).toBe("Part 1 Part 2 Part 3");
        });
        (0, bun_test_1.it)("should extract summary text from event.parts", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("This is the summary");
            await handler.handleCompletion(event);
            const appendedMsg = mockHistoryService.appendToHistory.mock.calls[0][1];
            (0, bun_test_1.expect)(appendedMsg.parts[0].text).toBe("This is the summary");
        });
        (0, bun_test_1.it)("should delete partial.json before clearing history (race condition fix)", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            // deletePartial should be called once before clearHistory
            (0, bun_test_1.expect)(mockPartialService.deletePartial.mock.calls).toHaveLength(1);
            (0, bun_test_1.expect)(mockPartialService.deletePartial.mock.calls[0][0]).toBe(workspaceId);
            // Verify deletePartial was called (we can't easily verify order without more complex mocking,
            // but the important thing is that it IS called during compaction)
        });
        (0, bun_test_1.it)("should call clearHistory() and appendToHistory()", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory.mock.calls).toHaveLength(1);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory.mock.calls[0][0]).toBe(workspaceId);
            (0, bun_test_1.expect)(mockHistoryService.appendToHistory.mock.calls).toHaveLength(1);
            (0, bun_test_1.expect)(mockHistoryService.appendToHistory.mock.calls[0][0]).toBe(workspaceId);
            const appendedMsg = mockHistoryService.appendToHistory.mock.calls[0][1];
            (0, bun_test_1.expect)(appendedMsg.role).toBe("assistant");
            (0, bun_test_1.expect)(appendedMsg.parts[0].text).toBe("Summary");
        });
        (0, bun_test_1.it)("should emit delete event for old messages", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0, 1, 2, 3]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const deleteEvent = emittedEvents.find((_e) => _e.data.message?.type === "delete");
            (0, bun_test_1.expect)(deleteEvent).toBeDefined();
            const delMsg = deleteEvent?.data.message;
            (0, bun_test_1.expect)(delMsg.historySequences).toEqual([0, 1, 2, 3]);
        });
        (0, bun_test_1.it)("should emit summary message with complete metadata", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const usage = { inputTokens: 200, outputTokens: 100, totalTokens: 300 };
            const event = createStreamEndEvent("Summary", {
                model: "claude-3-5-sonnet-20241022",
                usage,
                duration: 2000,
                providerMetadata: { anthropic: { cacheCreationInputTokens: 50000 } },
                systemMessageTokens: 100,
            });
            await handler.handleCompletion(event);
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.parts !== undefined;
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const sevt = summaryEvent?.data.message;
            // providerMetadata is omitted to avoid inflating context with pre-compaction cacheCreationInputTokens
            (0, bun_test_1.expect)(sevt.metadata).toMatchObject({
                model: "claude-3-5-sonnet-20241022",
                usage,
                duration: 2000,
                systemMessageTokens: 100,
                compacted: "user",
            });
            (0, bun_test_1.expect)(sevt.metadata?.providerMetadata).toBeUndefined();
        });
        (0, bun_test_1.it)("should emit stream-end event to frontend", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary", { duration: 1234 });
            await handler.handleCompletion(event);
            const streamEndEvent = emittedEvents.find((_e) => _e.data.message === event);
            (0, bun_test_1.expect)(streamEndEvent).toBeDefined();
            (0, bun_test_1.expect)(streamEndEvent?.data.workspaceId).toBe(workspaceId);
            const streamMsg = streamEndEvent?.data.message;
            (0, bun_test_1.expect)(streamMsg.metadata.duration).toBe(1234);
        });
        (0, bun_test_1.it)("should set compacted in summary metadata", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const appendedMsg = mockHistoryService.appendToHistory.mock.calls[0][1];
            (0, bun_test_1.expect)(appendedMsg.metadata?.compacted).toBe("user");
        });
    });
    (0, bun_test_1.describe)("handleCompletion() - Deduplication", () => {
        (0, bun_test_1.it)("should track processed compaction-request IDs", async () => {
            const compactionReq = createCompactionRequest("req-unique");
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory.mock.calls).toHaveLength(1);
        });
        (0, bun_test_1.it)("should return true without re-processing when same request ID seen twice", async () => {
            const compactionReq = createCompactionRequest("req-dupe");
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            const result1 = await handler.handleCompletion(event);
            const result2 = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result1).toBe(true);
            (0, bun_test_1.expect)(result2).toBe(true);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory.mock.calls).toHaveLength(1);
        });
        (0, bun_test_1.it)("should not emit duplicate events", async () => {
            const compactionReq = createCompactionRequest("req-dupe-2");
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const eventCountAfterFirst = emittedEvents.length;
            await handler.handleCompletion(event);
            const eventCountAfterSecond = emittedEvents.length;
            (0, bun_test_1.expect)(eventCountAfterSecond).toBe(eventCountAfterFirst);
        });
        (0, bun_test_1.it)("should not clear history twice", async () => {
            const compactionReq = createCompactionRequest("req-dupe-3");
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            await handler.handleCompletion(event);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory.mock.calls).toHaveLength(1);
            (0, bun_test_1.expect)(mockHistoryService.appendToHistory.mock.calls).toHaveLength(1);
        });
    });
    (0, bun_test_1.describe)("Error Handling", () => {
        (0, bun_test_1.it)("should return false when clearHistory() fails", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Err)("Clear failed"));
            const event = createStreamEndEvent("Summary");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
            (0, bun_test_1.expect)(mockHistoryService.appendToHistory.mock.calls).toHaveLength(0);
            // Ensure we don't keep a persisted snapshot when compaction didn't clear history.
            const persistedPath = path.join(sessionDir, "post-compaction.json");
            let exists = true;
            try {
                await fsPromises.stat(persistedPath);
            }
            catch {
                exists = false;
            }
            (0, bun_test_1.expect)(exists).toBe(false);
        });
        (0, bun_test_1.it)("should return false when appendToHistory() fails", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Err)("Append failed"));
            const event = createStreamEndEvent("Summary");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
        });
        (0, bun_test_1.it)("should log errors but not throw", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Err)("Database corruption"));
            const event = createStreamEndEvent("Summary");
            // Should not throw
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
        });
        (0, bun_test_1.it)("should not emit events when compaction fails mid-process", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Err)("Clear failed"));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            (0, bun_test_1.expect)(emittedEvents).toHaveLength(0);
        });
    });
    (0, bun_test_1.describe)("Event Emission", () => {
        (0, bun_test_1.it)("should include workspaceId in all chat-event emissions", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const chatEvents = emittedEvents.filter((e) => e.event === "chat-event");
            (0, bun_test_1.expect)(chatEvents.length).toBeGreaterThan(0);
            chatEvents.forEach((e) => {
                (0, bun_test_1.expect)(e.data.workspaceId).toBe(workspaceId);
            });
        });
        (0, bun_test_1.it)("should emit DeleteMessage with correct type and historySequences array", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([5, 10, 15]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const deleteEvent = emittedEvents.find((_e) => _e.data.message?.type === "delete");
            (0, bun_test_1.expect)(deleteEvent?.data.message).toEqual({
                type: "delete",
                historySequences: [5, 10, 15],
            });
        });
        (0, bun_test_1.it)("should emit summary message with proper UnixMessage structure", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary text");
            await handler.handleCompletion(event);
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.parts !== undefined;
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const summaryMsg = summaryEvent?.data.message;
            (0, bun_test_1.expect)(summaryMsg).toMatchObject({
                id: bun_test_1.expect.stringContaining("summary-"),
                role: "assistant",
                parts: [{ type: "text", text: "Summary text" }],
                metadata: bun_test_1.expect.objectContaining({
                    compacted: "user",
                    unixMetadata: { type: "normal" },
                }),
            });
        });
        (0, bun_test_1.it)("should forward stream events (stream-end, stream-abort) correctly", async () => {
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary", { customField: "test" });
            await handler.handleCompletion(event);
            const streamEndEvent = emittedEvents.find((_e) => _e.data.message === event);
            (0, bun_test_1.expect)(streamEndEvent).toBeDefined();
            const streamMsg = streamEndEvent?.data.message;
            (0, bun_test_1.expect)(streamMsg.metadata.customField).toBe("test");
        });
    });
    (0, bun_test_1.describe)("Idle Compaction", () => {
        (0, bun_test_1.it)("should preserve original recency timestamp from last user message", async () => {
            const originalTimestamp = Date.now() - 3600 * 1000; // 1 hour ago
            const userMessage = (0, message_1.createUnixMessage)("user-1", "user", "Hello", {
                timestamp: originalTimestamp,
                historySequence: 0,
            });
            const idleCompactionReq = (0, message_1.createUnixMessage)("req-1", "user", "Summarize", {
                historySequence: 1,
                unixMetadata: {
                    type: "compaction-request",
                    source: "idle-compaction",
                    rawCommand: "/compact",
                    parsed: {},
                },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([userMessage, idleCompactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0, 1]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.metadata?.compacted;
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const summaryMsg = summaryEvent?.data.message;
            (0, bun_test_1.expect)(summaryMsg.metadata?.timestamp).toBe(originalTimestamp);
            (0, bun_test_1.expect)(summaryMsg.metadata?.compacted).toBe("idle");
        });
        (0, bun_test_1.it)("should preserve recency from last compacted message if no user message", async () => {
            const compactedTimestamp = Date.now() - 7200 * 1000; // 2 hours ago
            const compactedMessage = (0, message_1.createUnixMessage)("compacted-1", "assistant", "Previous summary", {
                timestamp: compactedTimestamp,
                compacted: "user",
                historySequence: 0,
            });
            const idleCompactionReq = (0, message_1.createUnixMessage)("req-1", "user", "Summarize", {
                historySequence: 1,
                unixMetadata: {
                    type: "compaction-request",
                    source: "idle-compaction",
                    rawCommand: "/compact",
                    parsed: {},
                },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactedMessage, idleCompactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0, 1]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.metadata?.compacted === "idle";
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const summaryMsg = summaryEvent?.data.message;
            (0, bun_test_1.expect)(summaryMsg.metadata?.timestamp).toBe(compactedTimestamp);
        });
        (0, bun_test_1.it)("should use max of user and compacted timestamps", async () => {
            const olderCompactedTimestamp = Date.now() - 7200 * 1000; // 2 hours ago
            const newerUserTimestamp = Date.now() - 3600 * 1000; // 1 hour ago
            const compactedMessage = (0, message_1.createUnixMessage)("compacted-1", "assistant", "Previous summary", {
                timestamp: olderCompactedTimestamp,
                compacted: "user",
                historySequence: 0,
            });
            const userMessage = (0, message_1.createUnixMessage)("user-1", "user", "Hello", {
                timestamp: newerUserTimestamp,
                historySequence: 1,
            });
            const idleCompactionReq = (0, message_1.createUnixMessage)("req-1", "user", "Summarize", {
                historySequence: 2,
                unixMetadata: {
                    type: "compaction-request",
                    source: "idle-compaction",
                    rawCommand: "/compact",
                    parsed: {},
                },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactedMessage, userMessage, idleCompactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0, 1, 2]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.metadata?.compacted === "idle";
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const summaryMsg = summaryEvent?.data.message;
            // Should use the newer timestamp (user message)
            (0, bun_test_1.expect)(summaryMsg.metadata?.timestamp).toBe(newerUserTimestamp);
        });
        (0, bun_test_1.it)("should skip compaction-request message when finding timestamp to preserve", async () => {
            const originalTimestamp = Date.now() - 3600 * 1000; // 1 hour ago - the real user message
            const freshTimestamp = Date.now(); // The compaction request has a fresh timestamp
            const userMessage = (0, message_1.createUnixMessage)("user-1", "user", "Hello", {
                timestamp: originalTimestamp,
                historySequence: 0,
            });
            // Idle compaction request WITH a timestamp (as happens in production)
            const idleCompactionReq = (0, message_1.createUnixMessage)("req-1", "user", "Summarize", {
                timestamp: freshTimestamp,
                historySequence: 1,
                unixMetadata: {
                    type: "compaction-request",
                    source: "idle-compaction",
                    rawCommand: "/compact",
                    parsed: {},
                },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([userMessage, idleCompactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0, 1]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.metadata?.compacted;
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const summaryMsg = summaryEvent?.data.message;
            // Should use the OLD user message timestamp, NOT the fresh compaction request timestamp
            (0, bun_test_1.expect)(summaryMsg.metadata?.timestamp).toBe(originalTimestamp);
            (0, bun_test_1.expect)(summaryMsg.metadata?.compacted).toBe("idle");
        });
        (0, bun_test_1.it)("should use current time for non-idle compaction", async () => {
            const oldTimestamp = Date.now() - 3600 * 1000; // 1 hour ago
            const userMessage = (0, message_1.createUnixMessage)("user-1", "user", "Hello", {
                timestamp: oldTimestamp,
                historySequence: 0,
            });
            // Regular compaction (not idle)
            const compactionReq = createCompactionRequest();
            mockHistoryService.mockGetHistory((0, result_1.Ok)([userMessage, compactionReq]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0, 1]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            const beforeTime = Date.now();
            const event = createStreamEndEvent("Summary");
            await handler.handleCompletion(event);
            const afterTime = Date.now();
            const summaryEvent = emittedEvents.find((_e) => {
                const m = _e.data.message;
                return m?.role === "assistant" && m?.metadata?.compacted;
            });
            (0, bun_test_1.expect)(summaryEvent).toBeDefined();
            const summaryMsg = summaryEvent?.data.message;
            // Should use current time, not the old user message timestamp
            (0, bun_test_1.expect)(summaryMsg.metadata?.timestamp).toBeGreaterThanOrEqual(beforeTime);
            (0, bun_test_1.expect)(summaryMsg.metadata?.timestamp).toBeLessThanOrEqual(afterTime);
            (0, bun_test_1.expect)(summaryMsg.metadata?.compacted).toBe("user");
        });
    });
    (0, bun_test_1.describe)("Empty Summary Validation", () => {
        (0, bun_test_1.it)("should reject compaction when summary is empty (stream crashed)", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            // Empty parts array simulates stream crash before producing content
            const event = createStreamEndEvent("");
            const result = await handler.handleCompletion(event);
            // Should return false and NOT perform compaction
            (0, bun_test_1.expect)(result).toBe(false);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory).not.toHaveBeenCalled();
            (0, bun_test_1.expect)(mockHistoryService.appendToHistory).not.toHaveBeenCalled();
        });
        (0, bun_test_1.it)("should reject compaction when summary is only whitespace", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            // Whitespace-only should also be rejected
            const event = createStreamEndEvent("   \n\t  ");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory).not.toHaveBeenCalled();
        });
    });
    (0, bun_test_1.describe)("Raw JSON Object Validation", () => {
        (0, bun_test_1.it)("should reject compaction when summary is a raw JSON object", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            // Any JSON object should be rejected - this catches all tool call leaks
            const jsonObject = JSON.stringify({
                script: "cd tpred && sed -n '405,520p' train/trainer.py",
                timeout_secs: 10,
                run_in_background: false,
                display_name: "Inspect trainer",
            });
            const event = createStreamEndEvent(jsonObject);
            const result = await handler.handleCompletion(event);
            // Should return false and NOT perform compaction
            (0, bun_test_1.expect)(result).toBe(false);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory).not.toHaveBeenCalled();
            (0, bun_test_1.expect)(mockHistoryService.appendToHistory).not.toHaveBeenCalled();
        });
        (0, bun_test_1.it)("should reject any JSON object regardless of structure", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            // Even arbitrary JSON objects should be rejected
            const arbitraryJson = JSON.stringify({
                foo: "bar",
                nested: { a: 1, b: 2 },
            });
            const event = createStreamEndEvent(arbitraryJson);
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(false);
        });
        (0, bun_test_1.it)("should accept valid compaction summary text", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            // Normal summary text
            const event = createStreamEndEvent("The user was working on implementing a new feature. Key decisions included using TypeScript.");
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(true);
            (0, bun_test_1.expect)(mockHistoryService.clearHistory).toHaveBeenCalled();
        });
        (0, bun_test_1.it)("should accept summary with embedded JSON as part of prose", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            // Prose that contains JSON snippets is fine - only reject pure JSON objects
            const event = createStreamEndEvent('The user configured {"apiKey": "xxx", "endpoint": "http://localhost"} in config.json.');
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(true);
        });
        (0, bun_test_1.it)("should not reject JSON arrays (only objects)", async () => {
            const compactionRequestMsg = (0, message_1.createUnixMessage)("compact-req-1", "user", "/compact", {
                historySequence: 0,
                timestamp: Date.now() - 1000,
                unixMetadata: { type: "compaction-request", rawCommand: "/compact", parsed: {} },
            });
            mockHistoryService.mockGetHistory((0, result_1.Ok)([compactionRequestMsg]));
            mockHistoryService.mockClearHistory((0, result_1.Ok)([0]));
            mockHistoryService.mockAppendToHistory((0, result_1.Ok)(undefined));
            // Arrays are not tool calls, so they should pass (even though unusual)
            const event = createStreamEndEvent('["item1", "item2"]');
            const result = await handler.handleCompletion(event);
            (0, bun_test_1.expect)(result).toBe(true);
        });
    });
});
//# sourceMappingURL=compactionHandler.test.js.map