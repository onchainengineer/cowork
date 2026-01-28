"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const chatStats_1 = require("./chatStats");
(0, bun_test_1.describe)("SessionUsageFileSchema conformance", () => {
    (0, bun_test_1.it)("preserves rolledUpFrom and tokenStatsCache fields", () => {
        const full = {
            byModel: {
                "gpt-4": {
                    input: { tokens: 1, cost_usd: 0.01 },
                    cached: { tokens: 0, cost_usd: 0 },
                    cacheCreate: { tokens: 0, cost_usd: 0 },
                    output: { tokens: 2, cost_usd: 0.02 },
                    reasoning: { tokens: 0, cost_usd: 0 },
                    model: "gpt-4",
                },
            },
            lastRequest: {
                model: "gpt-4",
                usage: {
                    input: { tokens: 1 },
                    cached: { tokens: 0 },
                    cacheCreate: { tokens: 0 },
                    output: { tokens: 2 },
                    reasoning: { tokens: 0 },
                    model: "gpt-4",
                },
                timestamp: 123,
            },
            rolledUpFrom: { "child-workspace": true },
            tokenStatsCache: {
                version: 1,
                computedAt: 123,
                model: "gpt-4",
                tokenizerName: "cl100k",
                history: { messageCount: 2, maxHistorySequence: 42 },
                consumers: [{ name: "User", tokens: 10, percentage: 100 }],
                totalTokens: 10,
                topFilePaths: [{ path: "/tmp/file.ts", tokens: 10 }],
            },
            version: 1,
        };
        const parsed = chatStats_1.SessionUsageFileSchema.parse(full);
        // oRPC output validation strips unknown keys; ensure we preserve everything we return.
        (0, bun_test_1.expect)(parsed).toEqual(full);
        (0, bun_test_1.expect)(Object.keys(parsed).sort()).toEqual(Object.keys(full).sort());
    });
    (0, bun_test_1.it)("parses legacy session-usage.json without optional fields", () => {
        const legacy = {
            byModel: {},
            version: 1,
        };
        const parsed = chatStats_1.SessionUsageFileSchema.parse(legacy);
        (0, bun_test_1.expect)(parsed.byModel).toEqual({});
        (0, bun_test_1.expect)(parsed.version).toBe(1);
        (0, bun_test_1.expect)(parsed.rolledUpFrom).toBeUndefined();
        (0, bun_test_1.expect)(parsed.tokenStatsCache).toBeUndefined();
    });
});
//# sourceMappingURL=chatStats.test.js.map