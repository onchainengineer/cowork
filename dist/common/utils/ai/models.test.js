"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const models_1 = require("./models");
(0, bun_test_1.describe)("normalizeGatewayModel", () => {
    (0, bun_test_1.it)("should return all strings unchanged (passthrough)", () => {
        (0, bun_test_1.expect)((0, models_1.normalizeGatewayModel)("anthropic:claude-opus-4-5")).toBe("anthropic:claude-opus-4-5");
        (0, bun_test_1.expect)((0, models_1.normalizeGatewayModel)("openai:gpt-4o")).toBe("openai:gpt-4o");
        (0, bun_test_1.expect)((0, models_1.normalizeGatewayModel)("claude-opus-4-5")).toBe("claude-opus-4-5");
    });
});
(0, bun_test_1.describe)("getModelName", () => {
    (0, bun_test_1.it)("should extract model name from provider:model format", () => {
        (0, bun_test_1.expect)((0, models_1.getModelName)("anthropic:claude-opus-4-5")).toBe("claude-opus-4-5");
        (0, bun_test_1.expect)((0, models_1.getModelName)("openai:gpt-4o")).toBe("gpt-4o");
    });
    (0, bun_test_1.it)("should return full string if no colon", () => {
        (0, bun_test_1.expect)((0, models_1.getModelName)("claude-opus-4-5")).toBe("claude-opus-4-5");
    });
});
(0, bun_test_1.describe)("supports1MContext", () => {
    (0, bun_test_1.it)("should return true for Anthropic Sonnet 4 models", () => {
        (0, bun_test_1.expect)((0, models_1.supports1MContext)("anthropic:claude-sonnet-4-5")).toBe(true);
        (0, bun_test_1.expect)((0, models_1.supports1MContext)("anthropic:claude-sonnet-4-5-20250514")).toBe(true);
        (0, bun_test_1.expect)((0, models_1.supports1MContext)("anthropic:claude-sonnet-4-20250514")).toBe(true);
    });
    (0, bun_test_1.it)("should return false for non-Anthropic models", () => {
        (0, bun_test_1.expect)((0, models_1.supports1MContext)("openai:gpt-4o")).toBe(false);
    });
    (0, bun_test_1.it)("should return false for Anthropic non-Sonnet-4 models", () => {
        (0, bun_test_1.expect)((0, models_1.supports1MContext)("anthropic:claude-opus-4-5")).toBe(false);
        (0, bun_test_1.expect)((0, models_1.supports1MContext)("anthropic:claude-haiku-4-5")).toBe(false);
    });
});
(0, bun_test_1.describe)("isValidModelFormat", () => {
    (0, bun_test_1.it)("returns true for valid model formats", () => {
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("anthropic:claude-sonnet-4-5")).toBe(true);
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("openai:gpt-5.2")).toBe(true);
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("google:gemini-3-pro-preview")).toBe(true);
        // Ollama-style model names with colons in the model ID
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("ollama:gpt-oss:20b")).toBe(true);
    });
    (0, bun_test_1.it)("returns false for invalid model formats", () => {
        // Missing colon
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("gpt")).toBe(false);
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("sonnet")).toBe(false);
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("badmodel")).toBe(false);
        // Colon at start or end
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)(":model")).toBe(false);
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("provider:")).toBe(false);
        // Empty string
        (0, bun_test_1.expect)((0, models_1.isValidModelFormat)("")).toBe(false);
    });
});
(0, bun_test_1.describe)("resolveModelAlias", () => {
    (0, bun_test_1.it)("resolves known aliases to full model strings", () => {
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("haiku")).toBe("anthropic:claude-haiku-4-5");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("sonnet")).toBe("anthropic:claude-sonnet-4-5");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("opus")).toBe("anthropic:claude-opus-4-5");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("grok")).toBe("xai:grok-4-1-fast");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("codex")).toBe("openai:gpt-5.2-codex");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("codex-5.1")).toBe("openai:gpt-5.1-codex");
    });
    (0, bun_test_1.it)("returns non-alias strings unchanged", () => {
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("anthropic:custom-model")).toBe("anthropic:custom-model");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("openai:gpt-5.2")).toBe("openai:gpt-5.2");
        (0, bun_test_1.expect)((0, models_1.resolveModelAlias)("unknown")).toBe("unknown");
    });
});
//# sourceMappingURL=models.test.js.map