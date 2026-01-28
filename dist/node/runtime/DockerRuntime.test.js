"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const DockerRuntime_1 = require("./DockerRuntime");
/**
 * DockerRuntime constructor tests (run with bun test)
 *
 * Note: Docker workspace operation tests require Docker
 * and should be in tests/runtime/runtime.test.ts
 */
(0, bun_test_1.describe)("DockerRuntime constructor", () => {
    (0, bun_test_1.it)("should accept image name", () => {
        (0, bun_test_1.expect)(() => {
            new DockerRuntime_1.DockerRuntime({ image: "ubuntu:22.04" });
        }).not.toThrow();
    });
    (0, bun_test_1.it)("should accept registry image", () => {
        (0, bun_test_1.expect)(() => {
            new DockerRuntime_1.DockerRuntime({ image: "ghcr.io/myorg/dev-image:latest" });
        }).not.toThrow();
    });
    (0, bun_test_1.it)("should return image via getImage()", () => {
        const runtime = new DockerRuntime_1.DockerRuntime({ image: "node:20" });
        (0, bun_test_1.expect)(runtime.getImage()).toBe("node:20");
    });
    (0, bun_test_1.it)("should return /src for workspace path", () => {
        const runtime = new DockerRuntime_1.DockerRuntime({ image: "ubuntu:22.04" });
        (0, bun_test_1.expect)(runtime.getWorkspacePath("/any/project", "any-branch")).toBe("/src");
    });
    (0, bun_test_1.it)("should accept containerName for existing workspaces", () => {
        // When recreating runtime for existing workspace, containerName is passed in config
        const runtime = new DockerRuntime_1.DockerRuntime({
            image: "ubuntu:22.04",
            containerName: "unix-myproject-my-feature",
        });
        (0, bun_test_1.expect)(runtime.getImage()).toBe("ubuntu:22.04");
        // Runtime should be ready for exec operations without calling createWorkspace
    });
});
(0, bun_test_1.describe)("getContainerName", () => {
    (0, bun_test_1.it)("should generate container name from project and workspace", () => {
        (0, bun_test_1.expect)((0, DockerRuntime_1.getContainerName)("/home/user/myproject", "feature-branch")).toBe("unix-myproject-feature-branch-a8d18a");
    });
    (0, bun_test_1.it)("should sanitize special characters", () => {
        (0, bun_test_1.expect)((0, DockerRuntime_1.getContainerName)("/home/user/my@project", "feature/branch")).toBe("unix-my-project-feature-branch-b354b4");
    });
    (0, bun_test_1.it)("should handle long names", () => {
        const longName = "a".repeat(100);
        const result = (0, DockerRuntime_1.getContainerName)("/project", longName);
        // Docker has 64 char limit, function uses 63 to be safe
        (0, bun_test_1.expect)(result.length).toBeLessThanOrEqual(63);
    });
});
//# sourceMappingURL=DockerRuntime.test.js.map