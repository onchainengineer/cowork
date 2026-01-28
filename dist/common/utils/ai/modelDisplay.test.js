"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const modelDisplay_1 = require("./modelDisplay");
(0, bun_test_1.describe)("formatModelDisplayName", () => {
    (0, bun_test_1.describe)("Claude models", () => {
        (0, bun_test_1.test)("formats Sonnet models", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("claude-sonnet-4-5")).toBe("Sonnet 4.5");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("claude-sonnet-4")).toBe("Sonnet 4");
        });
        (0, bun_test_1.test)("formats Opus models", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("claude-opus-4-1")).toBe("Opus 4.1");
        });
    });
    (0, bun_test_1.describe)("GPT models", () => {
        (0, bun_test_1.test)("formats GPT models", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("gpt-5-pro")).toBe("GPT-5 Pro");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("gpt-4o")).toBe("GPT-4o");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("gpt-4o-mini")).toBe("GPT-4o Mini");
        });
    });
    (0, bun_test_1.describe)("Gemini models", () => {
        (0, bun_test_1.test)("formats Gemini models", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("gemini-2-0-flash-exp")).toBe("Gemini 2.0 Flash Exp");
        });
    });
    (0, bun_test_1.describe)("Ollama models", () => {
        (0, bun_test_1.test)("formats Llama models with size", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("llama3.2:7b")).toBe("Llama 3.2 (7B)");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("llama3.2:13b")).toBe("Llama 3.2 (13B)");
        });
        (0, bun_test_1.test)("formats Codellama models with size", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("codellama:7b")).toBe("Codellama (7B)");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("codellama:13b")).toBe("Codellama (13B)");
        });
        (0, bun_test_1.test)("formats Qwen models with size", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("qwen2.5:7b")).toBe("Qwen 2.5 (7B)");
        });
        (0, bun_test_1.test)("handles models without size suffix", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("llama3")).toBe("Llama3");
        });
    });
    (0, bun_test_1.describe)("Bedrock models", () => {
        (0, bun_test_1.test)("formats Anthropic Claude models from Bedrock", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("global.anthropic.claude-sonnet-4-5-20250929-v1:0")).toBe("Sonnet 4.5");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("us.anthropic.claude-opus-4-20250514-v1:0")).toBe("Opus 4");
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("anthropic.claude-3-5-sonnet-20240620-v1:0")).toBe("Sonnet 3.5");
        });
        (0, bun_test_1.test)("formats Amazon Titan models from Bedrock", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("amazon.titan-text-premier-v1:0")).toBe("Titan Text Premier");
        });
    });
    (0, bun_test_1.describe)("fallback formatting", () => {
        (0, bun_test_1.test)("capitalizes dash-separated parts", () => {
            (0, bun_test_1.expect)((0, modelDisplay_1.formatModelDisplayName)("custom-model-name")).toBe("Custom Model Name");
        });
    });
});
//# sourceMappingURL=modelDisplay.test.js.map