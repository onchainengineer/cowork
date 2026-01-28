"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const runtimeCompatibility_1 = require("../../common/utils/runtimeCompatibility");
const runtimeFactory_1 = require("./runtimeFactory");
const LocalRuntime_1 = require("./LocalRuntime");
const WorktreeRuntime_1 = require("./WorktreeRuntime");
(0, bun_test_1.describe)("isIncompatibleRuntimeConfig", () => {
    (0, bun_test_1.it)("returns false for undefined config", () => {
        (0, bun_test_1.expect)((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(undefined)).toBe(false);
    });
    (0, bun_test_1.it)("returns false for local config with srcBaseDir (legacy worktree)", () => {
        const config = {
            type: "local",
            srcBaseDir: "~/.unix/src",
        };
        (0, bun_test_1.expect)((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(config)).toBe(false);
    });
    (0, bun_test_1.it)("returns false for local config without srcBaseDir (project-dir mode)", () => {
        // Local without srcBaseDir is now supported as project-dir mode
        const config = { type: "local" };
        (0, bun_test_1.expect)((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(config)).toBe(false);
    });
    (0, bun_test_1.it)("returns false for worktree config", () => {
        const config = {
            type: "worktree",
            srcBaseDir: "~/.unix/src",
        };
        (0, bun_test_1.expect)((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(config)).toBe(false);
    });
    (0, bun_test_1.it)("returns false for SSH config", () => {
        const config = {
            type: "ssh",
            host: "example.com",
            srcBaseDir: "/home/user/unix",
        };
        (0, bun_test_1.expect)((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(config)).toBe(false);
    });
    (0, bun_test_1.it)("returns true for unknown runtime type from future versions", () => {
        // Simulate a config from a future version with new type
        const config = { type: "future-runtime" };
        (0, bun_test_1.expect)((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(config)).toBe(true);
    });
});
(0, bun_test_1.describe)("createRuntime", () => {
    (0, bun_test_1.it)("creates WorktreeRuntime for local config with srcBaseDir (legacy)", () => {
        const config = {
            type: "local",
            srcBaseDir: "/tmp/test-src",
        };
        const runtime = (0, runtimeFactory_1.createRuntime)(config);
        (0, bun_test_1.expect)(runtime).toBeInstanceOf(WorktreeRuntime_1.WorktreeRuntime);
    });
    (0, bun_test_1.it)("creates LocalRuntime for local config without srcBaseDir (project-dir)", () => {
        const config = { type: "local" };
        const runtime = (0, runtimeFactory_1.createRuntime)(config, { projectPath: "/tmp/my-project" });
        (0, bun_test_1.expect)(runtime).toBeInstanceOf(LocalRuntime_1.LocalRuntime);
    });
    (0, bun_test_1.it)("creates WorktreeRuntime for explicit worktree config", () => {
        const config = {
            type: "worktree",
            srcBaseDir: "/tmp/test-src",
        };
        const runtime = (0, runtimeFactory_1.createRuntime)(config);
        (0, bun_test_1.expect)(runtime).toBeInstanceOf(WorktreeRuntime_1.WorktreeRuntime);
    });
    (0, bun_test_1.it)("throws error for local project-dir without projectPath option", () => {
        const config = { type: "local" };
        (0, bun_test_1.expect)(() => (0, runtimeFactory_1.createRuntime)(config)).toThrow(/projectPath/);
    });
    (0, bun_test_1.it)("throws IncompatibleRuntimeError for unknown runtime type", () => {
        const config = { type: "future-runtime" };
        (0, bun_test_1.expect)(() => (0, runtimeFactory_1.createRuntime)(config)).toThrow(runtimeFactory_1.IncompatibleRuntimeError);
        (0, bun_test_1.expect)(() => (0, runtimeFactory_1.createRuntime)(config)).toThrow(/newer version of unix/);
    });
});
//# sourceMappingURL=runtimeFactory.test.js.map