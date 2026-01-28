"use strict";
// Bun test file - doesn't support Jest mocking, so we skip this test for now
// These tests would need to be rewritten to work with Bun's test runner
// For now, the commandProcessor tests demonstrate our testing approach
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const aiService_1 = require("./aiService");
const historyService_1 = require("./historyService");
const partialService_1 = require("./partialService");
const initStateManager_1 = require("./initStateManager");
const config_1 = require("../../node/config");
const appAttribution_1 = require("../../constants/appAttribution");
(0, bun_test_1.describe)("AIService", () => {
    let service;
    (0, bun_test_1.beforeEach)(() => {
        const config = new config_1.Config();
        const historyService = new historyService_1.HistoryService(config);
        const partialService = new partialService_1.PartialService(config, historyService);
        const initStateManager = new initStateManager_1.InitStateManager(config);
        service = new aiService_1.AIService(config, historyService, partialService, initStateManager);
    });
    // Note: These tests are placeholders as Bun doesn't support Jest mocking
    // In a production environment, we'd use dependency injection or other patterns
    // to make the code more testable without mocking
    (0, bun_test_1.it)("should create an AIService instance", () => {
        (0, bun_test_1.expect)(service).toBeDefined();
        (0, bun_test_1.expect)(service).toBeInstanceOf(aiService_1.AIService);
    });
});
(0, bun_test_1.describe)("normalizeAnthropicBaseURL", () => {
    (0, bun_test_1.it)("appends /v1 to URLs without it", () => {
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://api.anthropic.com")).toBe("https://api.anthropic.com/v1");
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://custom-proxy.com")).toBe("https://custom-proxy.com/v1");
    });
    (0, bun_test_1.it)("preserves URLs already ending with /v1", () => {
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://api.anthropic.com/v1")).toBe("https://api.anthropic.com/v1");
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://custom-proxy.com/v1")).toBe("https://custom-proxy.com/v1");
    });
    (0, bun_test_1.it)("removes trailing slashes before appending /v1", () => {
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://api.anthropic.com/")).toBe("https://api.anthropic.com/v1");
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://api.anthropic.com///")).toBe("https://api.anthropic.com/v1");
    });
    (0, bun_test_1.it)("removes trailing slash after /v1", () => {
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://api.anthropic.com/v1/")).toBe("https://api.anthropic.com/v1");
    });
    (0, bun_test_1.it)("handles URLs with ports", () => {
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("http://localhost:8080")).toBe("http://localhost:8080/v1");
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("http://localhost:8080/v1")).toBe("http://localhost:8080/v1");
    });
    (0, bun_test_1.it)("handles URLs with paths that include v1 in the middle", () => {
        // This should still append /v1 because the path doesn't END with /v1
        (0, bun_test_1.expect)((0, aiService_1.normalizeAnthropicBaseURL)("https://proxy.com/api/v1-beta")).toBe("https://proxy.com/api/v1-beta/v1");
    });
});
(0, bun_test_1.describe)("buildAnthropicHeaders", () => {
    (0, bun_test_1.it)("returns undefined when use1MContext is false and no existing headers", () => {
        (0, bun_test_1.expect)((0, aiService_1.buildAnthropicHeaders)(undefined, false)).toBeUndefined();
    });
    (0, bun_test_1.it)("returns existing headers unchanged when use1MContext is false", () => {
        const existing = { "x-custom": "value" };
        (0, bun_test_1.expect)((0, aiService_1.buildAnthropicHeaders)(existing, false)).toBe(existing);
    });
    (0, bun_test_1.it)("returns existing headers unchanged when use1MContext is undefined", () => {
        const existing = { "x-custom": "value" };
        (0, bun_test_1.expect)((0, aiService_1.buildAnthropicHeaders)(existing, undefined)).toBe(existing);
    });
    (0, bun_test_1.it)("adds 1M context header when use1MContext is true and no existing headers", () => {
        const result = (0, aiService_1.buildAnthropicHeaders)(undefined, true);
        (0, bun_test_1.expect)(result).toEqual({ "anthropic-beta": aiService_1.ANTHROPIC_1M_CONTEXT_HEADER });
    });
    (0, bun_test_1.it)("merges 1M context header with existing headers when use1MContext is true", () => {
        const existing = { "x-custom": "value" };
        const result = (0, aiService_1.buildAnthropicHeaders)(existing, true);
        (0, bun_test_1.expect)(result).toEqual({
            "x-custom": "value",
            "anthropic-beta": aiService_1.ANTHROPIC_1M_CONTEXT_HEADER,
        });
    });
    (0, bun_test_1.it)("overwrites existing anthropic-beta header when use1MContext is true", () => {
        const existing = { "anthropic-beta": "other-beta" };
        const result = (0, aiService_1.buildAnthropicHeaders)(existing, true);
        (0, bun_test_1.expect)(result).toEqual({ "anthropic-beta": aiService_1.ANTHROPIC_1M_CONTEXT_HEADER });
    });
});
(0, bun_test_1.describe)("buildAppAttributionHeaders", () => {
    (0, bun_test_1.it)("adds both headers when no headers exist", () => {
        (0, bun_test_1.expect)((0, aiService_1.buildAppAttributionHeaders)(undefined)).toEqual({
            "HTTP-Referer": appAttribution_1.UNIX_APP_ATTRIBUTION_URL,
            "X-Title": appAttribution_1.UNIX_APP_ATTRIBUTION_TITLE,
        });
    });
    (0, bun_test_1.it)("adds only the missing header when one is present", () => {
        const existing = { "HTTP-Referer": "https://example.com" };
        const result = (0, aiService_1.buildAppAttributionHeaders)(existing);
        (0, bun_test_1.expect)(result).toEqual({
            "HTTP-Referer": "https://example.com",
            "X-Title": appAttribution_1.UNIX_APP_ATTRIBUTION_TITLE,
        });
    });
    (0, bun_test_1.it)("does not overwrite existing values (case-insensitive)", () => {
        const existing = { "http-referer": "https://example.com", "X-TITLE": "My App" };
        const result = (0, aiService_1.buildAppAttributionHeaders)(existing);
        (0, bun_test_1.expect)(result).toEqual(existing);
    });
    (0, bun_test_1.it)("preserves unrelated headers", () => {
        const existing = { "x-custom": "value" };
        const result = (0, aiService_1.buildAppAttributionHeaders)(existing);
        (0, bun_test_1.expect)(result).toEqual({
            "x-custom": "value",
            "HTTP-Referer": appAttribution_1.UNIX_APP_ATTRIBUTION_URL,
            "X-Title": appAttribution_1.UNIX_APP_ATTRIBUTION_TITLE,
        });
    });
    (0, bun_test_1.it)("does not mutate the input object", () => {
        const existing = { "x-custom": "value" };
        const existingSnapshot = { ...existing };
        (0, aiService_1.buildAppAttributionHeaders)(existing);
        (0, bun_test_1.expect)(existing).toEqual(existingSnapshot);
    });
});
//# sourceMappingURL=aiService.test.js.map