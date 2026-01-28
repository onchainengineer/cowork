"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const events_1 = require("events");
const message_1 = require("../../common/types/message");
const result_1 = require("../../common/types/result");
const agentSession_1 = require("./agentSession");
(0, bun_test_1.describe)("AgentSession.sendMessage (editMessageId)", () => {
    (0, bun_test_1.it)("treats missing edit target as no-op (allows recovery after compaction)", async () => {
        const workspaceId = "ws-test";
        const config = {
            srcDir: "/tmp",
            getSessionDir: (_workspaceId) => "/tmp",
        };
        const messages = [];
        let nextSeq = 0;
        const truncateAfterMessage = (0, bun_test_1.mock)((_workspaceId, messageId) => {
            return Promise.resolve((0, result_1.Err)(`Message with ID ${messageId} not found in history`));
        });
        const appendToHistory = (0, bun_test_1.mock)((_workspaceId, message) => {
            message.metadata = { ...(message.metadata ?? {}), historySequence: nextSeq++ };
            messages.push(message);
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const getHistory = (0, bun_test_1.mock)((_workspaceId) => {
            return Promise.resolve((0, result_1.Ok)([...messages]));
        });
        const historyService = {
            truncateAfterMessage,
            appendToHistory,
            getHistory,
        };
        const partialService = {
            commitToHistory: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
        };
        const aiEmitter = new events_1.EventEmitter();
        const streamMessage = (0, bun_test_1.mock)((_messages) => {
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const aiService = Object.assign(aiEmitter, {
            isStreaming: (0, bun_test_1.mock)((_workspaceId) => false),
            stopStream: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
            streamMessage: streamMessage,
        });
        const initStateManager = new events_1.EventEmitter();
        const backgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve()),
            setMessageQueued: (0, bun_test_1.mock)((_workspaceId, _queued) => {
                void _queued;
            }),
        };
        const session = new agentSession_1.AgentSession({
            workspaceId,
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
        });
        const result = await session.sendMessage("hello", {
            model: "anthropic:claude-3-5-sonnet-latest",
            agentId: "exec",
            editMessageId: "missing-user-message-id",
        });
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(truncateAfterMessage.mock.calls).toHaveLength(1);
        (0, bun_test_1.expect)(appendToHistory.mock.calls).toHaveLength(1);
        (0, bun_test_1.expect)(streamMessage.mock.calls).toHaveLength(1);
    });
    (0, bun_test_1.it)("clears image parts when editing with explicit empty fileParts", async () => {
        const workspaceId = "ws-test";
        const config = {
            srcDir: "/tmp",
            getSessionDir: (_workspaceId) => "/tmp",
        };
        const originalMessageId = "user-message-with-image";
        const originalImageUrl = "data:image/png;base64,AAAA";
        const messages = [
            (0, message_1.createUnixMessage)(originalMessageId, "user", "original", { historySequence: 0 }, [
                { type: "file", mediaType: "image/png", url: originalImageUrl },
            ]),
        ];
        let nextSeq = 1;
        const truncateAfterMessage = (0, bun_test_1.mock)((_workspaceId, _messageId) => {
            void _messageId;
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const appendToHistory = (0, bun_test_1.mock)((_workspaceId, message) => {
            message.metadata = { ...(message.metadata ?? {}), historySequence: nextSeq++ };
            messages.push(message);
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const getHistory = (0, bun_test_1.mock)((_workspaceId) => {
            return Promise.resolve((0, result_1.Ok)([...messages]));
        });
        const historyService = {
            truncateAfterMessage,
            appendToHistory,
            getHistory,
        };
        const partialService = {
            commitToHistory: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
        };
        const aiEmitter = new events_1.EventEmitter();
        const streamMessage = (0, bun_test_1.mock)((_messages) => {
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const aiService = Object.assign(aiEmitter, {
            isStreaming: (0, bun_test_1.mock)((_workspaceId) => false),
            stopStream: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
            streamMessage: streamMessage,
        });
        const initStateManager = new events_1.EventEmitter();
        const backgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve()),
            setMessageQueued: (0, bun_test_1.mock)((_workspaceId, _queued) => {
                void _queued;
            }),
        };
        const session = new agentSession_1.AgentSession({
            workspaceId,
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
        });
        const result = await session.sendMessage("edited", {
            model: "anthropic:claude-3-5-sonnet-latest",
            agentId: "exec",
            editMessageId: originalMessageId,
            fileParts: [],
        });
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(truncateAfterMessage.mock.calls).toHaveLength(1);
        (0, bun_test_1.expect)(appendToHistory.mock.calls).toHaveLength(1);
        const appendedMessage = appendToHistory.mock.calls[0][1];
        const appendedFileParts = appendedMessage.parts.filter((part) => part.type === "file");
        (0, bun_test_1.expect)(appendedFileParts).toHaveLength(0);
    });
    (0, bun_test_1.it)("preserves image parts when editing and fileParts are omitted", async () => {
        const workspaceId = "ws-test";
        const config = {
            srcDir: "/tmp",
            getSessionDir: (_workspaceId) => "/tmp",
        };
        const originalMessageId = "user-message-with-image";
        const originalImageUrl = "data:image/png;base64,AAAA";
        const messages = [
            (0, message_1.createUnixMessage)(originalMessageId, "user", "original", { historySequence: 0 }, [
                { type: "file", mediaType: "image/png", url: originalImageUrl },
            ]),
        ];
        let nextSeq = 1;
        const truncateAfterMessage = (0, bun_test_1.mock)((_workspaceId, _messageId) => {
            void _messageId;
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const appendToHistory = (0, bun_test_1.mock)((_workspaceId, message) => {
            message.metadata = { ...(message.metadata ?? {}), historySequence: nextSeq++ };
            messages.push(message);
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const getHistory = (0, bun_test_1.mock)((_workspaceId) => {
            return Promise.resolve((0, result_1.Ok)([...messages]));
        });
        const historyService = {
            truncateAfterMessage,
            appendToHistory,
            getHistory,
        };
        const partialService = {
            commitToHistory: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
        };
        const aiEmitter = new events_1.EventEmitter();
        const streamMessage = (0, bun_test_1.mock)((_messages) => {
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const aiService = Object.assign(aiEmitter, {
            isStreaming: (0, bun_test_1.mock)((_workspaceId) => false),
            stopStream: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
            streamMessage: streamMessage,
        });
        const initStateManager = new events_1.EventEmitter();
        const backgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve()),
            setMessageQueued: (0, bun_test_1.mock)((_workspaceId, _queued) => {
                void _queued;
            }),
        };
        const session = new agentSession_1.AgentSession({
            workspaceId,
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
        });
        const result = await session.sendMessage("edited", {
            model: "anthropic:claude-3-5-sonnet-latest",
            agentId: "exec",
            editMessageId: originalMessageId,
        });
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(getHistory.mock.calls.length).toBeGreaterThan(0);
        (0, bun_test_1.expect)(truncateAfterMessage.mock.calls).toHaveLength(1);
        (0, bun_test_1.expect)(appendToHistory.mock.calls).toHaveLength(1);
        const appendedMessage = appendToHistory.mock.calls[0][1];
        const appendedFileParts = appendedMessage.parts.filter((part) => part.type === "file");
        (0, bun_test_1.expect)(appendedFileParts).toHaveLength(1);
        (0, bun_test_1.expect)(appendedFileParts[0].url).toBe(originalImageUrl);
        (0, bun_test_1.expect)(appendedFileParts[0].mediaType).toBe("image/png");
    });
});
//# sourceMappingURL=agentSession.editMessageId.test.js.map