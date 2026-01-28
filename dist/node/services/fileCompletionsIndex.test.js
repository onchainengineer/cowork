"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const fileCompletionsIndex_1 = require("./fileCompletionsIndex");
(0, bun_test_1.describe)("searchFileCompletions", () => {
    const files = [
        "README.md",
        "src/foo.ts",
        "src/bar.ts",
        "src/components/Button.tsx",
        "docs/guide.md",
    ];
    const index = (0, fileCompletionsIndex_1.buildFileCompletionsIndex)(files);
    (0, bun_test_1.it)("returns shallow paths first for empty queries", () => {
        (0, bun_test_1.expect)((0, fileCompletionsIndex_1.searchFileCompletions)(index, "", 3)).toEqual(["README.md", "src/bar.ts", "src/foo.ts"]);
    });
    (0, bun_test_1.it)("supports prefix matches on directory paths", () => {
        (0, bun_test_1.expect)((0, fileCompletionsIndex_1.searchFileCompletions)(index, "src/", 10)).toEqual([
            "src/bar.ts",
            "src/components/Button.tsx",
            "src/foo.ts",
        ]);
    });
    (0, bun_test_1.it)("supports prefix matches on full paths", () => {
        (0, bun_test_1.expect)((0, fileCompletionsIndex_1.searchFileCompletions)(index, "src/f", 10)).toEqual(["src/foo.ts"]);
    });
    (0, bun_test_1.it)("supports prefix matches on basenames", () => {
        (0, bun_test_1.expect)((0, fileCompletionsIndex_1.searchFileCompletions)(index, "foo", 10)).toEqual(["src/foo.ts"]);
    });
    (0, bun_test_1.it)("falls back to segment/substring matching", () => {
        (0, bun_test_1.expect)((0, fileCompletionsIndex_1.searchFileCompletions)(index, "comp", 10)).toEqual(["src/components/Button.tsx"]);
    });
    (0, bun_test_1.it)("normalizes Windows-style path separators", () => {
        (0, bun_test_1.expect)((0, fileCompletionsIndex_1.searchFileCompletions)(index, "src\\b", 10)).toEqual(["src/bar.ts"]);
    });
});
//# sourceMappingURL=fileCompletionsIndex.test.js.map