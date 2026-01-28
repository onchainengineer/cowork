"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const runtime_1 = require("./runtime");
(0, globals_1.describe)("parseRuntimeModeAndHost", () => {
    (0, globals_1.it)("parses SSH mode with host", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("ssh user@host")).toEqual({
            mode: "ssh",
            host: "user@host",
        });
    });
    (0, globals_1.it)("returns null for SSH mode without host", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("ssh")).toBeNull();
    });
    (0, globals_1.it)("returns null for SSH with trailing space but no host", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("ssh ")).toBeNull();
    });
    (0, globals_1.it)("parses Docker mode with image", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("docker ubuntu:22.04")).toEqual({
            mode: "docker",
            image: "ubuntu:22.04",
        });
    });
    (0, globals_1.it)("returns null for Docker mode without image", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("docker")).toBeNull();
    });
    (0, globals_1.it)("parses local mode", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("local")).toEqual({
            mode: "local",
        });
    });
    (0, globals_1.it)("parses worktree mode", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("worktree")).toEqual({
            mode: "worktree",
        });
    });
    (0, globals_1.it)("defaults to worktree for undefined", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)(undefined)).toEqual({
            mode: "worktree",
        });
    });
    (0, globals_1.it)("defaults to worktree for null", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)(null)).toEqual({
            mode: "worktree",
        });
    });
    (0, globals_1.it)("returns null for unrecognized runtime", () => {
        (0, globals_1.expect)((0, runtime_1.parseRuntimeModeAndHost)("unknown")).toBeNull();
    });
});
(0, globals_1.describe)("buildRuntimeString", () => {
    (0, globals_1.it)("builds SSH string with host", () => {
        (0, globals_1.expect)((0, runtime_1.buildRuntimeString)({ mode: "ssh", host: "user@host" })).toBe("ssh user@host");
    });
    (0, globals_1.it)("builds Docker string with image", () => {
        (0, globals_1.expect)((0, runtime_1.buildRuntimeString)({ mode: "docker", image: "ubuntu:22.04" })).toBe("docker ubuntu:22.04");
    });
    (0, globals_1.it)("returns 'local' for local mode", () => {
        (0, globals_1.expect)((0, runtime_1.buildRuntimeString)({ mode: "local" })).toBe("local");
    });
    (0, globals_1.it)("returns undefined for worktree mode (default)", () => {
        (0, globals_1.expect)((0, runtime_1.buildRuntimeString)({ mode: "worktree" })).toBeUndefined();
    });
});
(0, globals_1.describe)("round-trip parsing and building", () => {
    (0, globals_1.it)("preserves SSH mode with host", () => {
        const built = (0, runtime_1.buildRuntimeString)({ mode: "ssh", host: "user@host" });
        const parsed = (0, runtime_1.parseRuntimeModeAndHost)(built);
        (0, globals_1.expect)(parsed).toEqual({ mode: "ssh", host: "user@host" });
    });
    (0, globals_1.it)("preserves Docker mode with image", () => {
        const built = (0, runtime_1.buildRuntimeString)({ mode: "docker", image: "node:20" });
        const parsed = (0, runtime_1.parseRuntimeModeAndHost)(built);
        (0, globals_1.expect)(parsed).toEqual({ mode: "docker", image: "node:20" });
    });
    (0, globals_1.it)("preserves local mode", () => {
        const built = (0, runtime_1.buildRuntimeString)({ mode: "local" });
        const parsed = (0, runtime_1.parseRuntimeModeAndHost)(built);
        (0, globals_1.expect)(parsed).toEqual({ mode: "local" });
    });
    (0, globals_1.it)("preserves worktree mode", () => {
        const built = (0, runtime_1.buildRuntimeString)({ mode: "worktree" });
        const parsed = (0, runtime_1.parseRuntimeModeAndHost)(built);
        (0, globals_1.expect)(parsed).toEqual({ mode: "worktree" });
    });
    (0, globals_1.it)("preserves SSH mode with Coder placeholder", () => {
        // Lattice SSH runtimes use placeholder host when no explicit SSH host is set
        const built = (0, runtime_1.buildRuntimeString)({ mode: "ssh", host: runtime_1.LATTICE_RUNTIME_PLACEHOLDER });
        const parsed = (0, runtime_1.parseRuntimeModeAndHost)(built);
        (0, globals_1.expect)(parsed).toEqual({ mode: "ssh", host: runtime_1.LATTICE_RUNTIME_PLACEHOLDER });
    });
});
//# sourceMappingURL=runtime.test.js.map