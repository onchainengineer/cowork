"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const message_1 = require("../../common/types/message");
const agentSession_1 = require("./agentSession");
(0, bun_test_1.describe)("AgentSession continue-message agentId fallback", () => {
    (0, bun_test_1.test)("legacy continueMessage.mode does not fall back to compact agent", async () => {
        const aiService = {
            on() {
                return this;
            },
            off() {
                return this;
            },
            isStreaming: () => false,
            stopStream: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const historyService = {
            appendToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const initStateManager = {
            on() {
                return this;
            },
            off() {
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
        const internals = session;
        // Avoid exercising the full stream pipeline; we only care about the queue contents.
        internals.streamWithHistory = () => Promise.resolve({ success: true, data: undefined });
        const baseContinueMessage = (0, message_1.buildContinueMessage)({
            text: "follow up",
            model: "openai:gpt-4o",
            agentId: "exec",
        });
        if (!baseContinueMessage) {
            throw new Error("Expected base continue message to be built");
        }
        const legacyContinueMessage = {
            ...baseContinueMessage,
            agentId: undefined,
            mode: "plan",
        };
        const result = await session.sendMessage("/compact", {
            model: "openai:gpt-4o",
            agentId: "compact",
            disableWorkspaceAgents: true,
            toolPolicy: [{ regex_match: ".*", action: "disable" }],
            unixMetadata: {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {
                    continueMessage: legacyContinueMessage,
                },
            },
        });
        (0, bun_test_1.expect)(result.success).toBe(true);
        const queued = internals.messageQueue.produceMessage();
        (0, bun_test_1.expect)(queued.message).toBe("follow up");
        (0, bun_test_1.expect)(queued.options?.agentId).toBe("plan");
        (0, bun_test_1.expect)(queued.options?.disableWorkspaceAgents).toBe(true);
        session.dispose();
    });
});
//# sourceMappingURL=agentSession.continueMessageAgentId.test.js.map