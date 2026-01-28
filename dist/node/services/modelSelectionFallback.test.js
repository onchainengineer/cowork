"use strict";
/**
 * Unit tests for name generation model selection fallback.
 *
 * Tests verify that:
 * 1. When preferred models aren't available, we try OpenRouter variants
 * 2. When OpenRouter variants aren't available, we fall back to any configured model
 * 3. Model selection properly prioritizes the preference order
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const workspaceTitleGenerator_1 = require("../../node/services/workspaceTitleGenerator");
const result_1 = require("../../common/types/result");
// Helper to create a mock AI service that only "succeeds" for specific models
function createMockAiService(availableModels) {
    return {
        createModel: (0, bun_test_1.mock)((modelId) => {
            if (availableModels.has(modelId)) {
                // Return a mock LanguageModel (we just need success status)
                return Promise.resolve((0, result_1.Ok)({ modelId }));
            }
            return Promise.resolve((0, result_1.Err)({ type: "api_key_not_found", provider: modelId.split(":")[0] }));
        }),
    };
}
(0, bun_test_1.describe)("selectModelForNameGeneration", () => {
    (0, bun_test_1.it)("returns first available preferred model when configured", async () => {
        const mockService = createMockAiService(new Set(["anthropic:claude-haiku-4-5", "openai:gpt-5.1-codex-mini"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
            "openai:gpt-5.1-codex-mini",
        ]);
        (0, bun_test_1.expect)(result).toBe("anthropic:claude-haiku-4-5");
    });
    (0, bun_test_1.it)("skips unavailable preferred models and tries next in list", async () => {
        // Only OpenAI is available
        const mockService = createMockAiService(new Set(["openai:gpt-5.1-codex-mini"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
            "openai:gpt-5.1-codex-mini",
        ]);
        (0, bun_test_1.expect)(result).toBe("openai:gpt-5.1-codex-mini");
    });
    (0, bun_test_1.it)("tries OpenRouter variants when direct models aren't available", async () => {
        // Only OpenRouter variants are available
        const mockService = createMockAiService(new Set(["openrouter:anthropic/claude-haiku-4-5", "openrouter:openai/gpt-5.1-codex-mini"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
            "openai:gpt-5.1-codex-mini",
        ]);
        // Should find OpenRouter variant of the first model
        (0, bun_test_1.expect)(result).toBe("openrouter:anthropic/claude-haiku-4-5");
    });
    (0, bun_test_1.it)("falls back to any available model when none of preferred are available", async () => {
        // Only Google is available, but preferred models are Anthropic/OpenAI
        const mockService = createMockAiService(new Set(["google:gemini-3-flash-preview"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
            "openai:gpt-5.1-codex-mini",
        ]);
        // Should fallback to the available Google model
        (0, bun_test_1.expect)(result).toBe("google:gemini-3-flash-preview");
    });
    (0, bun_test_1.it)("returns null when no models are available at all", async () => {
        const mockService = createMockAiService(new Set()); // No models available
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
            "openai:gpt-5.1-codex-mini",
        ]);
        (0, bun_test_1.expect)(result).toBeNull();
    });
    (0, bun_test_1.it)("prefers direct provider over OpenRouter when both available", async () => {
        // Both direct Anthropic and OpenRouter are available
        const mockService = createMockAiService(new Set(["anthropic:claude-haiku-4-5", "openrouter:anthropic/claude-haiku-4-5"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
        ]);
        // Direct provider should be preferred (it's first in the list)
        (0, bun_test_1.expect)(result).toBe("anthropic:claude-haiku-4-5");
    });
    (0, bun_test_1.it)("converts model IDs to OpenRouter format correctly", async () => {
        // Only OpenRouter is available
        const mockService = createMockAiService(new Set(["openrouter:anthropic/claude-haiku-4-5"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
        ]);
        // Model ID should be converted: anthropic:claude-haiku-4-5 -> openrouter:anthropic/claude-haiku-4-5
        (0, bun_test_1.expect)(result).toBe("openrouter:anthropic/claude-haiku-4-5");
    });
    (0, bun_test_1.it)("falls back to any known model when all preferred variants fail", async () => {
        // Only Grok is available
        const mockService = createMockAiService(new Set(["xai:grok-4-1-fast"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
        ]);
        // Should fallback to the available Grok model
        (0, bun_test_1.expect)(result).toBe("xai:grok-4-1-fast");
    });
    (0, bun_test_1.it)("falls back to OpenRouter variant of known model when direct and gateway unavailable", async () => {
        // User only has OpenRouter configured
        const mockService = createMockAiService(new Set(["openrouter:xai/grok-4-1-fast"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, [
            "anthropic:claude-haiku-4-5",
        ]);
        // Should fallback to OpenRouter variant of Grok
        (0, bun_test_1.expect)(result).toBe("openrouter:xai/grok-4-1-fast");
    });
    (0, bun_test_1.it)("uses user's selected model when preferred models unavailable", async () => {
        // User has Ollama configured (not in KNOWN_MODELS)
        const mockService = createMockAiService(new Set(["ollama:llama3"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, ["anthropic:claude-haiku-4-5"], // preferred models unavailable
        "ollama:llama3" // user's model
        );
        // Should use user's Ollama model
        (0, bun_test_1.expect)(result).toBe("ollama:llama3");
    });
    (0, bun_test_1.it)("prefers cheap models over user's potentially expensive model", async () => {
        // Both Haiku (cheap) and user's Opus (expensive) are available
        const mockService = createMockAiService(new Set(["anthropic:claude-haiku-4-5", "anthropic:claude-opus-4"]));
        const result = await (0, workspaceTitleGenerator_1.selectModelForNameGeneration)(mockService, ["anthropic:claude-haiku-4-5"], "anthropic:claude-opus-4" // user's expensive model
        );
        // Should prefer cheap Haiku over expensive Opus
        (0, bun_test_1.expect)(result).toBe("anthropic:claude-haiku-4-5");
    });
});
//# sourceMappingURL=modelSelectionFallback.test.js.map