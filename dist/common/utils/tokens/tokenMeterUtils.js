"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_COMPONENT_COLORS = void 0;
exports.calculateTokenMeterData = calculateTokenMeterData;
exports.formatTokens = formatTokens;
exports.getSegmentLabel = getSegmentLabel;
const modelStats_1 = require("./modelStats");
const models_1 = require("../ai/models");
// NOTE: Provide theme-matching fallbacks so token meters render consistently
// even if a host environment doesn't define the CSS variables (e.g., an embedded UI).
exports.TOKEN_COMPONENT_COLORS = {
    cached: "var(--color-token-cached, hsl(0 0% 50%))",
    cacheCreate: "var(--color-token-cache-create, hsl(140 20% 55%))",
    input: "var(--color-token-input, hsl(120 40% 35%))",
    output: "var(--color-token-output, hsl(207 100% 40%))",
    thinking: "var(--color-thinking-mode, hsl(271 76% 53%))",
};
const SEGMENT_DEFS = [
    { type: "cached", key: "cached", color: exports.TOKEN_COMPONENT_COLORS.cached, label: "Cache Read" },
    {
        type: "cacheCreate",
        key: "cacheCreate",
        color: exports.TOKEN_COMPONENT_COLORS.cacheCreate,
        label: "Cache Create",
    },
    { type: "input", key: "input", color: exports.TOKEN_COMPONENT_COLORS.input, label: "Input" },
    { type: "output", key: "output", color: exports.TOKEN_COMPONENT_COLORS.output, label: "Output" },
    {
        type: "reasoning",
        key: "reasoning",
        color: exports.TOKEN_COMPONENT_COLORS.thinking,
        label: "Thinking",
    },
];
/**
 * Calculate token meter data. When verticalProportions is true, segments are sized
 * proportionally to the request (e.g., 50% cached, 30% input) rather than context window.
 */
function calculateTokenMeterData(usage, model, use1M, verticalProportions = false) {
    if (!usage)
        return { segments: [], totalTokens: 0, totalPercentage: 0 };
    const modelStats = (0, modelStats_1.getModelStats)(model);
    const maxTokens = use1M && (0, models_1.supports1MContext)(model) ? 1_000_000 : modelStats?.max_input_tokens;
    // Total tokens used in the request.
    // For Anthropic prompt caching, cacheCreate tokens are reported separately but still
    // count toward total input tokens for the request.
    const totalUsed = usage.input.tokens +
        usage.cached.tokens +
        usage.cacheCreate.tokens +
        usage.output.tokens +
        usage.reasoning.tokens;
    const toPercentage = (tokens) => {
        if (verticalProportions) {
            return totalUsed > 0 ? (tokens / totalUsed) * 100 : 0;
        }
        return maxTokens ? (tokens / maxTokens) * 100 : totalUsed > 0 ? (tokens / totalUsed) * 100 : 0;
    };
    const segments = SEGMENT_DEFS.filter((def) => usage[def.key].tokens > 0).map((def) => ({
        type: def.type,
        tokens: usage[def.key].tokens,
        percentage: toPercentage(usage[def.key].tokens),
        color: def.color,
    }));
    const contextPercentage = maxTokens ? (totalUsed / maxTokens) * 100 : 100;
    return {
        segments,
        totalTokens: totalUsed,
        maxTokens,
        totalPercentage: verticalProportions
            ? maxTokens
                ? (totalUsed / maxTokens) * 100
                : 0
            : contextPercentage,
    };
}
function formatTokens(tokens) {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(1)}k`;
    }
    return tokens.toLocaleString();
}
function getSegmentLabel(type) {
    return SEGMENT_DEFS.find((def) => def.type === type)?.label ?? type;
}
//# sourceMappingURL=tokenMeterUtils.js.map