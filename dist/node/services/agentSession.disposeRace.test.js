"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const agentSession_1 = require("./agentSession");
const result_1 = require("../../common/types/result");
function createDeferred() {
    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });
    return { promise, resolve };
}
(0, bun_test_1.describe)("AgentSession disposal race conditions", () => {
    (0, bun_test_1.test)("does not crash if disposed while auto-sending a queued message", async () => {
        const aiHandlers = new Map();
        const streamMessage = (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined)));
        const aiService = {
            on(eventName, listener) {
                aiHandlers.set(String(eventName), listener);
                return this;
            },
            off(_eventName, _listener) {
                return this;
            },
            stopStream: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined))),
            isStreaming: (0, bun_test_1.mock)(() => false),
            streamMessage,
        };
        const appendDeferred = createDeferred();
        const historyService = {
            appendToHistory: (0, bun_test_1.mock)(() => appendDeferred.promise),
        };
        const initStateManager = {
            on(_eventName, _listener) {
                return this;
            },
            off(_eventName, _listener) {
                return this;
            },
        };
        const backgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
            setMessageQueued: (0, bun_test_1.mock)(() => undefined),
        };
        const config = {
            srcDir: "/tmp",
            getSessionDir: (0, bun_test_1.mock)(() => "/tmp"),
        };
        const partialService = {};
        const session = new agentSession_1.AgentSession({
            workspaceId: "ws",
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
        });
        // Capture the fire-and-forget sendMessage() promise that sendQueuedMessages() creates.
        const originalSendMessage = session.sendMessage.bind(session);
        let inFlight;
        session.sendMessage = (...args) => {
            const promise = originalSendMessage(...args);
            inFlight = promise;
            return promise;
        };
        session.queueMessage("Queued message", {
            model: "anthropic:claude-sonnet-4-5",
            agentId: "exec",
        });
        session.sendQueuedMessages();
        (0, bun_test_1.expect)(inFlight).toBeDefined();
        // Dispose while sendMessage() is awaiting appendToHistory.
        session.dispose();
        appendDeferred.resolve((0, result_1.Ok)(undefined));
        const result = await inFlight;
        (0, bun_test_1.expect)(result.success).toBe(true);
        // We should not attempt to stream once disposal has begun.
        (0, bun_test_1.expect)(streamMessage).toHaveBeenCalledTimes(0);
        // Sanity: invoking a forwarded handler after dispose should be a no-op.
        const streamStart = aiHandlers.get("stream-start");
        (0, bun_test_1.expect)(() => streamStart?.({
            type: "stream-start",
            workspaceId: "ws",
            messageId: "m1",
            model: "anthropic:claude-sonnet-4-5",
            historySequence: 1,
            startTime: Date.now(),
        })).not.toThrow();
    });
});
//# sourceMappingURL=agentSession.disposeRace.test.js.map