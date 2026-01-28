"use strict";
/**
 * Provider Definitions - Single source of truth for all provider metadata
 *
 * When adding a new provider:
 * 1. Add entry to PROVIDER_DEFINITIONS below
 * 2. Add SVG icon + import in src/browser/components/ProviderIcon.tsx
 * 3. If provider needs custom logic, add handler in aiService.ts
 *    (simple providers using standard pattern are handled automatically)
 *
 * Simple providers (requiresApiKey + standard factory pattern) need NO aiService.ts changes.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDER_REGISTRY = exports.PROVIDER_DISPLAY_NAMES = exports.SUPPORTED_PROVIDERS = exports.PROVIDER_DEFINITIONS = void 0;
exports.isValidProvider = isValidProvider;
// Order determines display order in UI (Settings, model selectors, etc.)
exports.PROVIDER_DEFINITIONS = {
    "github-copilot": {
        displayName: "GitHub Copilot (via VS Code)",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/openai"))),
        factoryName: "createOpenAI",
        requiresApiKey: false, // Routes through VS Code LM Proxy — no API key needed
    },
    "github-copilot-direct": {
        displayName: "GitHub Copilot (Direct API)",
        import: () => Promise.resolve().then(() => __importStar(require("ai-sdk-provider-github"))),
        factoryName: "createCopilot",
        requiresApiKey: false, // Uses CLI credentials from ~/.config/github-copilot/apps.json
    },
    anthropic: {
        displayName: "Anthropic",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/anthropic"))),
        factoryName: "createAnthropic",
        requiresApiKey: true,
    },
    openai: {
        displayName: "OpenAI",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/openai"))),
        factoryName: "createOpenAI",
        requiresApiKey: true,
    },
    google: {
        displayName: "Google",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/google"))),
        factoryName: "createGoogleGenerativeAI",
        requiresApiKey: true,
    },
    xai: {
        displayName: "xAI",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/xai"))),
        factoryName: "createXai",
        requiresApiKey: true,
    },
    deepseek: {
        displayName: "DeepSeek",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/deepseek"))),
        factoryName: "createDeepSeek",
        requiresApiKey: true,
    },
    openrouter: {
        displayName: "OpenRouter",
        import: () => Promise.resolve().then(() => __importStar(require("@openrouter/ai-sdk-provider"))),
        factoryName: "createOpenRouter",
        requiresApiKey: true,
    },
    bedrock: {
        displayName: "Bedrock",
        import: () => Promise.resolve().then(() => __importStar(require("@ai-sdk/amazon-bedrock"))),
        factoryName: "createAmazonBedrock",
        requiresApiKey: false, // Uses AWS credential chain
    },
    ollama: {
        displayName: "Ollama",
        import: () => Promise.resolve().then(() => __importStar(require("ollama-ai-provider-v2"))),
        factoryName: "createOllama",
        requiresApiKey: false, // Local service
    },
};
/**
 * Array of all supported provider names (for UI lists, iteration, etc.)
 */
exports.SUPPORTED_PROVIDERS = Object.keys(exports.PROVIDER_DEFINITIONS);
/**
 * Display names for providers (proper casing for UI)
 * Derived from PROVIDER_DEFINITIONS - do not edit directly
 */
exports.PROVIDER_DISPLAY_NAMES = Object.fromEntries(Object.entries(exports.PROVIDER_DEFINITIONS).map(([key, def]) => [key, def.displayName]));
/**
 * Legacy registry for backward compatibility with aiService.ts
 * Maps provider names to their import functions
 */
exports.PROVIDER_REGISTRY = Object.fromEntries(Object.entries(exports.PROVIDER_DEFINITIONS).map(([key, def]) => [key, def.import]));
/**
 * Type guard to check if a string is a valid provider name
 */
function isValidProvider(provider) {
    return provider in exports.PROVIDER_REGISTRY;
}
//# sourceMappingURL=providers.js.map