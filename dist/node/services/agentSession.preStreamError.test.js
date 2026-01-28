"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const events_1 = require("events");
const result_1 = require("../../common/types/result");
const agentSession_1 = require("./agentSession");
(0, bun_test_1.describe)("AgentSession pre-stream errors", () => {
    (0, bun_test_1.it)("emits stream-error when stream startup fails", async () => {
        const workspaceId = "ws-test";
        const config = {
            srcDir: "/tmp",
            getSessionDir: (_workspaceId) => "/tmp",
        };
        const messages = [];
        let nextSeq = 0;
        const appendToHistory = (0, bun_test_1.mock)((_workspaceId, message) => {
            message.metadata = { ...(message.metadata ?? {}), historySequence: nextSeq++ };
            messages.push(message);
            return Promise.resolve((0, result_1.Ok)(undefined));
        });
        const getHistory = (0, bun_test_1.mock)((_workspaceId) => {
            return Promise.resolve((0, result_1.Ok)([...messages]));
        });
        const historyService = {
            appendToHistory,
            getHistory,
        };
        const partialService = {
            commitToHistory: (0, bun_test_1.mock)((_workspaceId) => Promise.resolve((0, result_1.Ok)(undefined))),
        };
        const aiEmitter = new events_1.EventEmitter();
        const streamMessage = (0, bun_test_1.mock)((_history) => {
            return Promise.resolve((0, result_1.Err)({
                type: "api_key_not_found",
                provider: "anthropic",
            }));
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
        const events = [];
        session.onChatEvent((event) => {
            events.push(event.message);
        });
        const result = await session.sendMessage("hello", {
            model: "anthropic:claude-3-5-sonnet-latest",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        (0, bun_test_1.expect)(streamMessage.mock.calls).toHaveLength(1);
        const streamError = events.find((event) => event.type === "stream-error");
        (0, bun_test_1.expect)(streamError).toBeDefined();
        (0, bun_test_1.expect)(streamError?.errorType).toBe("authentication");
        (0, bun_test_1.expect)(streamError?.error).toContain("anthropic");
        (0, bun_test_1.expect)(streamError?.messageId).toMatch(/^assistant-/);
    });
});
//# sourceMappingURL=agentSession.preStreamError.test.js.map