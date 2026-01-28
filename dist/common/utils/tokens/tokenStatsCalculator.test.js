"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const tokenStatsCalculator_1 = require("./tokenStatsCalculator");
(0, bun_test_1.describe)("createDisplayUsage", () => {
    (0, bun_test_1.test)("uses usage.reasoningTokens when available", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            reasoningTokens: 100,
        };
        const result = (0, tokenStatsCalculator_1.createDisplayUsage)(usage, "openai:gpt-5-pro");
        (0, bun_test_1.expect)(result?.reasoning.tokens).toBe(100);
        (0, bun_test_1.expect)(result?.output.tokens).toBe(400); // 500 - 100
    });
    (0, bun_test_1.test)("falls back to providerMetadata.openai.reasoningTokens when usage.reasoningTokens is undefined", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            // reasoningTokens not provided
        };
        const providerMetadata = {
            openai: {
                reasoningTokens: 150,
                responseId: "resp_123",
                serviceTier: "default",
            },
        };
        const result = (0, tokenStatsCalculator_1.createDisplayUsage)(usage, "openai:gpt-5-pro", providerMetadata);
        (0, bun_test_1.expect)(result?.reasoning.tokens).toBe(150);
        (0, bun_test_1.expect)(result?.output.tokens).toBe(350); // 500 - 150
    });
    (0, bun_test_1.test)("uses 0 when both usage.reasoningTokens and providerMetadata.openai.reasoningTokens are undefined", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
        };
        const providerMetadata = {
            openai: {
                responseId: "resp_123",
                serviceTier: "default",
            },
        };
        const result = (0, tokenStatsCalculator_1.createDisplayUsage)(usage, "openai:gpt-5-pro", providerMetadata);
        (0, bun_test_1.expect)(result?.reasoning.tokens).toBe(0);
        (0, bun_test_1.expect)(result?.output.tokens).toBe(500); // All output tokens
    });
    (0, bun_test_1.test)("prefers usage.reasoningTokens over providerMetadata when both exist", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            reasoningTokens: 100,
        };
        const providerMetadata = {
            openai: {
                reasoningTokens: 999, // Should be ignored
                responseId: "resp_123",
                serviceTier: "default",
            },
        };
        const result = (0, tokenStatsCalculator_1.createDisplayUsage)(usage, "openai:gpt-5-pro", providerMetadata);
        (0, bun_test_1.expect)(result?.reasoning.tokens).toBe(100); // Uses usage, not providerMetadata
        (0, bun_test_1.expect)(result?.output.tokens).toBe(400); // 500 - 100
    });
    (0, bun_test_1.test)("works with non-OpenAI providers that don't have providerMetadata.openai", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            reasoningTokens: 200,
        };
        const providerMetadata = {
            anthropic: {
                cacheCreationInputTokens: 50,
            },
        };
        const result = (0, tokenStatsCalculator_1.createDisplayUsage)(usage, "anthropic:claude-sonnet-4-20250514", providerMetadata);
        (0, bun_test_1.expect)(result?.reasoning.tokens).toBe(200);
        (0, bun_test_1.expect)(result?.output.tokens).toBe(300); // 500 - 200
        (0, bun_test_1.expect)(result?.cacheCreate.tokens).toBe(50); // Anthropic metadata still works
    });
});
(0, bun_test_1.describe)("extractToolOutputData", () => {
    (0, bun_test_1.test)("extracts value from nested structure", () => {
        const output = { type: "json", value: { foo: "bar" } };
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.extractToolOutputData)(output)).toEqual({ foo: "bar" });
    });
    (0, bun_test_1.test)("returns output as-is if not nested", () => {
        const output = { foo: "bar" };
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.extractToolOutputData)(output)).toEqual({ foo: "bar" });
    });
    (0, bun_test_1.test)("handles null", () => {
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.extractToolOutputData)(null)).toBeNull();
    });
    (0, bun_test_1.test)("handles primitives", () => {
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.extractToolOutputData)("string")).toBe("string");
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.extractToolOutputData)(123)).toBe(123);
    });
});
(0, bun_test_1.describe)("isEncryptedWebSearch", () => {
    (0, bun_test_1.test)("returns false for non-web_search tools", () => {
        const data = [{ encryptedContent: "abc" }];
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.isEncryptedWebSearch)("Read", data)).toBe(false);
    });
    (0, bun_test_1.test)("returns false for non-array data", () => {
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.isEncryptedWebSearch)("web_search", { foo: "bar" })).toBe(false);
    });
    (0, bun_test_1.test)("returns false for web_search without encrypted content", () => {
        const data = [{ title: "foo", url: "bar" }];
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.isEncryptedWebSearch)("web_search", data)).toBe(false);
    });
    (0, bun_test_1.test)("returns true for web_search with encrypted content", () => {
        const data = [{ encryptedContent: "abc123" }];
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.isEncryptedWebSearch)("web_search", data)).toBe(true);
    });
    (0, bun_test_1.test)("returns true if at least one item has encrypted content", () => {
        const data = [{ title: "foo" }, { encryptedContent: "abc123" }];
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.isEncryptedWebSearch)("web_search", data)).toBe(true);
    });
});
(0, bun_test_1.describe)("countEncryptedWebSearchTokens", () => {
    (0, bun_test_1.test)("calculates tokens using heuristic", () => {
        const data = [{ encryptedContent: "a".repeat(100) }];
        // 100 chars * 0.75 = 75
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.countEncryptedWebSearchTokens)(data)).toBe(75);
    });
    (0, bun_test_1.test)("handles multiple items", () => {
        const data = [{ encryptedContent: "a".repeat(50) }, { encryptedContent: "b".repeat(50) }];
        // 100 chars * 0.75 = 75
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.countEncryptedWebSearchTokens)(data)).toBe(75);
    });
    (0, bun_test_1.test)("ignores items without encryptedContent", () => {
        const data = [{ title: "foo" }, { encryptedContent: "a".repeat(100) }];
        // Only counts encrypted content: 100 chars * 0.75 = 75
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.countEncryptedWebSearchTokens)(data)).toBe(75);
    });
    (0, bun_test_1.test)("rounds up", () => {
        const data = [{ encryptedContent: "abc" }];
        // 3 chars * 0.75 = 2.25, rounded up to 3
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.countEncryptedWebSearchTokens)(data)).toBe(3);
    });
});
(0, bun_test_1.describe)("collectUniqueToolNames", () => {
    (0, bun_test_1.test)("collects tool names from assistant messages", () => {
        const messages = [
            {
                id: "1",
                role: "assistant",
                parts: [
                    {
                        type: "dynamic-tool",
                        toolName: "Read",
                        toolCallId: "1",
                        state: "input-available",
                        input: {},
                    },
                    {
                        type: "dynamic-tool",
                        toolName: "Bash",
                        toolCallId: "2",
                        state: "input-available",
                        input: {},
                    },
                ],
            },
        ];
        const toolNames = (0, tokenStatsCalculator_1.collectUniqueToolNames)(messages);
        (0, bun_test_1.expect)(toolNames.size).toBe(2);
        (0, bun_test_1.expect)(toolNames.has("Read")).toBe(true);
        (0, bun_test_1.expect)(toolNames.has("Bash")).toBe(true);
    });
    (0, bun_test_1.test)("deduplicates tool names", () => {
        const messages = [
            {
                id: "1",
                role: "assistant",
                parts: [
                    {
                        type: "dynamic-tool",
                        toolName: "Read",
                        toolCallId: "1",
                        state: "input-available",
                        input: {},
                    },
                    {
                        type: "dynamic-tool",
                        toolName: "Read",
                        toolCallId: "2",
                        state: "input-available",
                        input: {},
                    },
                ],
            },
        ];
        const toolNames = (0, tokenStatsCalculator_1.collectUniqueToolNames)(messages);
        (0, bun_test_1.expect)(toolNames.size).toBe(1);
        (0, bun_test_1.expect)(toolNames.has("Read")).toBe(true);
    });
    (0, bun_test_1.test)("ignores user messages", () => {
        const messages = [
            {
                id: "1",
                role: "user",
                parts: [{ type: "text", text: "hello" }],
            },
        ];
        const toolNames = (0, tokenStatsCalculator_1.collectUniqueToolNames)(messages);
        (0, bun_test_1.expect)(toolNames.size).toBe(0);
    });
    (0, bun_test_1.test)("returns empty set for empty messages", () => {
        const toolNames = (0, tokenStatsCalculator_1.collectUniqueToolNames)([]);
        (0, bun_test_1.expect)(toolNames.size).toBe(0);
    });
});
(0, bun_test_1.describe)("extractSyncMetadata", () => {
    (0, bun_test_1.test)("accumulates system message tokens", () => {
        const messages = [
            {
                id: "1",
                role: "assistant",
                parts: [],
                metadata: { systemMessageTokens: 100 },
            },
            {
                id: "2",
                role: "assistant",
                parts: [],
                metadata: { systemMessageTokens: 200 },
            },
        ];
        const result = (0, tokenStatsCalculator_1.extractSyncMetadata)(messages, "anthropic:claude-opus-4-1");
        (0, bun_test_1.expect)(result.systemMessageTokens).toBe(300);
    });
    (0, bun_test_1.test)("extracts usage history", () => {
        const messages = [
            {
                id: "1",
                role: "assistant",
                parts: [],
                metadata: {
                    usage: {
                        inputTokens: 100,
                        outputTokens: 50,
                        totalTokens: 150,
                    },
                    model: "anthropic:claude-opus-4-1",
                },
            },
        ];
        const result = (0, tokenStatsCalculator_1.extractSyncMetadata)(messages, "anthropic:claude-opus-4-1");
        (0, bun_test_1.expect)(result.usageHistory.length).toBe(1);
        (0, bun_test_1.expect)(result.usageHistory[0].input.tokens).toBe(100);
        (0, bun_test_1.expect)(result.usageHistory[0].output.tokens).toBe(50);
    });
    (0, bun_test_1.test)("ignores user messages", () => {
        const messages = [
            {
                id: "1",
                role: "user",
                parts: [{ type: "text", text: "hello" }],
            },
        ];
        const result = (0, tokenStatsCalculator_1.extractSyncMetadata)(messages, "anthropic:claude-opus-4-1");
        (0, bun_test_1.expect)(result.systemMessageTokens).toBe(0);
        (0, bun_test_1.expect)(result.usageHistory.length).toBe(0);
    });
});
(0, bun_test_1.describe)("getConsumerInfoForToolCall", () => {
    (0, bun_test_1.test)("labels task tool calls as task", () => {
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.getConsumerInfoForToolCall)("task", { subagent_type: "exec", prompt: "hi", title: "t" })).toEqual({
            consumer: "task",
            toolNameForDefinition: "task",
        });
    });
    (0, bun_test_1.test)("defaults to tool name for other tools", () => {
        (0, bun_test_1.expect)((0, tokenStatsCalculator_1.getConsumerInfoForToolCall)("file_edit_insert", { file_path: "x", content: "y" })).toEqual({
            consumer: "file_edit_insert",
            toolNameForDefinition: "file_edit_insert",
        });
    });
});
(0, bun_test_1.describe)("mergeResults", () => {
    (0, bun_test_1.test)("merges job results into consumer map", () => {
        const jobs = [
            { consumer: "User", promise: Promise.resolve(100) },
            { consumer: "Assistant", promise: Promise.resolve(200) },
        ];
        const results = [100, 200];
        const toolDefinitions = new Map();
        const systemMessageTokens = 0;
        const consumerMap = (0, tokenStatsCalculator_1.mergeResults)(jobs, results, toolDefinitions, systemMessageTokens);
        (0, bun_test_1.expect)(consumerMap.get("User")).toMatchObject({ fixed: 0, variable: 100 });
        (0, bun_test_1.expect)(consumerMap.get("Assistant")).toMatchObject({ fixed: 0, variable: 200 });
    });
    (0, bun_test_1.test)("accumulates tokens for same consumer", () => {
        const jobs = [
            { consumer: "User", promise: Promise.resolve(100) },
            { consumer: "User", promise: Promise.resolve(50) },
        ];
        const results = [100, 50];
        const toolDefinitions = new Map();
        const systemMessageTokens = 0;
        const consumerMap = (0, tokenStatsCalculator_1.mergeResults)(jobs, results, toolDefinitions, systemMessageTokens);
        (0, bun_test_1.expect)(consumerMap.get("User")).toMatchObject({ fixed: 0, variable: 150 });
    });
    (0, bun_test_1.test)("adds tool definition tokens only once", () => {
        const jobs = [
            { consumer: "Read", promise: Promise.resolve(100) },
            { consumer: "Read", promise: Promise.resolve(50) },
        ];
        const results = [100, 50];
        const toolDefinitions = new Map([["Read", 25]]);
        const systemMessageTokens = 0;
        const consumerMap = (0, tokenStatsCalculator_1.mergeResults)(jobs, results, toolDefinitions, systemMessageTokens);
        // Fixed tokens added only once, variable tokens accumulated
        (0, bun_test_1.expect)(consumerMap.get("Read")).toMatchObject({ fixed: 25, variable: 150 });
    });
    (0, bun_test_1.test)("adds system message tokens", () => {
        const jobs = [];
        const results = [];
        const toolDefinitions = new Map();
        const systemMessageTokens = 300;
        const consumerMap = (0, tokenStatsCalculator_1.mergeResults)(jobs, results, toolDefinitions, systemMessageTokens);
        (0, bun_test_1.expect)(consumerMap.get("System")).toMatchObject({ fixed: 0, variable: 300 });
    });
    (0, bun_test_1.test)("skips zero token results", () => {
        const jobs = [
            { consumer: "User", promise: Promise.resolve(0) },
            { consumer: "Assistant", promise: Promise.resolve(100) },
        ];
        const results = [0, 100];
        const toolDefinitions = new Map();
        const systemMessageTokens = 0;
        const consumerMap = (0, tokenStatsCalculator_1.mergeResults)(jobs, results, toolDefinitions, systemMessageTokens);
        (0, bun_test_1.expect)(consumerMap.has("User")).toBe(false);
        (0, bun_test_1.expect)(consumerMap.get("Assistant")).toMatchObject({ fixed: 0, variable: 100 });
    });
});
//# sourceMappingURL=tokenStatsCalculator.test.js.map