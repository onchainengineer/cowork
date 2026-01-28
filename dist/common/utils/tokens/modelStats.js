"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelStats = getModelStats;
const models_json_1 = __importDefault(require("./models.json"));
const models_extra_1 = require("./models-extra");
const models_1 = require("../ai/models");
/**
 * Validates raw model data has required fields
 */
function isValidModelData(data) {
    return (typeof data.max_input_tokens === "number" &&
        typeof data.input_cost_per_token === "number" &&
        typeof data.output_cost_per_token === "number");
}
/**
 * Extracts ModelStats from validated raw data
 */
function extractModelStats(data) {
    // Type assertions are safe here because isValidModelData() already validated these fields
    /* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
    return {
        max_input_tokens: data.max_input_tokens,
        max_output_tokens: typeof data.max_output_tokens === "number" ? data.max_output_tokens : undefined,
        input_cost_per_token: data.input_cost_per_token,
        output_cost_per_token: data.output_cost_per_token,
        cache_creation_input_token_cost: typeof data.cache_creation_input_token_cost === "number"
            ? data.cache_creation_input_token_cost
            : undefined,
        cache_read_input_token_cost: typeof data.cache_read_input_token_cost === "number"
            ? data.cache_read_input_token_cost
            : undefined,
    };
    /* eslint-enable @typescript-eslint/non-nullable-type-assertion-style */
}
/**
 * Generates lookup keys for a model string with multiple naming patterns
 * Handles LiteLLM conventions like "ollama/model-cloud" and "provider/model"
 */
function generateLookupKeys(modelString) {
    const colonIndex = modelString.indexOf(":");
    const provider = colonIndex !== -1 ? modelString.slice(0, colonIndex) : "";
    const modelName = colonIndex !== -1 ? modelString.slice(colonIndex + 1) : modelString;
    const keys = [
        modelName, // Direct model name (e.g., "claude-opus-4-1")
    ];
    // Add provider-prefixed variants for Ollama and other providers
    if (provider) {
        keys.push(`${provider}/${modelName}`, // "ollama/gpt-oss:20b"
        `${provider}/${modelName}-cloud` // "ollama/gpt-oss:20b-cloud" (LiteLLM convention)
        );
        // Fallback: strip size suffix for base model lookup
        // "ollama:gpt-oss:20b" → "ollama/gpt-oss"
        if (modelName.includes(":")) {
            const baseModel = modelName.split(":")[0];
            keys.push(`${provider}/${baseModel}`);
        }
    }
    return keys;
}
/**
 * Gets model statistics for a given Vercel AI SDK model string
 * @param modelString - Format: "provider:model-name" (e.g., "anthropic:claude-opus-4-1", "ollama:gpt-oss:20b")
 * @returns ModelStats or null if model not found
 */
function getModelStats(modelString) {
    const normalized = (0, models_1.normalizeGatewayModel)(modelString);
    const lookupKeys = generateLookupKeys(normalized);
    // Check models-extra.ts first (overrides for models with incorrect upstream data)
    for (const key of lookupKeys) {
        const data = models_extra_1.modelsExtra[key];
        if (data && isValidModelData(data)) {
            return extractModelStats(data);
        }
    }
    // Fall back to main models.json
    for (const key of lookupKeys) {
        const data = models_json_1.default[key];
        if (data && isValidModelData(data)) {
            return extractModelStats(data);
        }
    }
    return null;
}
//# sourceMappingURL=modelStats.js.map