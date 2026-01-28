"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const initHook_1 = require("./initHook");
(0, bun_test_1.describe)("LineBuffer", () => {
    (0, bun_test_1.it)("should buffer incomplete lines", () => {
        const lines = [];
        const buffer = new initHook_1.LineBuffer((line) => lines.push(line));
        buffer.append("hello ");
        (0, bun_test_1.expect)(lines).toEqual([]);
        buffer.append("world\n");
        (0, bun_test_1.expect)(lines).toEqual(["hello world"]);
    });
    (0, bun_test_1.it)("should handle multiple lines in one chunk", () => {
        const lines = [];
        const buffer = new initHook_1.LineBuffer((line) => lines.push(line));
        buffer.append("line1\nline2\nline3\n");
        (0, bun_test_1.expect)(lines).toEqual(["line1", "line2", "line3"]);
    });
    (0, bun_test_1.it)("should handle incomplete line at end", () => {
        const lines = [];
        const buffer = new initHook_1.LineBuffer((line) => lines.push(line));
        buffer.append("line1\nline2\nincomplete");
        (0, bun_test_1.expect)(lines).toEqual(["line1", "line2"]);
        buffer.flush();
        (0, bun_test_1.expect)(lines).toEqual(["line1", "line2", "incomplete"]);
    });
    (0, bun_test_1.it)("should skip empty lines", () => {
        const lines = [];
        const buffer = new initHook_1.LineBuffer((line) => lines.push(line));
        buffer.append("\nline1\n\nline2\n\n");
        (0, bun_test_1.expect)(lines).toEqual(["line1", "line2"]);
    });
    (0, bun_test_1.it)("should handle flush with no buffered data", () => {
        const lines = [];
        const buffer = new initHook_1.LineBuffer((line) => lines.push(line));
        buffer.append("line1\n");
        (0, bun_test_1.expect)(lines).toEqual(["line1"]);
        buffer.flush();
        (0, bun_test_1.expect)(lines).toEqual(["line1"]); // No change
    });
});
// getUnixEnv tests are placed here because initHook.ts owns the implementation.
(0, bun_test_1.describe)("createLineBufferedLoggers", () => {
    (0, bun_test_1.it)("should create separate buffers for stdout and stderr", () => {
        const stdoutLines = [];
        const stderrLines = [];
        const mockLogger = {
            logStep: () => {
                /* no-op for test */
            },
            logStdout: (line) => stdoutLines.push(line),
            logStderr: (line) => stderrLines.push(line),
            logComplete: () => {
                /* no-op for test */
            },
        };
        const loggers = (0, initHook_1.createLineBufferedLoggers)(mockLogger);
        loggers.stdout.append("out1\nout2\n");
        loggers.stderr.append("err1\nerr2\n");
        (0, bun_test_1.expect)(stdoutLines).toEqual(["out1", "out2"]);
        (0, bun_test_1.expect)(stderrLines).toEqual(["err1", "err2"]);
    });
    (0, bun_test_1.it)("should handle incomplete lines and flush separately", () => {
        const stdoutLines = [];
        const stderrLines = [];
        const mockLogger = {
            logStep: () => {
                /* no-op for test */
            },
            logStdout: (line) => stdoutLines.push(line),
            logStderr: (line) => stderrLines.push(line),
            logComplete: () => {
                /* no-op for test */
            },
        };
        const loggers = (0, initHook_1.createLineBufferedLoggers)(mockLogger);
        loggers.stdout.append("incomplete");
        loggers.stderr.append("also incomplete");
        (0, bun_test_1.expect)(stdoutLines).toEqual([]);
        (0, bun_test_1.expect)(stderrLines).toEqual([]);
        loggers.stdout.flush();
        (0, bun_test_1.expect)(stdoutLines).toEqual(["incomplete"]);
        (0, bun_test_1.expect)(stderrLines).toEqual([]); // stderr not flushed yet
        loggers.stderr.flush();
        (0, bun_test_1.expect)(stderrLines).toEqual(["also incomplete"]);
    });
});
(0, bun_test_1.describe)("getUnixEnv", () => {
    (0, bun_test_1.it)("should include base UNIX_ environment variables", () => {
        const env = (0, initHook_1.getUnixEnv)("/path/to/project", "worktree", "feature-branch");
        (0, bun_test_1.expect)(env.UNIX_PROJECT_PATH).toBe("/path/to/project");
        (0, bun_test_1.expect)(env.UNIX_RUNTIME).toBe("worktree");
        (0, bun_test_1.expect)(env.UNIX_WORKSPACE_NAME).toBe("feature-branch");
        (0, bun_test_1.expect)(env.UNIX_MODEL_STRING).toBeUndefined();
        (0, bun_test_1.expect)(env.UNIX_THINKING_LEVEL).toBeUndefined();
        (0, bun_test_1.expect)(env.UNIX_COSTS_USD).toBeUndefined();
    });
    (0, bun_test_1.it)("should include model + thinking env vars when provided", () => {
        const env = (0, initHook_1.getUnixEnv)("/path/to/project", "worktree", "feature-branch", {
            modelString: "openai:gpt-5.2-pro",
            thinkingLevel: "medium",
        });
        (0, bun_test_1.expect)(env.UNIX_MODEL_STRING).toBe("openai:gpt-5.2-pro");
        (0, bun_test_1.expect)(env.UNIX_THINKING_LEVEL).toBe("medium");
    });
    (0, bun_test_1.it)("should allow explicit thinkingLevel=off", () => {
        const env = (0, initHook_1.getUnixEnv)("/path/to/project", "local", "main", {
            modelString: "anthropic:claude-3-5-sonnet",
            thinkingLevel: "off",
        });
        (0, bun_test_1.expect)(env.UNIX_MODEL_STRING).toBe("anthropic:claude-3-5-sonnet");
        (0, bun_test_1.expect)(env.UNIX_THINKING_LEVEL).toBe("off");
    });
    (0, bun_test_1.it)("should include UNIX_COSTS_USD when costsUsd is provided", () => {
        const env = (0, initHook_1.getUnixEnv)("/path/to/project", "worktree", "feature-branch", {
            modelString: "anthropic:claude-opus-4-5",
            thinkingLevel: "high",
            costsUsd: 1.2345,
        });
        (0, bun_test_1.expect)(env.UNIX_COSTS_USD).toBe("1.23");
    });
    (0, bun_test_1.it)("should include UNIX_COSTS_USD=0.00 when costsUsd is 0", () => {
        const env = (0, initHook_1.getUnixEnv)("/path/to/project", "worktree", "main", {
            costsUsd: 0,
        });
        (0, bun_test_1.expect)(env.UNIX_COSTS_USD).toBe("0.00");
    });
    (0, bun_test_1.it)("should not include UNIX_COSTS_USD when costsUsd is undefined", () => {
        const env = (0, initHook_1.getUnixEnv)("/path/to/project", "worktree", "main", {
            modelString: "openai:gpt-4",
        });
        (0, bun_test_1.expect)(env.UNIX_COSTS_USD).toBeUndefined();
    });
});
//# sourceMappingURL=initHook.test.js.map