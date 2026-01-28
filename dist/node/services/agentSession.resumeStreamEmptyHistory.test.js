"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const agentSession_1 = require("./agentSession");
const result_1 = require("../../common/types/result");
(0, bun_test_1.describe)("AgentSession.resumeStream", () => {
    (0, bun_test_1.test)("returns an error when history is empty", async () => {
        const streamMessage = (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined)));
        const aiService = {
            on: (0, bun_test_1.mock)(() => aiService),
            off: (0, bun_test_1.mock)(() => aiService),
            stopStream: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined))),
            isStreaming: (0, bun_test_1.mock)(() => false),
            streamMessage,
        };
        const historyService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)([]))),
        };
        const partialService = {
            commitToHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined))),
        };
        const initStateManager = {
            on: (0, bun_test_1.mock)(() => initStateManager),
            off: (0, bun_test_1.mock)(() => initStateManager),
        };
        const backgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
            setMessageQueued: (0, bun_test_1.mock)(() => undefined),
        };
        const config = {
            srcDir: "/tmp",
            getSessionDir: (0, bun_test_1.mock)(() => "/tmp"),
        };
        const session = new agentSession_1.AgentSession({
            workspaceId: "ws",
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
        });
        const result = await session.resumeStream({
            model: "anthropic:claude-sonnet-4-5",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (result.success)
            return;
        (0, bun_test_1.expect)(result.error.type).toBe("unknown");
        if (result.error.type !== "unknown") {
            throw new Error(`Expected unknown error, got ${result.error.type}`);
        }
        (0, bun_test_1.expect)(result.error.raw).toContain("history is empty");
        (0, bun_test_1.expect)(streamMessage).toHaveBeenCalledTimes(0);
    });
});
//# sourceMappingURL=agentSession.resumeStreamEmptyHistory.test.js.map