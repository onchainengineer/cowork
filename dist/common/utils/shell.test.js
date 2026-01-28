"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const shell_1 = require("./shell");
(0, bun_test_1.describe)("shellQuote", () => {
    (0, bun_test_1.test)("quotes regular strings", () => {
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("foo")).toBe("'foo'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("main")).toBe("'main'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("feature/branch")).toBe("'feature/branch'");
    });
    (0, bun_test_1.test)("handles empty string", () => {
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("")).toBe("''");
    });
    (0, bun_test_1.test)("escapes single quotes", () => {
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("it's")).toBe("'it'\"'\"'s'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("'")).toBe("''\"'\"''");
    });
    (0, bun_test_1.test)("handles special characters safely", () => {
        // These should all be safely quoted
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("a b")).toBe("'a b'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("$(whoami)")).toBe("'$(whoami)'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("`id`")).toBe("'`id`'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("foo;rm -rf /")).toBe("'foo;rm -rf /'");
        (0, bun_test_1.expect)((0, shell_1.shellQuote)("a\nb")).toBe("'a\nb'");
    });
});
//# sourceMappingURL=shell.test.js.map