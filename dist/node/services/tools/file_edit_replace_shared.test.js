"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const file_edit_replace_shared_1 = require("./file_edit_replace_shared");
(0, bun_test_1.test)("file_edit_replace_string error includes agent note field", () => {
    const result = (0, file_edit_replace_shared_1.handleStringReplace)({
        file_path: "test.ts",
        old_string: "nonexistent",
        new_string: "replacement",
    }, "some file content");
    (0, bun_test_1.expect)(result.success).toBe(false);
    if (!result.success) {
        (0, bun_test_1.expect)(result.error).toContain("old_string not found");
        (0, bun_test_1.expect)(result.note).toBeDefined();
        (0, bun_test_1.expect)(result.note).toContain("EDIT FAILED");
        (0, bun_test_1.expect)(result.note).toContain("file was NOT modified");
    }
});
(0, bun_test_1.test)("file_edit_replace_string ambiguous match error includes note", () => {
    const result = (0, file_edit_replace_shared_1.handleStringReplace)({
        file_path: "test.ts",
        old_string: "duplicate",
        new_string: "replacement",
    }, "duplicate text with duplicate word");
    (0, bun_test_1.expect)(result.success).toBe(false);
    if (!result.success) {
        (0, bun_test_1.expect)(result.error).toContain("appears 2 times");
        (0, bun_test_1.expect)(result.note).toBeDefined();
        (0, bun_test_1.expect)(result.note).toContain("EDIT FAILED");
        (0, bun_test_1.expect)(result.note).toContain("file was NOT modified");
    }
});
(0, bun_test_1.test)("file_edit_replace_lines validation error includes note", () => {
    const result = (0, file_edit_replace_shared_1.handleLineReplace)({
        file_path: "test.ts",
        start_line: 10,
        end_line: 9,
        new_lines: ["new content"],
    }, "line 1\nline 2");
    (0, bun_test_1.expect)(result.success).toBe(false);
    if (!result.success) {
        (0, bun_test_1.expect)(result.error).toContain("end_line must be >= start_line");
        (0, bun_test_1.expect)(result.note).toBeDefined();
        (0, bun_test_1.expect)(result.note).toContain("EDIT FAILED");
        (0, bun_test_1.expect)(result.note).toContain("file was NOT modified");
    }
});
//# sourceMappingURL=file_edit_replace_shared.test.js.map