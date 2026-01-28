"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const DevcontainerRuntime_1 = require("./DevcontainerRuntime");
function createRuntime(state) {
    const runtime = new DevcontainerRuntime_1.DevcontainerRuntime({
        srcBaseDir: "/tmp/unix",
        configPath: ".devcontainer/devcontainer.json",
    });
    const internal = runtime;
    internal.remoteHomeDir = state.remoteHomeDir;
    internal.remoteUser = state.remoteUser;
    internal.remoteWorkspaceFolder = state.remoteWorkspaceFolder;
    internal.currentWorkspacePath = state.currentWorkspacePath;
    return runtime;
}
(0, bun_test_1.describe)("DevcontainerRuntime.resolvePath", () => {
    (0, bun_test_1.it)("resolves ~ to cached remoteHomeDir", async () => {
        const runtime = createRuntime({ remoteHomeDir: "/home/lattice" });
        (0, bun_test_1.expect)(await runtime.resolvePath("~")).toBe("/home/lattice");
    });
    (0, bun_test_1.it)("throws when home is unknown", async () => {
        const runtime = createRuntime({});
        // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test expect().rejects requires await
        await (0, bun_test_1.expect)(runtime.resolvePath("~")).rejects.toThrow("container home directory unavailable");
    });
    (0, bun_test_1.it)("resolves ~/path to cached remoteHomeDir", async () => {
        const runtime = createRuntime({ remoteHomeDir: "/opt/user" });
        (0, bun_test_1.expect)(await runtime.resolvePath("~/.unix")).toBe("/opt/user/.unix");
    });
    (0, bun_test_1.it)("falls back to /home/<user> without cached home", async () => {
        const runtime = createRuntime({ remoteUser: "node" });
        (0, bun_test_1.expect)(await runtime.resolvePath("~")).toBe("/home/node");
    });
    (0, bun_test_1.it)("falls back to /root for root user", async () => {
        const runtime = createRuntime({ remoteUser: "root" });
        (0, bun_test_1.expect)(await runtime.resolvePath("~")).toBe("/root");
    });
    (0, bun_test_1.it)("resolves relative paths against remoteWorkspaceFolder", async () => {
        const runtime = createRuntime({ remoteWorkspaceFolder: "/workspaces/demo" });
        (0, bun_test_1.expect)(await runtime.resolvePath("./foo")).toBe("/workspaces/demo/foo");
        (0, bun_test_1.expect)(await runtime.resolvePath("bar")).toBe("/workspaces/demo/bar");
    });
    (0, bun_test_1.it)("resolves relative paths against / when no workspace set", async () => {
        const runtime = createRuntime({});
        (0, bun_test_1.expect)(await runtime.resolvePath("foo")).toBe("/foo");
    });
    (0, bun_test_1.it)("passes absolute paths through", async () => {
        const runtime = createRuntime({});
        (0, bun_test_1.expect)(await runtime.resolvePath("/tmp/test")).toBe("/tmp/test");
    });
});
(0, bun_test_1.describe)("DevcontainerRuntime.quoteForContainer", () => {
    function quoteForContainer(runtime, filePath) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return runtime.quoteForContainer(filePath);
    }
    (0, bun_test_1.it)("uses $HOME expansion for tilde paths", () => {
        const runtime = createRuntime({});
        (0, bun_test_1.expect)(quoteForContainer(runtime, "~/.unix")).toBe('"$HOME/.unix"');
    });
});
(0, bun_test_1.describe)("DevcontainerRuntime.resolveContainerCwd", () => {
    // Access the private method for testing
    function resolveContainerCwd(runtime, optionsCwd, workspaceFolder) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return runtime.resolveContainerCwd(optionsCwd, workspaceFolder);
    }
    (0, bun_test_1.it)("uses POSIX absolute path as cwd", () => {
        const runtime = createRuntime({ remoteWorkspaceFolder: "/workspaces/project" });
        (0, bun_test_1.expect)(resolveContainerCwd(runtime, "/tmp/test", "/host/workspace")).toBe("/tmp/test");
    });
    (0, bun_test_1.it)("rejects Windows drive letter paths and falls back to workspace", () => {
        const runtime = createRuntime({ remoteWorkspaceFolder: "/workspaces/project" });
        (0, bun_test_1.expect)(resolveContainerCwd(runtime, "C:\\Users\\dev", "/host/workspace")).toBe("/workspaces/project");
    });
    (0, bun_test_1.it)("rejects paths with backslashes and falls back to workspace", () => {
        const runtime = createRuntime({ remoteWorkspaceFolder: "/workspaces/project" });
        (0, bun_test_1.expect)(resolveContainerCwd(runtime, "some\\path", "/host/workspace")).toBe("/workspaces/project");
    });
    (0, bun_test_1.it)("falls back to workspaceFolder when remoteWorkspaceFolder not set", () => {
        const runtime = createRuntime({});
        (0, bun_test_1.expect)(resolveContainerCwd(runtime, "C:\\", "/host/workspace")).toBe("/host/workspace");
    });
    (0, bun_test_1.it)("falls back when cwd is undefined", () => {
        const runtime = createRuntime({ remoteWorkspaceFolder: "/workspaces/project" });
        (0, bun_test_1.expect)(resolveContainerCwd(runtime, undefined, "/host/workspace")).toBe("/workspaces/project");
    });
});
(0, bun_test_1.describe)("DevcontainerRuntime.resolveHostPathForMounted", () => {
    function resolveHostPathForMounted(runtime, filePath) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return runtime.resolveHostPathForMounted(filePath);
    }
    (0, bun_test_1.it)("accepts Windows host paths under the workspace root", () => {
        const runtime = createRuntime({ currentWorkspacePath: "C:\\ws\\proj" });
        const filePath = "C:\\ws\\proj\\.unix\\mcp.local.jsonc";
        (0, bun_test_1.expect)(resolveHostPathForMounted(runtime, filePath)).toBe(filePath);
    });
});
(0, bun_test_1.describe)("DevcontainerRuntime.mapHostPathToContainer", () => {
    // Access the private method for testing
    function mapHostPathToContainer(runtime, hostPath) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        return runtime.mapHostPathToContainer(hostPath);
    }
    (0, bun_test_1.it)("maps host workspace root to container workspace", () => {
        const runtime = createRuntime({
            remoteWorkspaceFolder: "/workspaces/project",
            currentWorkspacePath: "/home/user/unix/project/branch",
        });
        (0, bun_test_1.expect)(mapHostPathToContainer(runtime, "/home/user/unix/project/branch")).toBe("/workspaces/project");
    });
    (0, bun_test_1.it)("maps host subpath to container subpath", () => {
        const runtime = createRuntime({
            remoteWorkspaceFolder: "/workspaces/project",
            currentWorkspacePath: "/home/user/unix/project/branch",
        });
        (0, bun_test_1.expect)(mapHostPathToContainer(runtime, "/home/user/unix/project/branch/src/file.ts")).toBe("/workspaces/project/src/file.ts");
    });
    (0, bun_test_1.it)("normalizes Windows backslashes to forward slashes", () => {
        const runtime = createRuntime({
            remoteWorkspaceFolder: "/workspaces/project",
            currentWorkspacePath: "C:\\Users\\dev\\unix\\project\\branch",
        });
        // Windows-style path with backslashes should map correctly
        (0, bun_test_1.expect)(mapHostPathToContainer(runtime, "C:\\Users\\dev\\unix\\project\\branch\\src\\file.ts")).toBe("/workspaces/project/src/file.ts");
    });
    (0, bun_test_1.it)("returns null for paths outside workspace", () => {
        const runtime = createRuntime({
            remoteWorkspaceFolder: "/workspaces/project",
            currentWorkspacePath: "/home/user/unix/project/branch",
        });
        (0, bun_test_1.expect)(mapHostPathToContainer(runtime, "/tmp/other")).toBeNull();
    });
    (0, bun_test_1.it)("returns null when workspace not set", () => {
        const runtime = createRuntime({});
        (0, bun_test_1.expect)(mapHostPathToContainer(runtime, "/some/path")).toBeNull();
    });
});
//# sourceMappingURL=DevcontainerRuntime.test.js.map