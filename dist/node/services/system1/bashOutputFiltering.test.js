"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const bashOutputFiltering_1 = require("./bashOutputFiltering");
(0, bun_test_1.describe)("bashOutputFiltering", () => {
    (0, bun_test_1.describe)("splitBashOutputLines", () => {
        (0, bun_test_1.it)("returns [] for empty output", () => {
            (0, bun_test_1.expect)((0, bashOutputFiltering_1.splitBashOutputLines)("")).toEqual([]);
        });
        (0, bun_test_1.it)("splits on newlines", () => {
            (0, bun_test_1.expect)((0, bashOutputFiltering_1.splitBashOutputLines)("a\nb\nc")).toEqual(["a", "b", "c"]);
        });
    });
    (0, bun_test_1.describe)("formatNumberedLinesForSystem1", () => {
        (0, bun_test_1.it)("adds 1-based line numbers", () => {
            (0, bun_test_1.expect)((0, bashOutputFiltering_1.formatNumberedLinesForSystem1)(["a", "b"]).split("\n")).toEqual(["0001| a", "0002| b"]);
        });
    });
    (0, bun_test_1.describe)("formatSystem1BashFilterNotice", () => {
        (0, bun_test_1.it)("includes a cleanup warning when fullOutputPath is present", () => {
            const notice = (0, bashOutputFiltering_1.formatSystem1BashFilterNotice)({
                keptLines: 1,
                totalLines: 2,
                trigger: "lines",
                fullOutputPath: "/tmp/bash-s1.txt",
            });
            (0, bun_test_1.expect)(notice).toContain("Full output saved to /tmp/bash-s1.txt");
            (0, bun_test_1.expect)(notice).toContain("automatically cleaned up");
            (0, bun_test_1.expect)(notice).toContain("may already be gone");
        });
        (0, bun_test_1.it)("omits the full output path when fullOutputPath is missing", () => {
            const notice = (0, bashOutputFiltering_1.formatSystem1BashFilterNotice)({
                keptLines: 1,
                totalLines: 2,
                trigger: "bytes",
            });
            (0, bun_test_1.expect)(notice).toBe("Auto-filtered output: kept 1/2 lines (trigger: bytes).");
        });
    });
    (0, bun_test_1.describe)("getHeuristicKeepRangesForBashOutput", () => {
        (0, bun_test_1.it)("keeps error context and respects maxKeptLines", () => {
            const rawOutput = [
                "starting...",
                "step 1 ok",
                "ERROR: expected X, got Y",
                "  at path/to/file.ts:12:3",
                "done",
            ].join("\n");
            const lines = (0, bashOutputFiltering_1.splitBashOutputLines)(rawOutput);
            const keepRanges = (0, bashOutputFiltering_1.getHeuristicKeepRangesForBashOutput)({
                lines,
                maxKeptLines: 3,
            });
            const applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                rawOutput,
                keepRanges,
                maxKeptLines: 3,
            });
            (0, bun_test_1.expect)(applied).toBeDefined();
            (0, bun_test_1.expect)(applied?.keptLines).toBeLessThanOrEqual(3);
            (0, bun_test_1.expect)(applied?.filteredOutput).toContain("ERROR:");
        });
        (0, bun_test_1.it)("treats git conflict markers as important lines", () => {
            const rawOutput = [
                "start",
                "src/foo.ts:1:<<<<<<< HEAD",
                "src/foo.ts:2:=======",
                "src/foo.ts:3:>>>>>>> main",
                "end",
            ].join("\n");
            const lines = (0, bashOutputFiltering_1.splitBashOutputLines)(rawOutput);
            const keepRanges = (0, bashOutputFiltering_1.getHeuristicKeepRangesForBashOutput)({
                lines,
                maxKeptLines: 10,
            });
            const applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                rawOutput,
                keepRanges,
                maxKeptLines: 10,
            });
            (0, bun_test_1.expect)(applied).toBeDefined();
            (0, bun_test_1.expect)(applied?.filteredOutput).toContain("<<<<<<<");
            (0, bun_test_1.expect)(applied?.filteredOutput).toContain("=======");
            (0, bun_test_1.expect)(applied?.filteredOutput).toContain(">>>>>>>");
        });
    });
    (0, bun_test_1.describe)("applySystem1KeepRangesToOutput", () => {
        (0, bun_test_1.it)("returns undefined when keep ranges are empty", () => {
            const applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                rawOutput: "a\nb\nc",
                keepRanges: [],
                maxKeptLines: 10,
            });
            (0, bun_test_1.expect)(applied).toBeUndefined();
        });
        (0, bun_test_1.it)("clamps and swaps out-of-order ranges", () => {
            const applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                rawOutput: "a\nb\nc\nd\ne",
                keepRanges: [{ start: 10, end: 2 }],
                maxKeptLines: 10,
            });
            (0, bun_test_1.expect)(applied).toEqual({
                filteredOutput: "b\nc\nd\ne",
                keptLines: 4,
                totalLines: 5,
            });
        });
        (0, bun_test_1.it)("merges overlapping ranges and enforces maxKeptLines", () => {
            const applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                rawOutput: "a\nb\nc\nd\ne\nf",
                keepRanges: [
                    { start: 2, end: 4 },
                    { start: 4, end: 6 },
                ],
                maxKeptLines: 3,
            });
            (0, bun_test_1.expect)(applied).toEqual({
                filteredOutput: "b\nc\nd",
                keptLines: 3,
                totalLines: 6,
            });
            // Subset-only guarantee: every kept line must exist in the original output.
            const rawLines = (0, bashOutputFiltering_1.splitBashOutputLines)("a\nb\nc\nd\ne\nf");
            const keptLines = (0, bashOutputFiltering_1.splitBashOutputLines)(applied.filteredOutput);
            for (const line of keptLines) {
                (0, bun_test_1.expect)(rawLines.includes(line)).toBe(true);
            }
        });
    });
});
//# sourceMappingURL=bashOutputFiltering.test.js.map