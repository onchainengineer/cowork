"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const os_1 = require("os");
const bashCompactionPolicy_1 = require("./bashCompactionPolicy");
(0, bun_test_1.describe)("bashCompactionPolicy", () => {
    (0, bun_test_1.describe)("isBashOutputAlreadyTargeted", () => {
        (0, bun_test_1.it)("detects common output-slicing commands", () => {
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("sudo head -n 1 some.log")).toBe(true);
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("rg foo . | head -n 50")).toBe(true);
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("tail -n 100 some.log")).toBe(true);
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("sed -n '1,200p' file.txt")).toBe(true);
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("awk 'NR>=10 && NR<=20 {print}' file.txt")).toBe(true);
        });
        (0, bun_test_1.it)("returns false for non-targeted scripts", () => {
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("ls -la")).toBe(false);
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("rg foo .")).toBe(false);
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.isBashOutputAlreadyTargeted)("git rev-parse HEAD")).toBe(false);
        });
    });
    (0, bun_test_1.describe)("classifyBashIntent", () => {
        (0, bun_test_1.it)("classifies exploration via display name keywords", () => {
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "echo hi", displayName: "List files" })).toBe("exploration");
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "echo hi", displayName: "Search repo" })).toBe("exploration");
        });
        (0, bun_test_1.it)("classifies exploration via common commands", () => {
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "ls -la" })).toBe("exploration");
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "git status --porcelain" })).toBe("exploration");
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "find . -maxdepth 2 -type f" })).toBe("exploration");
        });
        (0, bun_test_1.it)("classifies logs for build/test commands", () => {
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "make test" })).toBe("logs");
            (0, bun_test_1.expect)((0, bashCompactionPolicy_1.classifyBashIntent)({ script: "bun test" })).toBe("logs");
        });
    });
    (0, bun_test_1.describe)("decideBashOutputCompaction", () => {
        (0, bun_test_1.it)("skips when output is below configured thresholds", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "ls",
                totalLines: 5,
                totalBytes: 1_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(false);
            (0, bun_test_1.expect)(decision.skipReason).toBe("below_threshold");
            (0, bun_test_1.expect)(decision.triggeredByLines).toBe(false);
            (0, bun_test_1.expect)(decision.triggeredByBytes).toBe(false);
        });
        (0, bun_test_1.it)("skips compaction for already-targeted scripts", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "rg foo . | head -n 50",
                totalLines: 200,
                totalBytes: 10_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(false);
            (0, bun_test_1.expect)(decision.skipReason).toBe("already_targeted_script");
        });
        (0, bun_test_1.it)("skips compaction when script reads the configured plan file", () => {
            const planFilePath = "~/.unix/plans/my-project/my-workspace.md";
            const scripts = [
                `cat ${planFilePath}`,
                `bat ${planFilePath}`,
                `python -c "print(open('${planFilePath}').read())"`,
            ];
            for (const script of scripts) {
                const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                    toolName: "bash",
                    script,
                    planFilePath,
                    totalLines: 200,
                    totalBytes: 10_000,
                    minLines: 10,
                    minTotalBytes: 4 * 1024,
                    maxKeptLines: 40,
                });
                (0, bun_test_1.expect)(decision.shouldCompact).toBe(false);
                (0, bun_test_1.expect)(decision.skipReason).toBe("plan_file_in_script");
            }
        });
        (0, bun_test_1.it)("skips compaction when script and planFilePath use different home path forms", () => {
            const homePosix = (0, os_1.homedir)().replaceAll("\\\\", "/");
            const tildePlanFilePath = "~/.unix/plans/my-project/my-workspace.md";
            const expandedPlanFilePath = `${homePosix}/.unix/plans/my-project/my-workspace.md`;
            const tildeDecision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: `cat ${tildePlanFilePath}`,
                planFilePath: expandedPlanFilePath,
                totalLines: 200,
                totalBytes: 10_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(tildeDecision.shouldCompact).toBe(false);
            (0, bun_test_1.expect)(tildeDecision.skipReason).toBe("plan_file_in_script");
            const expandedDecision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: `cat ${expandedPlanFilePath}`,
                planFilePath: tildePlanFilePath,
                totalLines: 200,
                totalBytes: 10_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(expandedDecision.shouldCompact).toBe(false);
            (0, bun_test_1.expect)(expandedDecision.skipReason).toBe("plan_file_in_script");
        });
        (0, bun_test_1.it)("keeps default compaction behavior for non-plan file scripts", () => {
            const planFilePath = "~/.unix/plans/my-project/my-workspace.md";
            const scripts = ["cat ./stdout.log", "cat file | rg needle"];
            for (const script of scripts) {
                const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                    toolName: "bash",
                    script,
                    planFilePath,
                    totalLines: 200,
                    totalBytes: 10_000,
                    minLines: 10,
                    minTotalBytes: 4 * 1024,
                    maxKeptLines: 40,
                });
                (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
                (0, bun_test_1.expect)(decision.skipReason).toBeUndefined();
            }
        });
        (0, bun_test_1.it)("skips compaction for small exploration output", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "ls",
                totalLines: 50,
                totalBytes: 8_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.intent).toBe("exploration");
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(false);
            (0, bun_test_1.expect)(decision.skipReason).toBe("exploration_output_small");
        });
        (0, bun_test_1.it)("skips compaction for conflict-marker searches when output is within tool limits", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: 'rg "<<<<<<<|=======|>>>>>>>" .',
                totalLines: 150,
                totalBytes: 10_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(false);
            (0, bun_test_1.expect)(decision.skipReason).toBe("conflict_marker_search_within_limits");
        });
        (0, bun_test_1.it)("boosts maxKeptLines for conflict-marker searches when output exceeds tool limits", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: 'rg "<<<<<<<|=======|>>>>>>>" .',
                totalLines: 400,
                totalBytes: 20_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
            (0, bun_test_1.expect)(decision.skipReason).toBeUndefined();
            (0, bun_test_1.expect)(decision.effectiveMaxKeptLines).toBe(300);
        });
        (0, bun_test_1.it)("respects user maxKeptLines for small exploration output", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "ls",
                totalLines: 50,
                totalBytes: 8_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 20,
            });
            (0, bun_test_1.expect)(decision.intent).toBe("exploration");
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
            (0, bun_test_1.expect)(decision.skipReason).toBeUndefined();
            (0, bun_test_1.expect)(decision.effectiveMaxKeptLines).toBe(20);
        });
        (0, bun_test_1.it)("respects user thresholds for small exploration output", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "ls",
                totalLines: 50,
                totalBytes: 8_000,
                minLines: 0,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.intent).toBe("exploration");
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
            (0, bun_test_1.expect)(decision.skipReason).toBeUndefined();
            (0, bun_test_1.expect)(decision.effectiveMaxKeptLines).toBe(40);
        });
        (0, bun_test_1.it)("does not boost maxKeptLines when thresholds are user-set", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "find . -type f",
                totalLines: 200,
                totalBytes: 14_000,
                minLines: 0,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.intent).toBe("exploration");
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
            (0, bun_test_1.expect)(decision.skipReason).toBeUndefined();
            (0, bun_test_1.expect)(decision.effectiveMaxKeptLines).toBe(40);
        });
        (0, bun_test_1.it)("boosts maxKeptLines for large exploration output when using the default budget", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "find . -type f",
                totalLines: 200,
                totalBytes: 14_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.intent).toBe("exploration");
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
            (0, bun_test_1.expect)(decision.effectiveMaxKeptLines).toBe(120);
        });
        (0, bun_test_1.it)("keeps default behavior for logs", () => {
            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                toolName: "bash",
                script: "make test",
                totalLines: 200,
                totalBytes: 14_000,
                minLines: 10,
                minTotalBytes: 4 * 1024,
                maxKeptLines: 40,
            });
            (0, bun_test_1.expect)(decision.intent).toBe("logs");
            (0, bun_test_1.expect)(decision.shouldCompact).toBe(true);
            (0, bun_test_1.expect)(decision.effectiveMaxKeptLines).toBe(40);
        });
    });
});
//# sourceMappingURL=bashCompactionPolicy.test.js.map