"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelCapabilities = getModelCapabilities;
exports.getSupportedInputMediaTypes = getSupportedInputMediaTypes;
const models_json_1 = __importDefault(require("../tokens/models.json"));
const models_extra_1 = require("../tokens/models-extra");
const models_1 = require("./models");
/**
 * Generates lookup keys for a model string with multiple naming patterns.
 *
 * Keep this aligned with getModelStats(): many providers/layers use slightly different
 * conventions (e.g. "ollama/model-cloud", "provider/model").
 */
function generateLookupKeys(modelString) {
    const colonIndex = modelString.indexOf(":");
    const provider = colonIndex !== -1 ? modelString.slice(0, colonIndex) : "";
    const modelName = colonIndex !== -1 ? modelString.slice(colonIndex + 1) : modelString;
    const keys = [
        modelName, // Direct model name (e.g., "claude-opus-4-5")
    ];
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
function extractModelCapabilities(data) {
    const maxPdfSizeMb = typeof data.max_pdf_size_mb === "number" ? data.max_pdf_size_mb : undefined;
    return {
        // Some providers omit supports_pdf_input but still include a max_pdf_size_mb field.
        // Treat maxPdfSizeMb as a strong signal that PDF input is supported.
        supportsPdfInput: data.supports_pdf_input === true || maxPdfSizeMb !== undefined,
        supportsVision: data.supports_vision === true,
        supportsAudioInput: data.supports_audio_input === true,
        supportsVideoInput: data.supports_video_input === true,
        maxPdfSizeMb,
    };
}
function getModelCapabilities(modelString) {
    const normalized = (0, models_1.normalizeGatewayModel)(modelString);
    const lookupKeys = generateLookupKeys(normalized);
    const modelsExtraRecord = models_extra_1.modelsExtra;
    const modelsDataRecord = models_json_1.default;
    // Merge models.json (upstream) + models-extra.ts (local overrides). Extras win.
    // This avoids wiping capabilities (e.g. PDF support) when modelsExtra only overrides
    // pricing/token limits.
    for (const key of lookupKeys) {
        const base = modelsDataRecord[key];
        const extra = modelsExtraRecord[key];
        if (base || extra) {
            const merged = { ...(base ?? {}), ...(extra ?? {}) };
            return extractModelCapabilities(merged);
        }
    }
    return null;
}
function getSupportedInputMediaTypes(modelString) {
    const caps = getModelCapabilities(modelString);
    if (!caps)
        return null;
    const result = new Set();
    if (caps.supportsVision)
        result.add("image");
    if (caps.supportsPdfInput)
        result.add("pdf");
    if (caps.supportsAudioInput)
        result.add("audio");
    if (caps.supportsVideoInput)
        result.add("video");
    return result;
}
//# sourceMappingURL=modelCapabilities.js.map