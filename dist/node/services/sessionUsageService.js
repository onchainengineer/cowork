"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionUsageService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const assert_1 = __importDefault(require("../../common/utils/assert"));
const workspaceFileLocks_1 = require("../../node/utils/concurrency/workspaceFileLocks");
const usageAggregator_1 = require("../../common/utils/tokens/usageAggregator");
const displayUsage_1 = require("../../common/utils/tokens/displayUsage");
const models_1 = require("../../common/utils/ai/models");
const log_1 = require("./log");
/**
 * Service for managing cumulative session usage tracking.
 *
 * Replaces O(n) message iteration with a persistent JSON file that stores
 * per-model usage breakdowns. Usage is accumulated on stream-end, never
 * subtracted, making costs immune to message deletion.
 */
class SessionUsageService {
    SESSION_USAGE_FILE = "session-usage.json";
    fileLocks = workspaceFileLocks_1.workspaceFileLocks;
    config;
    historyService;
    constructor(config, historyService) {
        this.config = config;
        this.historyService = historyService;
    }
    getFilePath(workspaceId) {
        return path.join(this.config.getSessionDir(workspaceId), this.SESSION_USAGE_FILE);
    }
    async readFile(workspaceId) {
        try {
            const data = await fs.readFile(this.getFilePath(workspaceId), "utf-8");
            return JSON.parse(data);
        }
        catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                return { byModel: {}, version: 1 };
            }
            throw error;
        }
    }
    async writeFile(workspaceId, data) {
        const filePath = this.getFilePath(workspaceId);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await (0, write_file_atomic_1.default)(filePath, JSON.stringify(data, null, 2));
    }
    /**
     * Record usage from a completed stream. Accumulates with existing usage
     * AND updates lastRequest in a single atomic write.
     * Model should already be normalized via normalizeGatewayModel().
     */
    async recordUsage(workspaceId, model, usage) {
        return this.fileLocks.withLock(workspaceId, async () => {
            const current = await this.readFile(workspaceId);
            const existing = current.byModel[model];
            // CRITICAL: Accumulate, don't overwrite
            current.byModel[model] = existing ? (0, usageAggregator_1.sumUsageHistory)([existing, usage]) : usage;
            current.lastRequest = { model, usage, timestamp: Date.now() };
            await this.writeFile(workspaceId, current);
        });
    }
    /**
     * Persist derived token stats (consumer + file breakdown) as a cache.
     *
     * This is intentionally treated as a replaceable cache: if the cache is stale,
     * the next tokenizer.calculateStats call will overwrite it.
     */
    async setTokenStatsCache(workspaceId, cache) {
        (0, assert_1.default)(workspaceId.trim().length > 0, "setTokenStatsCache: workspaceId empty");
        (0, assert_1.default)(cache.version === 1, "setTokenStatsCache: cache.version must be 1");
        (0, assert_1.default)(cache.totalTokens >= 0, "setTokenStatsCache: totalTokens must be >= 0");
        (0, assert_1.default)(cache.history.messageCount >= 0, "setTokenStatsCache: history.messageCount must be >= 0");
        for (const consumer of cache.consumers) {
            (0, assert_1.default)(typeof consumer.tokens === "number" && consumer.tokens >= 0, `setTokenStatsCache: consumer tokens must be >= 0 (${consumer.name})`);
        }
        return this.fileLocks.withLock(workspaceId, async () => {
            // Defensive: don't create new session dirs for already-deleted workspaces.
            if (!this.config.findWorkspace(workspaceId)) {
                return;
            }
            let current;
            try {
                current = await this.readFile(workspaceId);
            }
            catch {
                // Parse errors or other read failures - best-effort rebuild.
                log_1.log.warn(`session-usage.json unreadable for ${workspaceId}, rebuilding before token stats cache update`);
                const historyResult = await this.historyService.getHistory(workspaceId);
                if (historyResult.success && historyResult.data.length > 0) {
                    await this.rebuildFromMessagesInternal(workspaceId, historyResult.data);
                    current = await this.readFile(workspaceId);
                }
                else {
                    current = { byModel: {}, version: 1 };
                }
            }
            current.tokenStatsCache = cache;
            await this.writeFile(workspaceId, current);
        });
    }
    /**
     * Merge child usage into the parent workspace.
     *
     * Used to preserve sub-agent costs when the child workspace is deleted.
     *
     * IMPORTANT:
     * - Does not update parent's lastRequest
     * - Uses an on-disk idempotency ledger (rolledUpFrom) to prevent double-counting
     */
    async rollUpUsageIntoParent(parentWorkspaceId, childWorkspaceId, childUsageByModel) {
        (0, assert_1.default)(parentWorkspaceId.trim().length > 0, "rollUpUsageIntoParent: parentWorkspaceId empty");
        (0, assert_1.default)(childWorkspaceId.trim().length > 0, "rollUpUsageIntoParent: childWorkspaceId empty");
        (0, assert_1.default)(parentWorkspaceId !== childWorkspaceId, "rollUpUsageIntoParent: parentWorkspaceId must differ from childWorkspaceId");
        // Defensive: don't create new session dirs for already-deleted parents.
        if (!this.config.findWorkspace(parentWorkspaceId)) {
            return { didRollUp: false };
        }
        const entries = Object.entries(childUsageByModel);
        if (entries.length === 0) {
            return { didRollUp: false };
        }
        return this.fileLocks.withLock(parentWorkspaceId, async () => {
            let current;
            try {
                current = await this.readFile(parentWorkspaceId);
            }
            catch {
                // Parse errors or other read failures - best-effort rebuild.
                log_1.log.warn(`session-usage.json unreadable for ${parentWorkspaceId}, rebuilding before roll-up`);
                const historyResult = await this.historyService.getHistory(parentWorkspaceId);
                if (historyResult.success && historyResult.data.length > 0) {
                    await this.rebuildFromMessagesInternal(parentWorkspaceId, historyResult.data);
                    current = await this.readFile(parentWorkspaceId);
                }
                else {
                    current = { byModel: {}, version: 1 };
                }
            }
            if (current.rolledUpFrom?.[childWorkspaceId]) {
                return { didRollUp: false };
            }
            for (const [model, usage] of entries) {
                const existing = current.byModel[model];
                current.byModel[model] = existing ? (0, usageAggregator_1.sumUsageHistory)([existing, usage]) : usage;
            }
            current.rolledUpFrom = { ...(current.rolledUpFrom ?? {}), [childWorkspaceId]: true };
            await this.writeFile(parentWorkspaceId, current);
            return { didRollUp: true };
        });
    }
    /**
     * Read current session usage. Returns undefined if file missing/corrupted
     * and no messages to rebuild from.
     */
    async getSessionUsage(workspaceId) {
        return this.fileLocks.withLock(workspaceId, async () => {
            try {
                const filePath = this.getFilePath(workspaceId);
                const data = await fs.readFile(filePath, "utf-8");
                return JSON.parse(data);
            }
            catch (error) {
                // File missing or corrupted - try to rebuild from messages
                if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                    const historyResult = await this.historyService.getHistory(workspaceId);
                    if (historyResult.success && historyResult.data.length > 0) {
                        await this.rebuildFromMessagesInternal(workspaceId, historyResult.data);
                        return this.readFile(workspaceId);
                    }
                    return undefined; // Truly empty session
                }
                // Parse error - try rebuild
                log_1.log.warn(`session-usage.json corrupted for ${workspaceId}, rebuilding`);
                const historyResult = await this.historyService.getHistory(workspaceId);
                if (historyResult.success && historyResult.data.length > 0) {
                    await this.rebuildFromMessagesInternal(workspaceId, historyResult.data);
                    return this.readFile(workspaceId);
                }
                return undefined;
            }
        });
    }
    /**
     * Batch fetch session usage for multiple workspaces.
     * Optimized for displaying costs in archived workspaces list.
     */
    async getSessionUsageBatch(workspaceIds) {
        const results = {};
        // Read files in parallel without rebuilding from messages (archived workspaces
        // should already have session-usage.json; skip rebuild to keep batch fast)
        await Promise.all(workspaceIds.map(async (workspaceId) => {
            try {
                const filePath = this.getFilePath(workspaceId);
                const data = await fs.readFile(filePath, "utf-8");
                results[workspaceId] = JSON.parse(data);
            }
            catch {
                results[workspaceId] = undefined;
            }
        }));
        return results;
    }
    /**
     * Rebuild session usage from messages (for migration/recovery).
     * Internal version - called within lock.
     */
    async rebuildFromMessagesInternal(workspaceId, messages) {
        const result = { byModel: {}, version: 1 };
        let lastAssistantUsage;
        for (const msg of messages) {
            if (msg.role === "assistant") {
                // Include historicalUsage from legacy compaction summaries.
                // This field was removed from UnixMetadata but may exist in persisted data.
                // It's a ChatUsageDisplay representing all pre-compaction costs (model-agnostic).
                const historicalUsage = msg.metadata
                    ?.historicalUsage;
                if (historicalUsage) {
                    const existing = result.byModel.historical;
                    result.byModel.historical = existing
                        ? (0, usageAggregator_1.sumUsageHistory)([existing, historicalUsage])
                        : historicalUsage;
                }
                // Extract current message's usage
                if (msg.metadata?.usage) {
                    const rawModel = msg.metadata.model ?? "unknown";
                    const model = (0, models_1.normalizeGatewayModel)(rawModel);
                    const usage = (0, displayUsage_1.createDisplayUsage)(msg.metadata.usage, rawModel, msg.metadata.providerMetadata);
                    if (usage) {
                        const existing = result.byModel[model];
                        result.byModel[model] = existing ? (0, usageAggregator_1.sumUsageHistory)([existing, usage]) : usage;
                        lastAssistantUsage = { model, usage };
                    }
                }
            }
        }
        if (lastAssistantUsage) {
            result.lastRequest = {
                model: lastAssistantUsage.model,
                usage: lastAssistantUsage.usage,
                timestamp: Date.now(),
            };
        }
        await this.writeFile(workspaceId, result);
        log_1.log.info(`Rebuilt session-usage.json for ${workspaceId} from ${messages.length} messages`);
    }
    /**
     * Public rebuild method (acquires lock).
     */
    async rebuildFromMessages(workspaceId, messages) {
        return this.fileLocks.withLock(workspaceId, async () => {
            await this.rebuildFromMessagesInternal(workspaceId, messages);
        });
    }
    /**
     * Delete session usage file (when workspace is deleted).
     */
    async deleteSessionUsage(workspaceId) {
        return this.fileLocks.withLock(workspaceId, async () => {
            try {
                await fs.unlink(this.getFilePath(workspaceId));
            }
            catch (error) {
                if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                    throw error;
                }
            }
        });
    }
}
exports.SessionUsageService = SessionUsageService;
//# sourceMappingURL=sessionUsageService.js.map