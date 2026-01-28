"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const displayUsage_1 = require("./displayUsage");
(0, bun_test_1.describe)("createDisplayUsage", () => {
    (0, bun_test_1.describe)("Provider-specific cached token handling", () => {
        // OpenAI reports inputTokens INCLUSIVE of cachedInputTokens
        // We must subtract cached from input to avoid double-counting
        const openAIUsage = {
            inputTokens: 108200, // Includes 71600 cached
            outputTokens: 227,
            totalTokens: 108427,
            cachedInputTokens: 71600,
        };
        (0, bun_test_1.test)("subtracts cached tokens for direct OpenAI model", () => {
            const result = (0, displayUsage_1.createDisplayUsage)(openAIUsage, "openai:gpt-5.2");
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.cached.tokens).toBe(71600);
            // Input should be raw minus cached: 108200 - 71600 = 36600
            (0, bun_test_1.expect)(result.input.tokens).toBe(36600);
        });
        (0, bun_test_1.test)("does NOT subtract cached tokens for Anthropic model", () => {
            // Anthropic reports inputTokens EXCLUDING cachedInputTokens
            const anthropicUsage = {
                inputTokens: 36600, // Already excludes cached
                outputTokens: 227,
                totalTokens: 108427,
                cachedInputTokens: 71600,
            };
            const result = (0, displayUsage_1.createDisplayUsage)(anthropicUsage, "anthropic:claude-sonnet-4-5");
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.cached.tokens).toBe(71600);
            // Input stays as-is for Anthropic
            (0, bun_test_1.expect)(result.input.tokens).toBe(36600);
        });
        (0, bun_test_1.test)("subtracts cached tokens for direct Google model", () => {
            // Google also reports inputTokens INCLUSIVE of cachedInputTokens
            const googleUsage = {
                inputTokens: 74300, // Includes 42600 cached
                outputTokens: 1600,
                totalTokens: 75900,
                cachedInputTokens: 42600,
            };
            const result = (0, displayUsage_1.createDisplayUsage)(googleUsage, "google:gemini-3-pro-preview");
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.cached.tokens).toBe(42600);
            // Input should be raw minus cached: 74300 - 42600 = 31700
            (0, bun_test_1.expect)(result.input.tokens).toBe(31700);
        });
    });
    (0, bun_test_1.test)("returns undefined for undefined usage", () => {
        (0, bun_test_1.expect)((0, displayUsage_1.createDisplayUsage)(undefined, "openai:gpt-5.2")).toBeUndefined();
    });
    (0, bun_test_1.test)("handles zero cached tokens", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            cachedInputTokens: 0,
        };
        const result = (0, displayUsage_1.createDisplayUsage)(usage, "openai:gpt-5.2");
        (0, bun_test_1.expect)(result).toBeDefined();
        (0, bun_test_1.expect)(result.input.tokens).toBe(1000);
        (0, bun_test_1.expect)(result.cached.tokens).toBe(0);
    });
    (0, bun_test_1.test)("handles missing cachedInputTokens field", () => {
        const usage = {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
        };
        const result = (0, displayUsage_1.createDisplayUsage)(usage, "openai:gpt-5.2");
        (0, bun_test_1.expect)(result).toBeDefined();
        (0, bun_test_1.expect)(result.input.tokens).toBe(1000);
        (0, bun_test_1.expect)(result.cached.tokens).toBe(0);
    });
    (0, bun_test_1.describe)("Anthropic cache creation tokens from providerMetadata", () => {
        // Cache creation tokens are Anthropic-specific and only available in
        // providerMetadata.anthropic.cacheCreationInputTokens, not in LanguageModelV2Usage.
        // This is critical for liveUsage display during streaming.
        (0, bun_test_1.test)("extracts cacheCreationInputTokens from providerMetadata", () => {
            const usage = {
                inputTokens: 1000,
                outputTokens: 50,
                totalTokens: 1050,
            };
            const result = (0, displayUsage_1.createDisplayUsage)(usage, "anthropic:claude-sonnet-4-20250514", {
                anthropic: { cacheCreationInputTokens: 800 },
            });
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.cacheCreate.tokens).toBe(800);
        });
        (0, bun_test_1.test)("cacheCreate is 0 when providerMetadata is undefined", () => {
            const usage = {
                inputTokens: 1000,
                outputTokens: 50,
                totalTokens: 1050,
            };
            const result = (0, displayUsage_1.createDisplayUsage)(usage, "anthropic:claude-sonnet-4-20250514");
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.cacheCreate.tokens).toBe(0);
        });
        (0, bun_test_1.test)("cacheCreate is 0 when anthropic metadata lacks cacheCreationInputTokens", () => {
            const usage = {
                inputTokens: 1000,
                outputTokens: 50,
                totalTokens: 1050,
            };
            const result = (0, displayUsage_1.createDisplayUsage)(usage, "anthropic:claude-sonnet-4-20250514", {
                anthropic: { someOtherField: 123 },
            });
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.cacheCreate.tokens).toBe(0);
        });
    });
});
//# sourceMappingURL=displayUsage.test.js.map