"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const ui_1 = require("./ui");
(0, bun_test_1.describe)("resolveSectionColor", () => {
    (0, bun_test_1.it)("returns default for empty/undefined", () => {
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)(undefined)).toBe(ui_1.DEFAULT_SECTION_COLOR);
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)(null)).toBe(ui_1.DEFAULT_SECTION_COLOR);
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("")).toBe(ui_1.DEFAULT_SECTION_COLOR);
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("   ")).toBe(ui_1.DEFAULT_SECTION_COLOR);
    });
    (0, bun_test_1.it)("resolves palette names (case-insensitive)", () => {
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("Blue")).toBe("#5a9bd4");
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("blue")).toBe("#5a9bd4");
    });
    (0, bun_test_1.it)("normalizes hex colors", () => {
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("#ABC")).toBe("#aabbcc");
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("#AABBCC")).toBe("#aabbcc");
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("#AABBCCDD")).toBe("#aabbcc");
    });
    (0, bun_test_1.it)("falls back to default for invalid values", () => {
        (0, bun_test_1.expect)((0, ui_1.resolveSectionColor)("not-a-color")).toBe(ui_1.DEFAULT_SECTION_COLOR);
    });
});
//# sourceMappingURL=ui.test.js.map