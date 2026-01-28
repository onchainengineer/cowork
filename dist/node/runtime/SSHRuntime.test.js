"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const SSHRuntime_1 = require("./SSHRuntime");
const transports_1 = require("./transports");
/**
 * SSHRuntime constructor tests (run with bun test)
 *
 * Note: SSH workspace operation tests (renameWorkspace, deleteWorkspace) require Docker
 * and are in ssh-workspace.jest-test.ts - run with: TEST_INTEGRATION=1 bun x jest
 */
(0, bun_test_1.describe)("SSHRuntime constructor", () => {
    (0, bun_test_1.it)("should accept tilde in srcBaseDir", () => {
        // Tildes are now allowed - they will be resolved via resolvePath()
        (0, bun_test_1.expect)(() => {
            const config = { host: "example.com", srcBaseDir: "~/unix" };
            new SSHRuntime_1.SSHRuntime(config, (0, transports_1.createSSHTransport)(config, false));
        }).not.toThrow();
    });
    (0, bun_test_1.it)("should accept bare tilde in srcBaseDir", () => {
        // Tildes are now allowed - they will be resolved via resolvePath()
        (0, bun_test_1.expect)(() => {
            const config = { host: "example.com", srcBaseDir: "~" };
            new SSHRuntime_1.SSHRuntime(config, (0, transports_1.createSSHTransport)(config, false));
        }).not.toThrow();
    });
    (0, bun_test_1.it)("should accept absolute paths in srcBaseDir", () => {
        (0, bun_test_1.expect)(() => {
            const config = { host: "example.com", srcBaseDir: "/home/user/unix" };
            new SSHRuntime_1.SSHRuntime(config, (0, transports_1.createSSHTransport)(config, false));
        }).not.toThrow();
    });
});
//# sourceMappingURL=SSHRuntime.test.js.map