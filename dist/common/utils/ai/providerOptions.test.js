"use strict";
/**
 * Tests for provider options builder
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const providerOptions_1 = require("./providerOptions");
// Mock the log module to avoid console noise
void bun_test_1.mock.module("@/node/services/log", () => ({
    log: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
    },
}));
(0, bun_test_1.describe)("buildProviderOptions - Anthropic", () => {
    (0, bun_test_1.describe)("Opus 4.5 (effort parameter)", () => {
        (0, bun_test_1.test)("should use effort and thinking parameters for claude-opus-4-5", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-opus-4-5", "medium");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                    thinking: {
                        type: "enabled",
                        budgetTokens: 10000, // ANTHROPIC_THINKING_BUDGETS.medium
                    },
                    effort: "medium",
                },
            });
        });
        (0, bun_test_1.test)("should use effort and thinking parameters for claude-opus-4-5-20251101", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-opus-4-5-20251101", "high");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                    thinking: {
                        type: "enabled",
                        budgetTokens: 20000, // ANTHROPIC_THINKING_BUDGETS.high
                    },
                    effort: "high",
                },
            });
        });
        (0, bun_test_1.test)("should use effort 'low' with no thinking when off for Opus 4.5", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-opus-4-5", "off");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                    effort: "low", // "off" maps to effort: "low" for efficiency
                },
            });
        });
    });
    (0, bun_test_1.describe)("Other Anthropic models (thinking/budgetTokens)", () => {
        (0, bun_test_1.test)("should use thinking.budgetTokens for claude-sonnet-4-5", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-sonnet-4-5", "medium");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                    thinking: {
                        type: "enabled",
                        budgetTokens: 10000,
                    },
                },
            });
        });
        (0, bun_test_1.test)("should use thinking.budgetTokens for claude-opus-4-1", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-opus-4-1", "high");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                    thinking: {
                        type: "enabled",
                        budgetTokens: 20000,
                    },
                },
            });
        });
        (0, bun_test_1.test)("should use thinking.budgetTokens for claude-haiku-4-5", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-haiku-4-5", "low");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                    thinking: {
                        type: "enabled",
                        budgetTokens: 4000,
                    },
                },
            });
        });
        (0, bun_test_1.test)("should omit thinking when thinking is off for non-Opus 4.5", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("anthropic:claude-sonnet-4-5", "off");
            (0, bun_test_1.expect)(result).toEqual({
                anthropic: {
                    disableParallelToolUse: false,
                    sendReasoning: true,
                },
            });
        });
    });
});
(0, bun_test_1.describe)("buildProviderOptions - OpenAI", () => {
    // Helper to extract OpenAI options from the result
    const getOpenAIOptions = (result) => {
        if ("openai" in result) {
            return result.openai;
        }
        return undefined;
    };
    (0, bun_test_1.describe)("promptCacheKey derivation", () => {
        (0, bun_test_1.test)("should derive promptCacheKey from workspaceId when provided", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("openai:gpt-5.2", "off", undefined, undefined, undefined, "abc123");
            const openai = getOpenAIOptions(result);
            (0, bun_test_1.expect)(openai).toBeDefined();
            (0, bun_test_1.expect)(openai.promptCacheKey).toBe("unix-v1-abc123");
            (0, bun_test_1.expect)(openai.truncation).toBe("disabled");
        });
        (0, bun_test_1.test)("should allow auto truncation when explicitly enabled", () => {
            const result = (0, providerOptions_1.buildProviderOptions)("openai:gpt-5.2", "off", undefined, undefined, undefined, "compaction-workspace", "auto");
            const openai = getOpenAIOptions(result);
            (0, bun_test_1.expect)(openai).toBeDefined();
            (0, bun_test_1.expect)(openai.truncation).toBe("auto");
        });
    });
});
//# sourceMappingURL=providerOptions.test.js.map