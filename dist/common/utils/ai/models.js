"use strict";
/**
 * Model configuration and constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultModel = void 0;
exports.resolveModelAlias = resolveModelAlias;
exports.isValidModelFormat = isValidModelFormat;
exports.normalizeGatewayModel = normalizeGatewayModel;
exports.getModelName = getModelName;
exports.getModelProvider = getModelProvider;
exports.supports1MContext = supports1MContext;
const knownModels_1 = require("../../../common/constants/knownModels");
exports.defaultModel = knownModels_1.DEFAULT_MODEL;
/**
 * Resolve model alias to full model string.
 * If the input is an alias (e.g., "haiku", "sonnet"), returns the full model string.
 * Otherwise returns the input unchanged.
 */
function resolveModelAlias(modelInput) {
    return knownModels_1.MODEL_ABBREVIATIONS[modelInput] ?? modelInput;
}
/**
 * Validate model string format (must be "provider:model-id").
 * Supports colons in the model ID (e.g., "ollama:gpt-oss:20b").
 */
function isValidModelFormat(model) {
    const colonIndex = model.indexOf(":");
    return colonIndex > 0 && colonIndex < model.length - 1;
}
/**
 * Passthrough for backward compatibility.
 * Previously normalized gateway-prefixed model strings; now returns input unchanged.
 */
function normalizeGatewayModel(modelString) {
    return modelString;
}
/**
 * Extract the model name from a model string (e.g., "anthropic:claude-sonnet-4-5" -> "claude-sonnet-4-5")
 * @param modelString - Full model string in format "provider:model-name"
 * @returns The model name part (after the colon), or the full string if no colon is found
 */
function getModelName(modelString) {
    const normalized = normalizeGatewayModel(modelString);
    const colonIndex = normalized.indexOf(":");
    if (colonIndex === -1) {
        return normalized;
    }
    return normalized.substring(colonIndex + 1);
}
/**
 * Extract the provider from a model string (e.g., "anthropic:claude-sonnet-4-5" -> "anthropic")
 * @param modelString - Full model string in format "provider:model-name"
 * @returns The provider part (before the colon), or empty string if no colon is found
 */
function getModelProvider(modelString) {
    const normalized = normalizeGatewayModel(modelString);
    const colonIndex = normalized.indexOf(":");
    if (colonIndex === -1) {
        return "";
    }
    return normalized.substring(0, colonIndex);
}
/**
 * Check if a model supports the 1M context window.
 * The 1M context window is only available for Claude Sonnet 4 and Sonnet 4.5.
 * @param modelString - Full model string in format "provider:model-name"
 * @returns True if the model supports 1M context window
 */
function supports1MContext(modelString) {
    const normalized = normalizeGatewayModel(modelString);
    const [provider, modelName] = normalized.split(":");
    if (provider !== "anthropic") {
        return false;
    }
    // Check for Sonnet 4 and Sonnet 4.5 models
    return (modelName?.includes("claude-sonnet-4") && !modelName.includes("claude-sonnet-3") // Exclude Sonnet 3.x models
    );
}
//# sourceMappingURL=models.js.map