"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAvailableModel = findAvailableModel;
exports.selectModelForNameGeneration = selectModelForNameGeneration;
exports.generateWorkspaceIdentity = generateWorkspaceIdentity;
exports.generateWorkspaceName = generateWorkspaceName;
const ai_1 = require("ai");
const zod_1 = require("zod");
const log_1 = require("./log");
const result_1 = require("../../common/types/result");
const crypto_1 = __importDefault(require("crypto"));
const knownModels_1 = require("../../common/constants/knownModels");
/** Small, fast models preferred for name generation (cheap and quick) */
const DEFAULT_NAME_GENERATION_MODELS = [(0, knownModels_1.getKnownModel)("HAIKU").id, (0, knownModels_1.getKnownModel)("GPT_MINI").id];
/** Schema for AI-generated workspace identity (area name + descriptive title) */
const workspaceIdentitySchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .min(2)
        .max(20)
        .describe("Codebase area (1-2 words): lowercase, hyphens only, e.g. 'sidebar', 'auth', 'config'"),
    title: zod_1.z
        .string()
        .min(5)
        .max(60)
        .describe("Human-readable title (2-5 words): verb-noun format like 'Fix plan mode'"),
});
/**
 * Find the first model from the list that the AIService can create.
 * Frontend is responsible for providing models in the correct format
 * based on user configuration.
 */
async function findAvailableModel(aiService, models) {
    for (const modelId of models) {
        const result = await aiService.createModel(modelId);
        if (result.success) {
            return modelId;
        }
    }
    return null;
}
/**
 * Convert a model ID to an OpenRouter variant.
 * e.g., toOpenRouterVariant("anthropic:claude-haiku-4-5") -> "openrouter:anthropic/claude-haiku-4-5"
 */
function toOpenRouterVariant(modelId) {
    const [provider, model] = modelId.split(":");
    if (!provider || !model)
        return modelId;
    return `openrouter:${provider}/${model}`;
}
/**
 * Select a model for name generation with intelligent fallback.
 *
 * Priority order:
 * 1. Try preferred models (Haiku, GPT-Mini) directly
 * 2. Try OpenRouter variants of preferred models
 * 3. Try user's selected model (for Ollama/Bedrock/custom providers)
 * 4. Fallback to any available model from the known models list
 *
 * This ensures name generation works with any provider setup:
 * direct API keys, OpenRouter, or custom providers.
 *
 * Note: createModel() validates provider configuration internally,
 * returning Err({ type: "api_key_not_found" }) for unconfigured providers.
 * We only use models where createModel succeeds.
 */
async function selectModelForNameGeneration(aiService, preferredModels = DEFAULT_NAME_GENERATION_MODELS, userModel) {
    // 1. Try preferred models directly
    for (const modelId of preferredModels) {
        const result = await aiService.createModel(modelId);
        if (result.success) {
            return modelId;
        }
    }
    // 2. Try OpenRouter variants of preferred models
    for (const modelId of preferredModels) {
        const openRouterVariant = toOpenRouterVariant(modelId);
        const result = await aiService.createModel(openRouterVariant);
        if (result.success) {
            return openRouterVariant;
        }
    }
    // 3. Try user's selected model (supports Ollama, Bedrock, custom providers)
    if (userModel) {
        const result = await aiService.createModel(userModel);
        if (result.success) {
            return userModel;
        }
    }
    // 4. Fallback to any available model from known models
    // Try each known model directly, then via OpenRouter
    const knownModelIds = Object.values(knownModels_1.KNOWN_MODELS).map((m) => m.id);
    for (const modelId of knownModelIds) {
        // Try direct first
        const directResult = await aiService.createModel(modelId);
        if (directResult.success) {
            return modelId;
        }
        // Try OpenRouter variant
        const openRouterVariant = toOpenRouterVariant(modelId);
        const openRouterResult = await aiService.createModel(openRouterVariant);
        if (openRouterResult.success) {
            return openRouterVariant;
        }
    }
    // No models available at all
    return null;
}
// Crockford Base32 alphabet (excludes I, L, O, U to avoid confusion)
const CROCKFORD_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
/**
 * Generate a 4-character random suffix using Crockford Base32.
 * Uses 20 bits of randomness (4 chars × 5 bits each).
 */
function generateNameSuffix() {
    const bytes = crypto_1.default.randomBytes(3); // 24 bits, we'll use 20
    const value = (bytes[0] << 12) | (bytes[1] << 4) | (bytes[2] >> 4);
    return (CROCKFORD_ALPHABET[(value >> 15) & 0x1f] +
        CROCKFORD_ALPHABET[(value >> 10) & 0x1f] +
        CROCKFORD_ALPHABET[(value >> 5) & 0x1f] +
        CROCKFORD_ALPHABET[value & 0x1f]);
}
/**
 * Generate workspace identity (name + title) using AI.
 * - name: Codebase area with 4-char suffix (e.g., "sidebar-a1b2")
 * - title: Human-readable description (e.g., "Fix plan mode over SSH")
 *
 * If AI cannot be used (e.g. missing credentials, unsupported provider, invalid model),
 * returns a SendMessageError so callers can surface the standard provider error UX.
 */
async function generateWorkspaceIdentity(message, modelString, aiService) {
    try {
        const modelResult = await aiService.createModel(modelString);
        if (!modelResult.success) {
            return (0, result_1.Err)(modelResult.error);
        }
        const result = await (0, ai_1.generateObject)({
            model: modelResult.data,
            schema: workspaceIdentitySchema,
            mode: "json",
            prompt: `Generate a workspace name and title for this development task:

"${message}"

Requirements:
- name: The area of the codebase being worked on (1-2 words, git-safe: lowercase, hyphens only). Random bytes will be appended for uniqueness, so focus on the area not the specific task. Examples: "sidebar", "auth", "config", "api"
- title: A 2-5 word description in verb-noun format. Examples: "Fix plan mode", "Add user authentication", "Refactor sidebar layout"`,
        });
        const suffix = generateNameSuffix();
        const sanitizedName = sanitizeBranchName(result.object.name, 20);
        const nameWithSuffix = `${sanitizedName}-${suffix}`;
        return (0, result_1.Ok)({
            name: nameWithSuffix,
            title: result.object.title.trim(),
        });
    }
    catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        log_1.log.error("Failed to generate workspace identity with AI", error);
        return (0, result_1.Err)({ type: "unknown", raw: `Failed to generate workspace identity: ${messageText}` });
    }
}
/**
 * @deprecated Use generateWorkspaceIdentity instead
 * Generate workspace name using AI (legacy function for backwards compatibility).
 */
async function generateWorkspaceName(message, modelString, aiService) {
    const result = await generateWorkspaceIdentity(message, modelString, aiService);
    if (!result.success) {
        return result;
    }
    return (0, result_1.Ok)(result.data.name);
}
/**
 * Sanitize a string to be git-safe: lowercase, hyphens only, no leading/trailing hyphens.
 */
function sanitizeBranchName(name, maxLength) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-")
        .substring(0, maxLength);
}
//# sourceMappingURL=workspaceTitleGenerator.js.map