"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const agentSession_1 = require("./agentSession");
// NOTE: These tests focus on the event wiring (tool-call-end -> callback).
// The actual post-compaction state computation is covered elsewhere.
(0, bun_test_1.describe)("AgentSession post-compaction refresh trigger", () => {
    (0, bun_test_1.test)("triggers callback on file_edit_* tool-call-end", () => {
        const handlers = new Map();
        const aiService = {
            on(eventName, listener) {
                handlers.set(String(eventName), listener);
                return this;
            },
            off(_eventName, _listener) {
                return this;
            },
            stopStream: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const historyService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: [] })),
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
            setMessageQueued: (0, bun_test_1.mock)(() => undefined),
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
        };
        const config = {
            srcDir: "/tmp",
            getSessionDir: (0, bun_test_1.mock)(() => "/tmp"),
        };
        const partialService = {};
        const onPostCompactionStateChange = (0, bun_test_1.mock)(() => undefined);
        const session = new agentSession_1.AgentSession({
            workspaceId: "ws",
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
            onPostCompactionStateChange,
        });
        const toolEnd = handlers.get("tool-call-end");
        (0, bun_test_1.expect)(toolEnd).toBeDefined();
        toolEnd({
            type: "tool-call-end",
            workspaceId: "ws",
            messageId: "m1",
            toolCallId: "t1b",
            toolName: "file_edit_replace_lines",
            result: {},
            timestamp: Date.now(),
        });
        toolEnd({
            type: "tool-call-end",
            workspaceId: "ws",
            messageId: "m1",
            toolCallId: "t1",
            toolName: "file_edit_insert",
            result: {},
            timestamp: Date.now(),
        });
        toolEnd({
            type: "tool-call-end",
            workspaceId: "ws",
            messageId: "m1",
            toolCallId: "t2",
            toolName: "bash",
            result: {},
            timestamp: Date.now(),
        });
        (0, bun_test_1.expect)(onPostCompactionStateChange).toHaveBeenCalledTimes(2);
        session.dispose();
    });
});
//# sourceMappingURL=agentSession.postCompactionRefresh.test.js.map