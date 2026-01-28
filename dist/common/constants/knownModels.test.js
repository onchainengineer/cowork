"use strict";
/**
 * Integration test for known models - verifies all models exist in models.json
 *
 * This test does NOT go through IPC - it directly uses data from models.json
 * to verify that every providerModelId in KNOWN_MODELS exists.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const knownModels_1 = require("../../common/constants/knownModels");
const models_json_1 = __importDefault(require("../../common/utils/tokens/models.json"));
const models_extra_1 = require("../../common/utils/tokens/models-extra");
(0, globals_1.describe)("Known Models Integration", () => {
    (0, globals_1.test)("all known models exist in models.json", () => {
        const missingModels = [];
        for (const [key, model] of Object.entries(knownModels_1.KNOWN_MODELS)) {
            const modelId = model.providerModelId;
            // Check if model exists in models.json or models-extra
            // xAI models are prefixed with "xai/" in models.json
            const lookupKey = model.provider === "xai" ? `xai/${modelId}` : modelId;
            if (!(lookupKey in models_json_1.default) && !(modelId in models_extra_1.modelsExtra)) {
                missingModels.push(`${key}: ${model.provider}:${modelId}`);
            }
        }
        // Report all missing models at once for easier debugging
        if (missingModels.length > 0) {
            throw new Error(`The following known models are missing from models.json:\n${missingModels.join("\n")}\n\n` +
                `Run 'bun scripts/update_models.ts' to refresh models.json from LiteLLM.`);
        }
    });
    (0, globals_1.test)("all known models have required metadata", () => {
        for (const [, model] of Object.entries(knownModels_1.KNOWN_MODELS)) {
            const modelId = model.providerModelId;
            // xAI models are prefixed with "xai/" in models.json
            const lookupKey = model.provider === "xai" ? `xai/${modelId}` : modelId;
            const modelData = models_json_1.default[lookupKey] ?? models_extra_1.modelsExtra[modelId];
            (0, globals_1.expect)(modelData).toBeDefined();
            // Check that basic metadata fields exist (not all models have all fields)
            (0, globals_1.expect)(typeof modelData.litellm_provider).toBe("string");
        }
    });
});
//# sourceMappingURL=knownModels.test.js.map