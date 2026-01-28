"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TASK_SETTINGS = exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS = exports.TASK_SETTINGS_LIMITS = void 0;
exports.normalizeSubagentAiDefaults = normalizeSubagentAiDefaults;
exports.normalizeTaskSettings = normalizeTaskSettings;
const assert_1 = __importDefault(require("../../common/utils/assert"));
const thinking_1 = require("./thinking");
exports.TASK_SETTINGS_LIMITS = {
    maxParallelAgentTasks: { min: 1, max: 10, default: 3 },
    maxTaskNestingDepth: { min: 1, max: 5, default: 3 },
};
exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS = {
    bashOutputCompactionMinLines: { min: 0, max: 1_000, default: 10 },
    bashOutputCompactionMinTotalBytes: { min: 0, max: 16 * 1024, default: 4 * 1024 },
    bashOutputCompactionMaxKeptLines: { min: 1, max: 1_000, default: 40 },
    bashOutputCompactionTimeoutMs: { min: 1_000, max: 120_000, default: 5_000 },
};
exports.DEFAULT_TASK_SETTINGS = {
    maxParallelAgentTasks: exports.TASK_SETTINGS_LIMITS.maxParallelAgentTasks.default,
    maxTaskNestingDepth: exports.TASK_SETTINGS_LIMITS.maxTaskNestingDepth.default,
    proposePlanImplementReplacesChatHistory: false,
    bashOutputCompactionMinLines: exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinLines.default,
    bashOutputCompactionMinTotalBytes: exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinTotalBytes.default,
    bashOutputCompactionMaxKeptLines: exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.default,
    bashOutputCompactionTimeoutMs: exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionTimeoutMs.default,
    bashOutputCompactionHeuristicFallback: true,
};
function normalizeSubagentAiDefaults(raw) {
    const record = raw && typeof raw === "object" ? raw : {};
    const result = {};
    for (const [agentTypeRaw, entryRaw] of Object.entries(record)) {
        const agentType = agentTypeRaw.trim().toLowerCase();
        if (!agentType)
            continue;
        if (agentType === "exec")
            continue;
        if (!entryRaw || typeof entryRaw !== "object")
            continue;
        const entry = entryRaw;
        const modelString = typeof entry.modelString === "string" && entry.modelString.trim().length > 0
            ? entry.modelString.trim()
            : undefined;
        const thinkingLevel = (0, thinking_1.coerceThinkingLevel)(entry.thinkingLevel);
        if (!modelString && !thinkingLevel) {
            continue;
        }
        result[agentType] = { modelString, thinkingLevel };
    }
    return result;
}
function clampInt(value, fallback, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    const rounded = Math.floor(value);
    if (rounded < min)
        return min;
    if (rounded > max)
        return max;
    return rounded;
}
function normalizeTaskSettings(raw) {
    const record = raw && typeof raw === "object" ? raw : {};
    const maxParallelAgentTasks = clampInt(record.maxParallelAgentTasks, exports.DEFAULT_TASK_SETTINGS.maxParallelAgentTasks, exports.TASK_SETTINGS_LIMITS.maxParallelAgentTasks.min, exports.TASK_SETTINGS_LIMITS.maxParallelAgentTasks.max);
    const maxTaskNestingDepth = clampInt(record.maxTaskNestingDepth, exports.DEFAULT_TASK_SETTINGS.maxTaskNestingDepth, exports.TASK_SETTINGS_LIMITS.maxTaskNestingDepth.min, exports.TASK_SETTINGS_LIMITS.maxTaskNestingDepth.max);
    const proposePlanImplementReplacesChatHistory = typeof record.proposePlanImplementReplacesChatHistory === "boolean"
        ? record.proposePlanImplementReplacesChatHistory
        : (exports.DEFAULT_TASK_SETTINGS.proposePlanImplementReplacesChatHistory ?? false);
    const bashOutputCompactionMinLines = clampInt(record.bashOutputCompactionMinLines, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinLines.default, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinLines.min, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinLines.max);
    const bashOutputCompactionMinTotalBytes = clampInt(record.bashOutputCompactionMinTotalBytes, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinTotalBytes.default, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinTotalBytes.min, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinTotalBytes.max);
    const bashOutputCompactionMaxKeptLines = clampInt(record.bashOutputCompactionMaxKeptLines, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.default, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.min, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.max);
    const bashOutputCompactionTimeoutMsRaw = clampInt(record.bashOutputCompactionTimeoutMs, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionTimeoutMs.default, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionTimeoutMs.min, exports.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionTimeoutMs.max);
    const bashOutputCompactionHeuristicFallback = typeof record.bashOutputCompactionHeuristicFallback === "boolean"
        ? record.bashOutputCompactionHeuristicFallback
        : (exports.DEFAULT_TASK_SETTINGS.bashOutputCompactionHeuristicFallback ?? true);
    const bashOutputCompactionTimeoutMs = Math.floor(bashOutputCompactionTimeoutMsRaw / 1000) * 1000;
    const result = {
        maxParallelAgentTasks,
        maxTaskNestingDepth,
        proposePlanImplementReplacesChatHistory,
        bashOutputCompactionMinLines,
        bashOutputCompactionMinTotalBytes,
        bashOutputCompactionMaxKeptLines,
        bashOutputCompactionTimeoutMs,
        bashOutputCompactionHeuristicFallback,
    };
    (0, assert_1.default)(Number.isInteger(maxParallelAgentTasks), "normalizeTaskSettings: maxParallelAgentTasks must be an integer");
    (0, assert_1.default)(Number.isInteger(maxTaskNestingDepth), "normalizeTaskSettings: maxTaskNestingDepth must be an integer");
    (0, assert_1.default)(typeof proposePlanImplementReplacesChatHistory === "boolean", "normalizeTaskSettings: proposePlanImplementReplacesChatHistory must be a boolean");
    (0, assert_1.default)(Number.isInteger(bashOutputCompactionMinLines), "normalizeTaskSettings: bashOutputCompactionMinLines must be an integer");
    (0, assert_1.default)(Number.isInteger(bashOutputCompactionMinTotalBytes), "normalizeTaskSettings: bashOutputCompactionMinTotalBytes must be an integer");
    (0, assert_1.default)(Number.isInteger(bashOutputCompactionMaxKeptLines), "normalizeTaskSettings: bashOutputCompactionMaxKeptLines must be an integer");
    (0, assert_1.default)(Number.isInteger(bashOutputCompactionTimeoutMs), "normalizeTaskSettings: bashOutputCompactionTimeoutMs must be an integer");
    (0, assert_1.default)(typeof bashOutputCompactionHeuristicFallback === "boolean", "normalizeTaskSettings: bashOutputCompactionHeuristicFallback must be a boolean");
    (0, assert_1.default)(bashOutputCompactionTimeoutMs % 1000 === 0, "normalizeTaskSettings: bashOutputCompactionTimeoutMs must be a whole number of seconds");
    return result;
}
//# sourceMappingURL=tasks.js.map