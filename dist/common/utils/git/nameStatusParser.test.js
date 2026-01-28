"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const nameStatusParser_1 = require("./nameStatusParser");
(0, bun_test_1.describe)("parseNameStatus", () => {
    (0, bun_test_1.it)("parses added/modified/deleted entries", () => {
        const output = ["A\tnew.ts", "M\tsrc/changed.ts", "D\told.ts"].join("\n");
        (0, bun_test_1.expect)((0, nameStatusParser_1.parseNameStatus)(output)).toEqual([
            { filePath: "new.ts", changeType: "added" },
            { filePath: "src/changed.ts", changeType: "modified" },
            { filePath: "old.ts", changeType: "deleted" },
        ]);
    });
    (0, bun_test_1.it)("parses copied entries", () => {
        const output = "C100\tsrc/orig.ts\tsrc/copy.ts\n";
        (0, bun_test_1.expect)((0, nameStatusParser_1.parseNameStatus)(output)).toEqual([
            { filePath: "src/copy.ts", oldPath: "src/orig.ts", changeType: "added" },
        ]);
    });
    (0, bun_test_1.it)("parses renamed entries", () => {
        const output = "R100\tsrc/old.ts\tsrc/new.ts\n";
        (0, bun_test_1.expect)((0, nameStatusParser_1.parseNameStatus)(output)).toEqual([
            { filePath: "src/new.ts", oldPath: "src/old.ts", changeType: "renamed" },
        ]);
    });
    (0, bun_test_1.it)("dedupes by changeType precedence", () => {
        const output = [
            "M\tsame.ts",
            "D\tsame.ts",
            "A\tother.ts",
            "M\tother.ts",
            "R100\tfrom.ts\tother.ts",
        ].join("\n");
        // deleted > added > renamed > modified
        (0, bun_test_1.expect)((0, nameStatusParser_1.parseNameStatus)(output)).toEqual([
            { filePath: "same.ts", changeType: "deleted" },
            { filePath: "other.ts", changeType: "added" },
        ]);
    });
});
//# sourceMappingURL=nameStatusParser.test.js.map