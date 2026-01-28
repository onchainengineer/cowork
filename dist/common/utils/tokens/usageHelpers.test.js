"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const usageHelpers_1 = require("./usageHelpers");
(0, bun_test_1.describe)("addUsage", () => {
    (0, bun_test_1.test)("sums all fields when both arguments have values", () => {
        const a = {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            cachedInputTokens: 20,
            reasoningTokens: 10,
        };
        const b = {
            inputTokens: 200,
            outputTokens: 100,
            totalTokens: 300,
            cachedInputTokens: 30,
            reasoningTokens: 15,
        };
        (0, bun_test_1.expect)((0, usageHelpers_1.addUsage)(a, b)).toEqual({
            inputTokens: 300,
            outputTokens: 150,
            totalTokens: 450,
            cachedInputTokens: 50,
            reasoningTokens: 25,
        });
    });
    (0, bun_test_1.test)("handles undefined first argument", () => {
        const b = {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
        };
        (0, bun_test_1.expect)((0, usageHelpers_1.addUsage)(undefined, b)).toEqual({
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            cachedInputTokens: 0,
            reasoningTokens: 0,
        });
    });
    (0, bun_test_1.test)("handles sparse usage objects (missing fields treated as 0)", () => {
        // Simulating sparse SDK responses where not all fields are present
        // Using Partial to represent incomplete usage data from the SDK
        const a = { inputTokens: 100 };
        const b = { outputTokens: 50 };
        (0, bun_test_1.expect)((0, usageHelpers_1.addUsage)(a, b)).toEqual({
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
        });
    });
    (0, bun_test_1.test)("handles zero values correctly", () => {
        const a = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
        };
        const b = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
        };
        (0, bun_test_1.expect)((0, usageHelpers_1.addUsage)(a, b)).toEqual({
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cachedInputTokens: 0,
            reasoningTokens: 0,
        });
    });
    (0, bun_test_1.test)("accumulates across multiple calls (simulating multi-step)", () => {
        let cumulative = undefined;
        // Step 1
        cumulative = (0, usageHelpers_1.addUsage)(cumulative, { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 });
        (0, bun_test_1.expect)(cumulative.inputTokens).toBe(1000);
        (0, bun_test_1.expect)(cumulative.outputTokens).toBe(100);
        // Step 2
        cumulative = (0, usageHelpers_1.addUsage)(cumulative, { inputTokens: 1200, outputTokens: 150, totalTokens: 1350 });
        (0, bun_test_1.expect)(cumulative.inputTokens).toBe(2200);
        (0, bun_test_1.expect)(cumulative.outputTokens).toBe(250);
        // Step 3
        cumulative = (0, usageHelpers_1.addUsage)(cumulative, { inputTokens: 1500, outputTokens: 200, totalTokens: 1700 });
        (0, bun_test_1.expect)(cumulative.inputTokens).toBe(3700);
        (0, bun_test_1.expect)(cumulative.outputTokens).toBe(450);
    });
});
(0, bun_test_1.describe)("accumulateProviderMetadata", () => {
    (0, bun_test_1.test)("returns undefined when both arguments are undefined", () => {
        (0, bun_test_1.expect)((0, usageHelpers_1.accumulateProviderMetadata)(undefined, undefined)).toBeUndefined();
    });
    (0, bun_test_1.test)("returns existing when step is undefined", () => {
        const existing = { anthropic: { cacheCreationInputTokens: 100 } };
        (0, bun_test_1.expect)((0, usageHelpers_1.accumulateProviderMetadata)(existing, undefined)).toBe(existing);
    });
    (0, bun_test_1.test)("returns step when existing is undefined", () => {
        const step = { anthropic: { cacheCreationInputTokens: 50 } };
        (0, bun_test_1.expect)((0, usageHelpers_1.accumulateProviderMetadata)(undefined, step)).toBe(step);
    });
    (0, bun_test_1.test)("returns step when neither has cache creation tokens", () => {
        const existing = { anthropic: { cacheReadInputTokens: 100 } };
        const step = { anthropic: { cacheReadInputTokens: 200 } };
        (0, bun_test_1.expect)((0, usageHelpers_1.accumulateProviderMetadata)(existing, step)).toBe(step);
    });
    (0, bun_test_1.test)("sums cache creation tokens when both have them", () => {
        const existing = { anthropic: { cacheCreationInputTokens: 100 } };
        const step = { anthropic: { cacheCreationInputTokens: 50 } };
        const result = (0, usageHelpers_1.accumulateProviderMetadata)(existing, step);
        (0, bun_test_1.expect)(result).toEqual({
            anthropic: { cacheCreationInputTokens: 150 },
        });
    });
    (0, bun_test_1.test)("preserves step cache tokens when existing has none", () => {
        const existing = { anthropic: { cacheReadInputTokens: 100 } };
        const step = { anthropic: { cacheCreationInputTokens: 50, cacheReadInputTokens: 200 } };
        const result = (0, usageHelpers_1.accumulateProviderMetadata)(existing, step);
        (0, bun_test_1.expect)(result).toEqual({
            anthropic: { cacheCreationInputTokens: 50, cacheReadInputTokens: 200 },
        });
    });
    (0, bun_test_1.test)("preserves other anthropic fields when merging", () => {
        const existing = { anthropic: { cacheCreationInputTokens: 100 } };
        const step = {
            anthropic: {
                cacheCreationInputTokens: 50,
                cacheReadInputTokens: 200,
                modelId: "claude-sonnet-4-5",
            },
        };
        const result = (0, usageHelpers_1.accumulateProviderMetadata)(existing, step);
        (0, bun_test_1.expect)(result).toEqual({
            anthropic: {
                cacheCreationInputTokens: 150,
                cacheReadInputTokens: 200,
                modelId: "claude-sonnet-4-5",
            },
        });
    });
    (0, bun_test_1.test)("handles non-anthropic providers (returns step as-is when no cache tokens)", () => {
        const existing = { openai: { reasoningTokens: 100 } };
        const step = { openai: { reasoningTokens: 200 } };
        // No cache creation tokens, so returns step
        (0, bun_test_1.expect)((0, usageHelpers_1.accumulateProviderMetadata)(existing, step)).toBe(step);
    });
    (0, bun_test_1.test)("preserves non-anthropic provider fields alongside anthropic", () => {
        const existing = {
            anthropic: { cacheCreationInputTokens: 100 },
            openai: { reasoningTokens: 50 },
        };
        const step = {
            anthropic: { cacheCreationInputTokens: 50, cacheReadInputTokens: 200 },
            openai: { reasoningTokens: 100 },
        };
        const result = (0, usageHelpers_1.accumulateProviderMetadata)(existing, step);
        (0, bun_test_1.expect)(result).toEqual({
            anthropic: { cacheCreationInputTokens: 150, cacheReadInputTokens: 200 },
            openai: { reasoningTokens: 100 }, // From step, not accumulated
        });
    });
    (0, bun_test_1.test)("accumulates across multiple steps (simulating multi-step tool calls)", () => {
        let cumulative = undefined;
        // Step 1: Initial cache creation
        cumulative = (0, usageHelpers_1.accumulateProviderMetadata)(cumulative, {
            anthropic: { cacheCreationInputTokens: 1000, cacheReadInputTokens: 0 },
        });
        (0, bun_test_1.expect)(((cumulative?.anthropic)).cacheCreationInputTokens).toBe(1000);
        // Step 2: More cache creation
        cumulative = (0, usageHelpers_1.accumulateProviderMetadata)(cumulative, {
            anthropic: { cacheCreationInputTokens: 500, cacheReadInputTokens: 800 },
        });
        (0, bun_test_1.expect)(((cumulative?.anthropic)).cacheCreationInputTokens).toBe(1500);
        // Step 3: No cache creation (reading from cache)
        cumulative = (0, usageHelpers_1.accumulateProviderMetadata)(cumulative, {
            anthropic: { cacheCreationInputTokens: 0, cacheReadInputTokens: 1200 },
        });
        // Total should still be 1500 (0 + existing 1500)
        (0, bun_test_1.expect)(((cumulative?.anthropic)).cacheCreationInputTokens).toBe(1500);
    });
    (0, bun_test_1.test)("handles missing anthropic field in existing", () => {
        const existing = { someOtherProvider: { field: "value" } };
        const step = { anthropic: { cacheCreationInputTokens: 50 } };
        const result = (0, usageHelpers_1.accumulateProviderMetadata)(existing, step);
        (0, bun_test_1.expect)(result).toEqual({
            anthropic: { cacheCreationInputTokens: 50 },
        });
    });
    (0, bun_test_1.test)("handles missing anthropic field in step (returns step)", () => {
        const existing = { anthropic: { cacheCreationInputTokens: 100 } };
        const step = { someOtherProvider: { field: "value" } };
        // No cache creation in step means total is 100 (from existing)
        // But step has no anthropic, so stepCacheCreate=0, existingCacheCreate=100
        // total=100, which is > 0, so we merge
        const result = (0, usageHelpers_1.accumulateProviderMetadata)(existing, step);
        (0, bun_test_1.expect)(result).toEqual({
            someOtherProvider: { field: "value" },
            anthropic: { cacheCreationInputTokens: 100 },
        });
    });
});
//# sourceMappingURL=usageHelpers.test.js.map