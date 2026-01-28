"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTokenizerModules = loadTokenizerModules;
exports.getTokenizerForModel = getTokenizerForModel;
exports.countTokens = countTokens;
exports.countTokensBatch = countTokensBatch;
exports.countTokensForData = countTokensForData;
exports.getToolDefinitionTokens = getToolDefinitionTokens;
exports.__resetTokenizerForTests = __resetTokenizerForTests;
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const crc_32_1 = __importDefault(require("crc-32"));
const lru_cache_1 = require("lru-cache");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const ai_tokenizer_1 = require("ai-tokenizer");
const workerPool_1 = require("./workerPool");
const knownModels_1 = require("../../../common/constants/knownModels");
const models_1 = require("../../../common/utils/ai/models");
const log_1 = require("../../../node/services/log");
const safeStringifyForCounting_1 = require("../../../common/utils/tokens/safeStringifyForCounting");
const APPROX_ENCODING = "approx-4";
function shouldUseApproxTokenizer() {
    // UNIX_FORCE_REAL_TOKENIZER=1 overrides approx mode (for tests that need real tokenization)
    // UNIX_APPROX_TOKENIZER=1 enables fast approximate mode (default in Jest)
    if (process.env.UNIX_FORCE_REAL_TOKENIZER === "1") {
        return false;
    }
    return process.env.UNIX_APPROX_TOKENIZER === "1";
}
function approximateCount(text) {
    if (typeof text !== "string" || text.length === 0) {
        return 0;
    }
    return Math.ceil(text.length / 4);
}
function getApproxTokenizer() {
    return {
        encoding: APPROX_ENCODING,
        countTokens: (input) => Promise.resolve(approximateCount(input)),
    };
}
const encodingPromises = new Map();
const inFlightCounts = new Map();
const tokenCountCache = new lru_cache_1.LRUCache({
    maxSize: 250_000,
    sizeCalculation: () => 1,
});
// Track which models we've already warned about to avoid log spam
const warnedModels = new Set();
function normalizeModelKey(modelName) {
    (0, assert_1.default)(typeof modelName === "string" && modelName.length > 0, "Model name must be a non-empty string");
    const override = knownModels_1.TOKENIZER_MODEL_OVERRIDES[modelName];
    const normalized = override ?? (modelName.includes(":") ? modelName.replace(":", "/") : modelName);
    if (!(normalized in ai_tokenizer_1.models)) {
        // Return null for unknown models - caller can decide to fallback or error
        return null;
    }
    return normalized;
}
/**
 * Resolves a model string to a ModelName, falling back to a similar model if unknown.
 * Optionally logs a warning when falling back.
 */
function resolveModelName(modelString) {
    const normalized = (0, models_1.normalizeGatewayModel)(modelString);
    let modelName = normalizeModelKey(normalized);
    if (!modelName) {
        const provider = normalized.split(":")[0] || "anthropic";
        const fallbackModel = provider === "anthropic"
            ? "anthropic/claude-sonnet-4.5"
            : provider === "google"
                ? "google/gemini-2.5-pro"
                : "openai/gpt-5";
        // Only warn once per unknown model to avoid log spam
        if (!warnedModels.has(modelString)) {
            warnedModels.add(modelString);
            log_1.log.warn(`Unknown model '${modelString}', using ${fallbackModel} tokenizer for approximate token counting`);
        }
        modelName = fallbackModel;
    }
    return modelName;
}
function resolveEncoding(modelName) {
    let promise = encodingPromises.get(modelName);
    if (!promise) {
        promise = (0, workerPool_1.run)("encodingName", modelName)
            .then((result) => {
            (0, assert_1.default)(typeof result === "string" && result.length > 0, "Token encoding name must be a non-empty string");
            return result;
        })
            .catch((error) => {
            encodingPromises.delete(modelName);
            throw error;
        });
        encodingPromises.set(modelName, promise);
    }
    return promise;
}
function buildCacheKey(modelName, text) {
    const checksum = crc_32_1.default.str(text);
    return `${modelName}:${checksum}:${text.length}`;
}
async function countTokensInternal(modelName, text) {
    (0, assert_1.default)(typeof text === "string", "Tokenizer countTokens expects string input");
    if (text.length === 0) {
        return 0;
    }
    const key = buildCacheKey(modelName, text);
    const cached = tokenCountCache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    let pending = inFlightCounts.get(key);
    if (!pending) {
        const payload = { modelName, input: text };
        pending = (0, workerPool_1.run)("countTokens", payload)
            .then((value) => {
            (0, assert_1.default)(typeof value === "number" && Number.isFinite(value) && value >= 0, "Tokenizer must return a non-negative finite token count");
            tokenCountCache.set(key, value);
            inFlightCounts.delete(key);
            return value;
        })
            .catch((error) => {
            inFlightCounts.delete(key);
            throw error;
        });
        inFlightCounts.set(key, pending);
    }
    return pending;
}
function loadTokenizerModules(modelsToWarm = Array.from(knownModels_1.DEFAULT_WARM_MODELS)) {
    if (shouldUseApproxTokenizer()) {
        const fulfilled = modelsToWarm.map(() => ({
            status: "fulfilled",
            value: APPROX_ENCODING,
        }));
        return Promise.resolve(fulfilled);
    }
    return Promise.allSettled(modelsToWarm.map((modelString) => {
        const modelName = normalizeModelKey(modelString);
        // Skip unknown models during warmup
        if (!modelName) {
            return Promise.reject(new Error(`Unknown model: ${modelString}`));
        }
        return resolveEncoding(modelName);
    }));
}
async function getTokenizerForModel(modelString) {
    if (shouldUseApproxTokenizer()) {
        return getApproxTokenizer();
    }
    const modelName = resolveModelName(modelString);
    const encodingName = await resolveEncoding(modelName);
    return {
        encoding: encodingName,
        countTokens: (input) => countTokensInternal(modelName, input),
    };
}
function countTokens(modelString, text) {
    if (shouldUseApproxTokenizer()) {
        return Promise.resolve(approximateCount(text));
    }
    const modelName = resolveModelName(modelString);
    return countTokensInternal(modelName, text);
}
function countTokensBatch(modelString, texts) {
    (0, assert_1.default)(Array.isArray(texts), "Batch token counting expects an array of strings");
    if (shouldUseApproxTokenizer()) {
        return Promise.resolve(texts.map((text) => approximateCount(text)));
    }
    const modelName = resolveModelName(modelString);
    return Promise.all(texts.map((text) => countTokensInternal(modelName, text)));
}
function countTokensForData(data, tokenizer) {
    const serialized = (0, safeStringifyForCounting_1.safeStringifyForCounting)(data);
    return tokenizer.countTokens(serialized);
}
async function getToolDefinitionTokens(toolName, modelString) {
    try {
        const availableTools = (0, toolDefinitions_1.getAvailableTools)(modelString);
        if (!availableTools.includes(toolName)) {
            return 0;
        }
        const toolSchemas = (0, toolDefinitions_1.getToolSchemas)();
        const toolSchema = toolSchemas[toolName];
        if (!toolSchema) {
            return 40;
        }
        return countTokens(modelString, JSON.stringify(toolSchema));
    }
    catch {
        const fallbackSizes = {
            bash: 65,
            file_read: 45,
            file_edit_replace_string: 70,
            file_edit_replace_lines: 80,
            file_edit_insert: 50,
            web_search: 50,
            google_search: 50,
        };
        return fallbackSizes[toolName] ?? 40;
    }
}
function __resetTokenizerForTests() {
    encodingPromises.clear();
    tokenCountCache.clear();
    inFlightCounts.clear();
}
//# sourceMappingURL=tokenizer.js.map