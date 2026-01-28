"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const tasks_1 = require("./tasks");
(0, bun_test_1.describe)("normalizeTaskSettings", () => {
    (0, bun_test_1.test)("fills defaults when missing", () => {
        (0, bun_test_1.expect)((0, tasks_1.normalizeTaskSettings)(undefined)).toEqual(tasks_1.DEFAULT_TASK_SETTINGS);
        (0, bun_test_1.expect)((0, tasks_1.normalizeTaskSettings)({})).toEqual(tasks_1.DEFAULT_TASK_SETTINGS);
    });
    (0, bun_test_1.test)("clamps values into valid ranges", () => {
        const normalized = (0, tasks_1.normalizeTaskSettings)({
            maxParallelAgentTasks: 999,
            maxTaskNestingDepth: 0,
            bashOutputCompactionMinLines: -1,
            bashOutputCompactionMinTotalBytes: 999999999999,
            bashOutputCompactionMaxKeptLines: 0,
            bashOutputCompactionTimeoutMs: 0,
        });
        (0, bun_test_1.expect)(normalized.maxParallelAgentTasks).toBe(tasks_1.TASK_SETTINGS_LIMITS.maxParallelAgentTasks.max);
        (0, bun_test_1.expect)(normalized.maxTaskNestingDepth).toBe(tasks_1.TASK_SETTINGS_LIMITS.maxTaskNestingDepth.min);
        (0, bun_test_1.expect)(normalized.bashOutputCompactionMinLines).toBe(tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinLines.min);
        (0, bun_test_1.expect)(normalized.bashOutputCompactionMinTotalBytes).toBe(tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinTotalBytes.max);
        (0, bun_test_1.expect)(normalized.bashOutputCompactionMaxKeptLines).toBe(tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.min);
        (0, bun_test_1.expect)(normalized.bashOutputCompactionTimeoutMs).toBe(tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionTimeoutMs.min);
    });
    (0, bun_test_1.test)("uses fallbacks for NaN", () => {
        const normalized = (0, tasks_1.normalizeTaskSettings)({
            maxParallelAgentTasks: Number.NaN,
            maxTaskNestingDepth: Number.NaN,
            bashOutputCompactionMinLines: Number.NaN,
            bashOutputCompactionMinTotalBytes: Number.NaN,
            bashOutputCompactionMaxKeptLines: Number.NaN,
            bashOutputCompactionTimeoutMs: Number.NaN,
        });
        (0, bun_test_1.expect)(normalized).toEqual(tasks_1.DEFAULT_TASK_SETTINGS);
    });
});
//# sourceMappingURL=tasks.test.js.map