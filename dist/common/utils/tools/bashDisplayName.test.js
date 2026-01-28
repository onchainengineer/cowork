"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const bashDisplayName_1 = require("./bashDisplayName");
(0, bun_test_1.describe)("bashDisplayName", () => {
    (0, bun_test_1.test)("getDefaultBashDisplayName derives from first non-empty line", () => {
        (0, bun_test_1.expect)((0, bashDisplayName_1.getDefaultBashDisplayName)("\n\n  echo   hi\n")).toBe("echo hi");
    });
    (0, bun_test_1.test)("getDefaultBashDisplayName falls back to 'bash' when script is empty", () => {
        (0, bun_test_1.expect)((0, bashDisplayName_1.getDefaultBashDisplayName)("\n\n\n")).toBe("bash");
    });
    (0, bun_test_1.test)("resolveBashDisplayName sanitizes user-provided display_name", () => {
        (0, bun_test_1.expect)((0, bashDisplayName_1.resolveBashDisplayName)("echo hi", "dev/server"))
            // Slash is invalid in filenames and must not create path segments.
            .toBe("dev_server");
    });
    (0, bun_test_1.test)("resolveBashDisplayName strips trailing dots/spaces", () => {
        (0, bun_test_1.expect)((0, bashDisplayName_1.resolveBashDisplayName)("echo hi", "name. ")).toBe("name");
    });
    (0, bun_test_1.test)("resolveBashDisplayName falls back to script-derived name when display_name is empty", () => {
        (0, bun_test_1.expect)((0, bashDisplayName_1.resolveBashDisplayName)("echo hi", "   ")).toBe("echo hi");
    });
    (0, bun_test_1.test)("resolveBashDisplayName rejects dot segments", () => {
        (0, bun_test_1.expect)((0, bashDisplayName_1.resolveBashDisplayName)("echo hi", ".."))
            // Dot segments are rejected (even without path separators) to avoid ambiguity.
            .toBe("bash");
    });
});
//# sourceMappingURL=bashDisplayName.test.js.map