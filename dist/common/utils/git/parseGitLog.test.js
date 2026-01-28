"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const parseGitLog_1 = require("./parseGitLog");
(0, bun_test_1.describe)("parseGitShowBranch", () => {
    (0, bun_test_1.test)("should preserve indicator positions for three-way divergence", () => {
        // Real output from ci-codex workspace showing HEAD (ci-codex), origin/ci-codex, and origin/main
        // Order: HEAD, origin/<branch>, origin/main
        const output = `! [HEAD] 🤖 Trigger CI after resolving Codex comments
 ! [origin/ci-codex] 🤖 Trigger CI after resolving Codex comments
  ! [origin/main] fix: improve compaction
---
  + [9050a56] fix: improve compaction
  + [dad16a3] feat: change interrupt stream keybind to Ctrl+C
  + [5006273] 🤖 Add CI job to block merge on unresolved Codex comments (#76)
++  [027552c] 🤖 Trigger CI after resolving Codex comments
++  [2fe99bf] 🤖 Fix: Check resolved status for Codex review comments
++  [34f3c52] 🤖 Add CI job to block merge on unresolved Codex comments
+++ [9543f22] 🤖 Fix: Restore base64: prefix for CSC_LINK (#75)`;
        const dateMap = new Map([
            ["9050a56", "Oct 07 02:16 PM"],
            ["dad16a3", "Oct 06 11:22 PM"],
            ["5006273", "Oct 06 04:49 PM"],
            ["027552c", "Oct 07 01:16 PM"],
            ["2fe99bf", "Oct 07 12:49 PM"],
            ["34f3c52", "Oct 07 12:22 PM"],
            ["9543f22", "Oct 06 08:49 PM"],
        ]);
        const result = (0, parseGitLog_1.parseGitShowBranch)(output, dateMap);
        // Verify headers
        (0, bun_test_1.expect)(result.headers).toHaveLength(3);
        (0, bun_test_1.expect)(result.headers[0]).toEqual({ branch: "HEAD", columnIndex: 0 });
        (0, bun_test_1.expect)(result.headers[1]).toEqual({ branch: "origin/ci-codex", columnIndex: 1 });
        (0, bun_test_1.expect)(result.headers[2]).toEqual({ branch: "origin/main", columnIndex: 2 });
        // Verify commits
        (0, bun_test_1.expect)(result.commits).toHaveLength(7);
        // First commit: "  +" - only on origin/main (column 2)
        (0, bun_test_1.expect)(result.commits[0].indicators).toBe("  +");
        (0, bun_test_1.expect)(result.commits[0].indicators.length).toBe(3);
        (0, bun_test_1.expect)(result.commits[0].indicators[0]).toBe(" "); // Not on HEAD
        (0, bun_test_1.expect)(result.commits[0].indicators[1]).toBe(" "); // Not on origin/ci-codex
        (0, bun_test_1.expect)(result.commits[0].indicators[2]).toBe("+"); // On origin/main
        (0, bun_test_1.expect)(result.commits[0].hash).toBe("9050a56");
        // Fourth commit: "++  " - on HEAD and origin/ci-codex (columns 0 and 1)
        (0, bun_test_1.expect)(result.commits[3].indicators).toBe("++ ");
        (0, bun_test_1.expect)(result.commits[3].indicators.length).toBe(3);
        (0, bun_test_1.expect)(result.commits[3].indicators[0]).toBe("+"); // On HEAD
        (0, bun_test_1.expect)(result.commits[3].indicators[1]).toBe("+"); // On origin/ci-codex
        (0, bun_test_1.expect)(result.commits[3].indicators[2]).toBe(" "); // Not on origin/main
        (0, bun_test_1.expect)(result.commits[3].hash).toBe("027552c");
        // Last commit: "+++" - on all three branches
        (0, bun_test_1.expect)(result.commits[6].indicators).toBe("+++");
        (0, bun_test_1.expect)(result.commits[6].indicators.length).toBe(3);
        (0, bun_test_1.expect)(result.commits[6].indicators[0]).toBe("+"); // On HEAD
        (0, bun_test_1.expect)(result.commits[6].indicators[1]).toBe("+"); // On origin/ci-codex
        (0, bun_test_1.expect)(result.commits[6].indicators[2]).toBe("+"); // On origin/main
        (0, bun_test_1.expect)(result.commits[6].hash).toBe("9543f22");
    });
    (0, bun_test_1.test)("should handle two-branch divergence", () => {
        const output = `! [HEAD] Latest on HEAD
 ! [origin/main] Latest on main
--
 + [abc1234] Only on main
+  [def5678] Only on HEAD
++ [012abcd] On both`;
        const dateMap = new Map();
        const result = (0, parseGitLog_1.parseGitShowBranch)(output, dateMap);
        (0, bun_test_1.expect)(result.headers).toHaveLength(2);
        (0, bun_test_1.expect)(result.commits).toHaveLength(3);
        // Indicators should be exactly 2 characters
        (0, bun_test_1.expect)(result.commits[0].indicators).toBe(" +");
        (0, bun_test_1.expect)(result.commits[1].indicators).toBe("+ ");
        (0, bun_test_1.expect)(result.commits[2].indicators).toBe("++");
    });
    (0, bun_test_1.test)("should handle empty output", () => {
        const result = (0, parseGitLog_1.parseGitShowBranch)("", new Map());
        (0, bun_test_1.expect)(result.headers).toHaveLength(0);
        (0, bun_test_1.expect)(result.commits).toHaveLength(0);
    });
});
//# sourceMappingURL=parseGitLog.test.js.map