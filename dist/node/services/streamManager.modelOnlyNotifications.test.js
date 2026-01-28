"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const streamManager_1 = require("./streamManager");
(0, bun_test_1.describe)("StreamManager - model-only tool notifications", () => {
    (0, bun_test_1.test)("strips __mux_notifications before emitting tool-call-end", async () => {
        const historyService = {
            appendToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: [] })),
            updateHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
            truncateAfterMessage: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
            clearHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
        };
        const partialService = {
            writePartial: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
            readPartial: (0, bun_test_1.mock)(() => Promise.resolve(null)),
            deletePartial: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
            commitToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true })),
        };
        const streamManager = new streamManager_1.StreamManager(historyService, partialService);
        // Avoid tokenizer worker usage in unit tests.
        streamManager.tokenTracker = {
            // eslint-disable-next-line @typescript-eslint/require-await
            setModel: async () => undefined,
            // eslint-disable-next-line @typescript-eslint/require-await
            countTokens: async () => 0,
        };
        const events = [];
        streamManager.on("tool-call-end", (data) => {
            events.push({ toolName: data.toolName, result: data.result });
        });
        const mockStreamResult = {
            // eslint-disable-next-line @typescript-eslint/require-await
            fullStream: (async function* () {
                yield {
                    type: "tool-call",
                    toolCallId: "call-1",
                    toolName: "bash",
                    input: { script: "echo hi" },
                };
                yield {
                    type: "tool-result",
                    toolCallId: "call-1",
                    toolName: "bash",
                    output: {
                        ok: true,
                        __mux_notifications: ["<notification>hello</notification>"],
                    },
                };
            })(),
            totalUsage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
            usage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
            providerMetadata: Promise.resolve({}),
            steps: Promise.resolve([]),
        };
        const streamInfo = {
            state: 2, // STREAMING
            streamResult: mockStreamResult,
            abortController: new AbortController(),
            messageId: "test-message-1",
            token: "test-token",
            startTime: Date.now(),
            model: "noop:model",
            historySequence: 1,
            parts: [],
            lastPartialWriteTime: 0,
            partialWritePromise: undefined,
            partialWriteTimer: undefined,
            processingPromise: Promise.resolve(),
            softInterrupt: { pending: false },
            runtimeTempDir: "", // Skip cleanup rm -rf
            runtime: {},
            cumulativeUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            cumulativeProviderMetadata: undefined,
            lastStepUsage: undefined,
            lastStepProviderMetadata: undefined,
        };
        const method = Reflect.get(streamManager, "processStreamWithCleanup");
        (0, bun_test_1.expect)(typeof method).toBe("function");
        await method.call(streamManager, "test-workspace", streamInfo, 1);
        const toolEnd = events.find((e) => e.toolName === "bash");
        (0, bun_test_1.expect)(toolEnd).toBeDefined();
        (0, bun_test_1.expect)(toolEnd?.result && typeof toolEnd.result === "object").toBe(true);
        (0, bun_test_1.expect)("__mux_notifications" in toolEnd.result).toBe(false);
    });
});
//# sourceMappingURL=streamManager.modelOnlyNotifications.test.js.map