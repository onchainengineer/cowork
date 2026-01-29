"use strict";
/**
 * Centralized model metadata. Update model versions here and everywhere else will follow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_ABBREVIATION_EXAMPLES = exports.KNOWN_MODEL_OPTIONS = exports.MODEL_NAMES = exports.TOKENIZER_MODEL_OVERRIDES = exports.MODEL_ABBREVIATIONS = exports.DEFAULT_WARM_MODELS = exports.DEFAULT_MODEL = exports.DEFAULT_MODEL_KEY = exports.KNOWN_MODELS = void 0;
exports.getKnownModel = getKnownModel;
const modelDisplay_1 = require("../utils/ai/modelDisplay");
// Model definitions. Note we avoid listing legacy models here. These represent the focal models
// of the community.
const MODEL_DEFINITIONS = {
    // Direct Copilot API (default - works in most environments)
    COPILOT_DIRECT_SONNET: {
        provider: "github-copilot-direct",
        providerModelId: "claude-sonnet-4.5",
        aliases: ["copilot", "copilot-sonnet", "copilot-direct"],
        warm: true,
        tokenizerOverride: "anthropic/claude-sonnet-4.5",
    },
    COPILOT_DIRECT_GPT: {
        provider: "github-copilot-direct",
        providerModelId: "gpt-4o",
        aliases: ["copilot-gpt", "copilot-direct-gpt"],
        warm: true,
        tokenizerOverride: "openai/gpt-5",
    },
    // VS Code LM Proxy mode (for airgapped environments)
    COPILOT_PROXY_SONNET: {
        provider: "github-copilot",
        providerModelId: "claude-sonnet-4.5",
        aliases: ["copilot-proxy", "copilot-proxy-sonnet"],
        warm: false,
        tokenizerOverride: "anthropic/claude-sonnet-4.5",
    },
    COPILOT_PROXY_GPT: {
        provider: "github-copilot",
        providerModelId: "gpt-4o",
        aliases: ["copilot-proxy-gpt"],
        warm: false,
        tokenizerOverride: "openai/gpt-5",
    },
    OPUS: {
        provider: "anthropic",
        providerModelId: "claude-opus-4-5",
        aliases: ["opus"],
        warm: true,
    },
    SONNET: {
        provider: "anthropic",
        providerModelId: "claude-sonnet-4-5",
        aliases: ["sonnet"],
        warm: true,
        tokenizerOverride: "anthropic/claude-sonnet-4.5",
    },
    HAIKU: {
        provider: "anthropic",
        providerModelId: "claude-haiku-4-5",
        aliases: ["haiku"],
        tokenizerOverride: "anthropic/claude-3.5-haiku",
    },
    GPT: {
        provider: "openai",
        providerModelId: "gpt-5.2",
        aliases: ["gpt"],
        warm: true,
        tokenizerOverride: "openai/gpt-5",
    },
    GPT_PRO: {
        provider: "openai",
        providerModelId: "gpt-5.2-pro",
        aliases: ["gpt-pro"],
    },
    GPT_52_CODEX: {
        provider: "openai",
        providerModelId: "gpt-5.2-codex",
        aliases: ["codex"],
        warm: true,
        tokenizerOverride: "openai/gpt-5",
    },
    GPT_CODEX: {
        provider: "openai",
        providerModelId: "gpt-5.1-codex",
        aliases: ["codex-5.1"],
        warm: true,
        tokenizerOverride: "openai/gpt-5",
    },
    GPT_MINI: {
        provider: "openai",
        providerModelId: "gpt-5.1-codex-mini",
        aliases: ["codex-mini"],
    },
    GPT_CODEX_MAX: {
        provider: "openai",
        providerModelId: "gpt-5.1-codex-max",
        aliases: ["codex-max"],
        warm: true,
        tokenizerOverride: "openai/gpt-5",
    },
    GEMINI_3_PRO: {
        provider: "google",
        providerModelId: "gemini-3-pro-preview",
        aliases: ["gemini", "gemini-3", "gemini-3-pro"],
        tokenizerOverride: "google/gemini-2.5-pro",
    },
    GEMINI_3_FLASH: {
        provider: "google",
        providerModelId: "gemini-3-flash-preview",
        aliases: ["gemini-3-flash"],
        tokenizerOverride: "google/gemini-2.5-pro",
    },
    GROK_4_1: {
        provider: "xai",
        providerModelId: "grok-4-1-fast",
        aliases: ["grok", "grok-4", "grok-4.1", "grok-4-1"],
    },
    GROK_CODE: {
        provider: "xai",
        providerModelId: "grok-code-fast-1",
        aliases: ["grok-code"],
    },
};
const MODEL_DEFINITION_ENTRIES = Object.entries(MODEL_DEFINITIONS);
exports.KNOWN_MODELS = Object.fromEntries(MODEL_DEFINITION_ENTRIES.map(([key, definition]) => toKnownModelEntry(key, definition)));
function toKnownModelEntry(key, definition) {
    return [
        key,
        {
            ...definition,
            id: `${definition.provider}:${definition.providerModelId}`,
        },
    ];
}
function getKnownModel(key) {
    return exports.KNOWN_MODELS[key];
}
// ------------------------------------------------------------------------------------
// Derived collections
// ------------------------------------------------------------------------------------
/** The default model key - change this single line to update the global default */
exports.DEFAULT_MODEL_KEY = "COPILOT_DIRECT_SONNET";
exports.DEFAULT_MODEL = exports.KNOWN_MODELS[exports.DEFAULT_MODEL_KEY].id;
exports.DEFAULT_WARM_MODELS = Object.values(exports.KNOWN_MODELS)
    .filter((model) => model.warm)
    .map((model) => model.id);
exports.MODEL_ABBREVIATIONS = Object.fromEntries(Object.values(exports.KNOWN_MODELS)
    .flatMap((model) => (model.aliases ?? []).map((alias) => [alias, model.id]))
    .sort(([a], [b]) => a.localeCompare(b)));
exports.TOKENIZER_MODEL_OVERRIDES = Object.fromEntries(Object.values(exports.KNOWN_MODELS)
    .filter((model) => Boolean(model.tokenizerOverride))
    .map((model) => [model.id, model.tokenizerOverride]));
exports.MODEL_NAMES = Object.entries(exports.KNOWN_MODELS).reduce((acc, [key, model]) => {
    if (!acc[model.provider]) {
        const emptyRecord = {};
        acc[model.provider] = emptyRecord;
    }
    acc[model.provider][key] = model.providerModelId;
    return acc;
}, {});
/** Picker-friendly list: { label, value } for each known model */
exports.KNOWN_MODEL_OPTIONS = Object.values(exports.KNOWN_MODELS).map((model) => ({
    label: (0, modelDisplay_1.formatModelDisplayName)(model.providerModelId),
    value: model.id,
}));
/** Tooltip-friendly abbreviation examples: show representative shortcuts */
exports.MODEL_ABBREVIATION_EXAMPLES = ["opus", "sonnet"].map((abbrev) => ({
    abbrev,
    displayName: (0, modelDisplay_1.formatModelDisplayName)(exports.MODEL_ABBREVIATIONS[abbrev]?.split(":")[1] ?? abbrev),
}));
//# sourceMappingURL=knownModels.js.map