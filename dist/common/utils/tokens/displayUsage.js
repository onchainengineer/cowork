"use strict";
/**
 * Display usage utilities for renderer
 *
 * IMPORTANT: This file must NOT import tokenizer to avoid pulling Node.js
 * dependencies into the renderer bundle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDisplayUsage = createDisplayUsage;
const modelStats_1 = require("./modelStats");
const models_1 = require("../ai/models");
/**
 * Create a display-friendly usage object from AI SDK usage
 *
 * This function transforms raw AI SDK usage data into a format suitable
 * for display in the UI. It does NOT require the tokenizer.
 */
function createDisplayUsage(usage, model, providerMetadata) {
    if (!usage)
        return undefined;
    // Provider-specific token handling:
    // - OpenAI: inputTokens is INCLUSIVE of cachedInputTokens
    // - Anthropic: inputTokens EXCLUDES cachedInputTokens
    const cachedTokens = usage.cachedInputTokens ?? 0;
    const rawInputTokens = usage.inputTokens ?? 0;
    const normalizedModel = (0, models_1.normalizeGatewayModel)(model);
    // Detect provider from normalized model string
    const isOpenAI = normalizedModel.startsWith("openai:");
    const isGoogle = normalizedModel.startsWith("google:");
    // OpenAI and Google report inputTokens INCLUSIVE of cachedInputTokens
    // Anthropic reports them separately (inputTokens EXCLUDES cached)
    // Subtract cached tokens for providers that include them to avoid double-counting
    const inputTokens = isOpenAI || isGoogle ? Math.max(0, rawInputTokens - cachedTokens) : rawInputTokens;
    // Extract cache creation tokens from provider metadata (Anthropic-specific)
    const cacheCreateTokens = providerMetadata?.anthropic
        ?.cacheCreationInputTokens ?? 0;
    // Extract reasoning tokens with fallback to provider metadata (OpenAI-specific)
    const reasoningTokens = usage.reasoningTokens ??
        providerMetadata?.openai?.reasoningTokens ??
        0;
    // Calculate output tokens excluding reasoning
    const outputWithoutReasoning = Math.max(0, (usage.outputTokens ?? 0) - reasoningTokens);
    // Get model stats for cost calculation
    const modelStats = (0, modelStats_1.getModelStats)(model);
    // Calculate costs based on model stats (undefined if model unknown)
    let inputCost;
    let cachedCost;
    let cacheCreateCost;
    let outputCost;
    let reasoningCost;
    if (modelStats) {
        inputCost = inputTokens * modelStats.input_cost_per_token;
        cachedCost = cachedTokens * (modelStats.cache_read_input_token_cost ?? 0);
        cacheCreateCost = cacheCreateTokens * (modelStats.cache_creation_input_token_cost ?? 0);
        outputCost = outputWithoutReasoning * modelStats.output_cost_per_token;
        reasoningCost = reasoningTokens * modelStats.output_cost_per_token;
    }
    return {
        input: {
            tokens: inputTokens,
            cost_usd: inputCost,
        },
        cached: {
            tokens: cachedTokens,
            cost_usd: cachedCost,
        },
        cacheCreate: {
            tokens: cacheCreateTokens,
            cost_usd: cacheCreateCost,
        },
        output: {
            tokens: outputWithoutReasoning,
            cost_usd: outputCost,
        },
        reasoning: {
            tokens: reasoningTokens,
            cost_usd: reasoningCost,
        },
        model, // Include model for display purposes
    };
}
//# sourceMappingURL=displayUsage.js.map