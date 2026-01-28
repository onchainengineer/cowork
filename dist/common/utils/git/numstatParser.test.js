"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const numstatParser_1 = require("./numstatParser");
(0, bun_test_1.describe)("extractNewPath", () => {
    (0, bun_test_1.test)("returns unchanged path for normal files", () => {
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("src/foo.ts")).toBe("src/foo.ts");
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("file.txt")).toBe("file.txt");
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("dir/subdir/file.js")).toBe("dir/subdir/file.js");
    });
    (0, bun_test_1.test)("extracts new path from plain arrow syntax", () => {
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("helpers.ts => helpers-renamed.ts")).toBe("helpers-renamed.ts");
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("src/helpers.ts => src/helpers-renamed.ts")).toBe("src/helpers-renamed.ts");
    });
    (0, bun_test_1.test)("extracts new path from rename syntax", () => {
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("{old.ts => new.ts}")).toBe("new.ts");
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("src/{old.ts => new.ts}")).toBe("src/new.ts");
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("src/components/{ChatMetaSidebar.tsx => RightSidebar.tsx}")).toBe("src/components/RightSidebar.tsx");
    });
    (0, bun_test_1.test)("handles rename with directory prefix and suffix", () => {
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("src/{foo => bar}/file.ts")).toBe("src/bar/file.ts");
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("{a => b}/c/d.ts")).toBe("b/c/d.ts");
    });
    (0, bun_test_1.test)("handles complex paths", () => {
        (0, bun_test_1.expect)((0, numstatParser_1.extractNewPath)("very/long/path/{oldname.tsx => newname.tsx}")).toBe("very/long/path/newname.tsx");
    });
});
//# sourceMappingURL=numstatParser.test.js.map