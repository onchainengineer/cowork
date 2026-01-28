"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const devcontainerCli_1 = require("./devcontainerCli");
(0, bun_test_1.describe)("parseDevcontainerStdoutLine", () => {
    (0, bun_test_1.it)("parses JSON log lines with text", () => {
        const line = JSON.stringify({ type: "text", level: 3, text: "Building..." });
        (0, bun_test_1.expect)((0, devcontainerCli_1.parseDevcontainerStdoutLine)(line)).toEqual({
            kind: "log",
            text: "Building...",
        });
    });
    (0, bun_test_1.it)("parses progress lines with name and status", () => {
        const line = JSON.stringify({
            type: "progress",
            name: "Running postCreateCommand...",
            status: "succeeded",
            channel: "postCreate",
        });
        (0, bun_test_1.expect)((0, devcontainerCli_1.parseDevcontainerStdoutLine)(line)).toEqual({
            kind: "log",
            text: "Running postCreateCommand...",
        });
    });
    (0, bun_test_1.it)("parses error channel text below level 2", () => {
        const line = JSON.stringify({ type: "text", level: 1, text: "Oops", channel: "error" });
        (0, bun_test_1.expect)((0, devcontainerCli_1.parseDevcontainerStdoutLine)(line)).toEqual({
            kind: "log",
            text: "Oops",
        });
    });
    (0, bun_test_1.it)("skips text lines below level 2", () => {
        const line = JSON.stringify({ type: "text", level: 1, text: "debug" });
        (0, bun_test_1.expect)((0, devcontainerCli_1.parseDevcontainerStdoutLine)(line)).toBeNull();
    });
    (0, bun_test_1.it)("parses result lines", () => {
        const line = JSON.stringify({
            outcome: "success",
            containerId: "abc123",
            remoteUser: "node",
            remoteWorkspaceFolder: "/workspaces/demo",
        });
        const parsed = (0, devcontainerCli_1.parseDevcontainerStdoutLine)(line);
        (0, bun_test_1.expect)(parsed?.kind).toBe("result");
        if (parsed?.kind === "result") {
            (0, bun_test_1.expect)(parsed.result.containerId).toBe("abc123");
        }
    });
    (0, bun_test_1.it)("falls back to raw lines for non-JSON output", () => {
        (0, bun_test_1.expect)((0, devcontainerCli_1.parseDevcontainerStdoutLine)("not json")).toEqual({
            kind: "raw",
            text: "not json",
        });
    });
});
(0, bun_test_1.describe)("formatDevcontainerUpError", () => {
    (0, bun_test_1.it)("prefers message and description", () => {
        (0, bun_test_1.expect)((0, devcontainerCli_1.formatDevcontainerUpError)({
            outcome: "error",
            message: "Command failed",
            description: "postCreateCommand failed",
        })).toBe("devcontainer up failed: Command failed - postCreateCommand failed");
    });
    (0, bun_test_1.it)("falls back to stderr summary", () => {
        (0, bun_test_1.expect)((0, devcontainerCli_1.formatDevcontainerUpError)({ outcome: "error" }, "stderr info")).toBe("devcontainer up failed: stderr info");
    });
});
(0, bun_test_1.describe)("shouldCleanupDevcontainer", () => {
    (0, bun_test_1.it)("returns true for error results with containerId", () => {
        (0, bun_test_1.expect)((0, devcontainerCli_1.shouldCleanupDevcontainer)({ outcome: "error", containerId: "abc" })).toBe(true);
    });
    (0, bun_test_1.it)("returns false for error results without containerId", () => {
        (0, bun_test_1.expect)((0, devcontainerCli_1.shouldCleanupDevcontainer)({ outcome: "error" })).toBe(false);
    });
    (0, bun_test_1.it)("returns false for success results", () => {
        (0, bun_test_1.expect)((0, devcontainerCli_1.shouldCleanupDevcontainer)({ outcome: "success", containerId: "abc" })).toBe(false);
    });
});
//# sourceMappingURL=devcontainerCli.test.js.map