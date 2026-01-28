"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const modelStats_1 = require("./modelStats");
const knownModels_1 = require("../../../common/constants/knownModels");
(0, bun_test_1.describe)("getModelStats", () => {
    (0, bun_test_1.describe)("direct model lookups", () => {
        (0, bun_test_1.test)("should find anthropic models by direct name", () => {
            const stats = (0, modelStats_1.getModelStats)(knownModels_1.KNOWN_MODELS.OPUS.id);
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
            (0, bun_test_1.expect)(stats?.input_cost_per_token).toBeGreaterThan(0);
        });
        (0, bun_test_1.test)("should find openai models by direct name", () => {
            const stats = (0, modelStats_1.getModelStats)(knownModels_1.KNOWN_MODELS.GPT.id);
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
        (0, bun_test_1.test)("should find models in models-extra.ts", () => {
            const stats = (0, modelStats_1.getModelStats)("openai:gpt-5.2-pro");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBe(272000);
            (0, bun_test_1.expect)(stats?.input_cost_per_token).toBe(0.000021);
        });
        (0, bun_test_1.test)("models-extra.ts should override models.json", () => {
            // gpt-5.2-codex exists in both files - models-extra.ts has correct 272k, models.json has incorrect 400k
            const stats = (0, modelStats_1.getModelStats)("openai:gpt-5.2-codex");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBe(272000); // models-extra.ts override
        });
    });
    (0, bun_test_1.describe)("ollama model lookups with cloud suffix", () => {
        (0, bun_test_1.test)("should find ollama gpt-oss:20b with cloud suffix", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:gpt-oss:20b");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBe(131072);
            (0, bun_test_1.expect)(stats?.input_cost_per_token).toBe(0); // Local models are free
            (0, bun_test_1.expect)(stats?.output_cost_per_token).toBe(0);
        });
        (0, bun_test_1.test)("should find ollama gpt-oss:120b with cloud suffix", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:gpt-oss:120b");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBe(131072);
        });
        (0, bun_test_1.test)("should find ollama deepseek-v3.1:671b with cloud suffix", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:deepseek-v3.1:671b");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
    });
    (0, bun_test_1.describe)("ollama model lookups without cloud suffix", () => {
        (0, bun_test_1.test)("should find ollama llama3.1 directly", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:llama3.1");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
        (0, bun_test_1.test)("should find ollama llama3:8b with size variant", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:llama3:8b");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
        (0, bun_test_1.test)("should find ollama codellama", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:codellama");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
    });
    (0, bun_test_1.describe)("provider-prefixed lookups", () => {
        (0, bun_test_1.test)("should find models with provider/ prefix", () => {
            // Some models in models.json use provider/ prefix
            const stats = (0, modelStats_1.getModelStats)("ollama:llama2");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
    });
    (0, bun_test_1.describe)("unknown models", () => {
        (0, bun_test_1.test)("should return null for completely unknown model", () => {
            const stats = (0, modelStats_1.getModelStats)("unknown:fake-model-9000");
            (0, bun_test_1.expect)(stats).toBeNull();
        });
        (0, bun_test_1.test)("should return null for known provider but unknown model", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:this-model-does-not-exist");
            (0, bun_test_1.expect)(stats).toBeNull();
        });
    });
    (0, bun_test_1.describe)("model without provider prefix", () => {
        (0, bun_test_1.test)("should handle model string without provider", () => {
            const stats = (0, modelStats_1.getModelStats)("gpt-5.2");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBeGreaterThan(0);
        });
    });
    (0, bun_test_1.describe)("existing test cases", () => {
        (0, bun_test_1.it)("should return model stats for claude-sonnet-4-5", () => {
            const stats = (0, modelStats_1.getModelStats)(knownModels_1.KNOWN_MODELS.SONNET.id);
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.input_cost_per_token).toBe(0.000003);
            (0, bun_test_1.expect)(stats?.output_cost_per_token).toBe(0.000015);
            (0, bun_test_1.expect)(stats?.max_input_tokens).toBe(200000);
        });
        (0, bun_test_1.it)("should handle model without provider prefix", () => {
            const stats = (0, modelStats_1.getModelStats)("claude-sonnet-4-5");
            (0, bun_test_1.expect)(stats).not.toBeNull();
            (0, bun_test_1.expect)(stats?.input_cost_per_token).toBe(0.000003);
        });
        (0, bun_test_1.it)("should return cache pricing when available", () => {
            const stats = (0, modelStats_1.getModelStats)(knownModels_1.KNOWN_MODELS.SONNET.id);
            (0, bun_test_1.expect)(stats?.cache_creation_input_token_cost).toBe(0.00000375);
            (0, bun_test_1.expect)(stats?.cache_read_input_token_cost).toBe(3e-7);
        });
        (0, bun_test_1.it)("should return null for unknown models", () => {
            const stats = (0, modelStats_1.getModelStats)("unknown:model");
            (0, bun_test_1.expect)(stats).toBeNull();
        });
    });
    (0, bun_test_1.describe)("model data validation", () => {
        (0, bun_test_1.test)("should include cache costs when available", () => {
            const stats = (0, modelStats_1.getModelStats)(knownModels_1.KNOWN_MODELS.OPUS.id);
            // Anthropic models have cache costs
            if (stats) {
                (0, bun_test_1.expect)(stats.cache_creation_input_token_cost).toBeDefined();
                (0, bun_test_1.expect)(stats.cache_read_input_token_cost).toBeDefined();
            }
        });
        (0, bun_test_1.test)("should not include cache costs when unavailable", () => {
            const stats = (0, modelStats_1.getModelStats)("ollama:llama3.1");
            // Ollama models don't have cache costs in models.json
            if (stats) {
                (0, bun_test_1.expect)(stats.cache_creation_input_token_cost).toBeUndefined();
                (0, bun_test_1.expect)(stats.cache_read_input_token_cost).toBeUndefined();
            }
        });
    });
});
//# sourceMappingURL=modelStats.test.js.map