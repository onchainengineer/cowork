"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const bashTaskReport_1 = require("./bashTaskReport");
(0, bun_test_1.describe)("bashTaskReport", () => {
    (0, bun_test_1.it)("roundtrips a bash output report with output", () => {
        const report = (0, bashTaskReport_1.formatBashOutputReport)({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "line1\nline2\n",
        });
        (0, bun_test_1.expect)(report).toContain("### Bash task: proc_123");
        (0, bun_test_1.expect)(report).toContain("status: exited");
        (0, bun_test_1.expect)(report).toContain("exitCode: 0");
        (0, bun_test_1.expect)(report).toContain("```text");
        const parsed = (0, bashTaskReport_1.tryParseBashOutputReport)(report);
        (0, bun_test_1.expect)(parsed).toEqual({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "line1\nline2",
        });
    });
    (0, bun_test_1.it)("does not parse status/exitCode from the output block", () => {
        const report = (0, bashTaskReport_1.formatBashOutputReport)({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "status: ok\nexitCode: 1\n",
        });
        (0, bun_test_1.expect)((0, bashTaskReport_1.tryParseBashOutputReport)(report)).toEqual({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "status: ok\nexitCode: 1",
        });
    });
    (0, bun_test_1.it)("roundtrips output that contains a literal ``` fence line", () => {
        const report = (0, bashTaskReport_1.formatBashOutputReport)({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "before\n```\nafter\n",
        });
        // Ensure we picked a fence that can't be terminated by a literal ``` output line.
        (0, bun_test_1.expect)(report).toContain("````text");
        const parsed = (0, bashTaskReport_1.tryParseBashOutputReport)(report);
        (0, bun_test_1.expect)(parsed?.output).toBe("before\n```\nafter");
    });
    (0, bun_test_1.it)("parses legacy reports where output contains a literal ``` fence line", () => {
        const legacy = [
            "### Bash task: proc_123",
            "",
            "status: exited",
            "exitCode: 0",
            "",
            "```text",
            "before",
            "```",
            "after",
            "```",
        ].join("\n");
        (0, bun_test_1.expect)((0, bashTaskReport_1.tryParseBashOutputReport)(legacy)).toEqual({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "before\n```\nafter",
        });
    });
    (0, bun_test_1.it)("roundtrips a bash output report with no output", () => {
        const report = (0, bashTaskReport_1.formatBashOutputReport)({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "",
        });
        (0, bun_test_1.expect)(report).toContain("### Bash task: proc_123");
        (0, bun_test_1.expect)(report).toContain("status: exited");
        (0, bun_test_1.expect)(report).toContain("exitCode: 0");
        (0, bun_test_1.expect)(report).not.toContain("```text");
        const parsed = (0, bashTaskReport_1.tryParseBashOutputReport)(report);
        (0, bun_test_1.expect)(parsed).toEqual({
            processId: "proc_123",
            status: "exited",
            exitCode: 0,
            output: "",
        });
    });
    (0, bun_test_1.it)("returns undefined for non-bash markdown", () => {
        (0, bun_test_1.expect)((0, bashTaskReport_1.tryParseBashOutputReport)("### Not bash\nstatus: exited")).toBeUndefined();
    });
});
//# sourceMappingURL=bashTaskReport.test.js.map