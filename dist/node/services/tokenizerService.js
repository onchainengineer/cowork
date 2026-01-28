"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenizerService = void 0;
const tokenizer_1 = require("../../node/utils/main/tokenizer");
const tokenStatsCalculator_1 = require("../../common/utils/tokens/tokenStatsCalculator");
const assert_1 = __importDefault(require("../../common/utils/assert"));
const log_1 = require("./log");
function getMaxHistorySequence(messages) {
    let max;
    for (const message of messages) {
        const seq = message.metadata?.historySequence;
        if (typeof seq !== "number") {
            continue;
        }
        if (max === undefined || seq > max) {
            max = seq;
        }
    }
    return max;
}
class TokenizerService {
    sessionUsageService;
    // Token stats calculations can overlap for a single workspace (e.g., rapid tool events).
    // The renderer ignores outdated results client-side, but the backend must also avoid
    // persisting stale `tokenStatsCache` data if an older calculation finishes after a newer one.
    latestCalcIdByWorkspace = new Map();
    nextCalcId = 0;
    constructor(sessionUsageService) {
        this.sessionUsageService = sessionUsageService;
    }
    /**
     * Count tokens for a single string
     */
    async countTokens(model, text) {
        (0, assert_1.default)(typeof model === "string" && model.length > 0, "Tokenizer countTokens requires model name");
        (0, assert_1.default)(typeof text === "string", "Tokenizer countTokens requires text");
        return (0, tokenizer_1.countTokens)(model, text);
    }
    /**
     * Count tokens for a batch of strings
     */
    async countTokensBatch(model, texts) {
        (0, assert_1.default)(typeof model === "string" && model.length > 0, "Tokenizer countTokensBatch requires model name");
        (0, assert_1.default)(Array.isArray(texts), "Tokenizer countTokensBatch requires an array of strings");
        return (0, tokenizer_1.countTokensBatch)(model, texts);
    }
    /**
     * Calculate detailed token statistics for a chat history.
     */
    async calculateStats(workspaceId, messages, model) {
        (0, assert_1.default)(typeof workspaceId === "string" && workspaceId.length > 0, "Tokenizer calculateStats requires workspaceId");
        (0, assert_1.default)(Array.isArray(messages), "Tokenizer calculateStats requires an array of messages");
        (0, assert_1.default)(typeof model === "string" && model.length > 0, "Tokenizer calculateStats requires model name");
        const calcId = ++this.nextCalcId;
        this.latestCalcIdByWorkspace.set(workspaceId, calcId);
        const stats = await (0, tokenStatsCalculator_1.calculateTokenStats)(messages, model);
        // Only persist the cache for the most recently-started calculation.
        // Older calculations can finish later and would otherwise overwrite a newer cache.
        if (this.latestCalcIdByWorkspace.get(workspaceId) !== calcId) {
            return stats;
        }
        const cache = {
            version: 1,
            computedAt: Date.now(),
            model: stats.model,
            tokenizerName: stats.tokenizerName,
            history: {
                messageCount: messages.length,
                maxHistorySequence: getMaxHistorySequence(messages),
            },
            consumers: stats.consumers,
            totalTokens: stats.totalTokens,
            topFilePaths: stats.topFilePaths,
        };
        // Defensive: keep cache invariants tight so we don't persist corrupt state.
        // Prefer returning stats over crashing the UI - if something is off, log and skip persisting.
        try {
            (0, assert_1.default)(cache.totalTokens >= 0, "Tokenizer calculateStats: cache.totalTokens must be >= 0");
            (0, assert_1.default)(cache.history.messageCount === messages.length, "Tokenizer calculateStats: cache.history.messageCount must match messages.length");
            for (const consumer of cache.consumers) {
                (0, assert_1.default)(typeof consumer.tokens === "number" && consumer.tokens >= 0, `Tokenizer calculateStats: consumer.tokens must be >= 0 (${consumer.name})`);
            }
            const sumConsumerTokens = cache.consumers.reduce((sum, consumer) => sum + consumer.tokens, 0);
            (0, assert_1.default)(sumConsumerTokens === cache.totalTokens, `Tokenizer calculateStats: totalTokens mismatch (sum=${sumConsumerTokens}, total=${cache.totalTokens})`);
        }
        catch (error) {
            log_1.log.warn("[TokenizerService] Token stats cache invariant check failed; skipping persist", {
                workspaceId,
                error,
            });
            return stats;
        }
        try {
            await this.sessionUsageService.setTokenStatsCache(workspaceId, cache);
        }
        catch (error) {
            log_1.log.warn("[TokenizerService] Failed to persist token stats cache", { workspaceId, error });
        }
        return stats;
    }
}
exports.TokenizerService = TokenizerService;
//# sourceMappingURL=tokenizerService.js.map