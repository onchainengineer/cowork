"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const atMentions_1 = require("./atMentions");
(0, bun_test_1.describe)("atMentions", () => {
    (0, bun_test_1.describe)("extractAtMentions", () => {
        (0, bun_test_1.it)("extracts basic @path mentions", () => {
            (0, bun_test_1.expect)((0, atMentions_1.extractAtMentions)("see @src/foo.ts")).toEqual([
                {
                    token: "src/foo.ts",
                    path: "src/foo.ts",
                },
            ]);
        });
        (0, bun_test_1.it)("strips trailing punctuation", () => {
            (0, bun_test_1.expect)((0, atMentions_1.extractAtMentions)("see (@src/foo.ts), and @bar/baz.ts.")).toEqual([
                {
                    token: "src/foo.ts",
                    path: "src/foo.ts",
                },
                {
                    token: "bar/baz.ts",
                    path: "bar/baz.ts",
                },
            ]);
        });
        (0, bun_test_1.it)("parses #L<start>-<end> ranges", () => {
            (0, bun_test_1.expect)((0, atMentions_1.extractAtMentions)("check @src/foo.ts#L1-3")).toEqual([
                {
                    token: "src/foo.ts#L1-3",
                    path: "src/foo.ts",
                    range: { startLine: 1, endLine: 3 },
                },
            ]);
        });
        (0, bun_test_1.it)("records an error for unsupported fragments", () => {
            const mentions = (0, atMentions_1.extractAtMentions)("check @src/foo.ts#anchor");
            (0, bun_test_1.expect)(mentions).toHaveLength(1);
            (0, bun_test_1.expect)(mentions[0]?.path).toBe("src/foo.ts");
            (0, bun_test_1.expect)(mentions[0]?.range).toBeUndefined();
            (0, bun_test_1.expect)(mentions[0]?.rangeError).toContain("expected #L<start>-<end>");
        });
        (0, bun_test_1.it)("does not match email addresses", () => {
            (0, bun_test_1.expect)((0, atMentions_1.extractAtMentions)("email foo@bar.com and see @src/foo.ts")).toEqual([
                {
                    token: "src/foo.ts",
                    path: "src/foo.ts",
                },
            ]);
        });
    });
    (0, bun_test_1.describe)("findAtMentionAtCursor", () => {
        (0, bun_test_1.it)("finds the active mention at cursor", () => {
            const text = "see @src/fo";
            (0, bun_test_1.expect)((0, atMentions_1.findAtMentionAtCursor)(text, text.length)).toEqual({
                startIndex: 4,
                endIndex: text.length,
                query: "src/fo",
            });
        });
        (0, bun_test_1.it)("supports leading punctuation before @", () => {
            const text = "(@src/fo";
            (0, bun_test_1.expect)((0, atMentions_1.findAtMentionAtCursor)(text, text.length)).toEqual({
                startIndex: 1,
                endIndex: text.length,
                query: "src/fo",
            });
        });
        (0, bun_test_1.it)("ignores word@word patterns", () => {
            const text = "foo@bar";
            (0, bun_test_1.expect)((0, atMentions_1.findAtMentionAtCursor)(text, text.length)).toBeNull();
        });
        (0, bun_test_1.it)("ignores tokens that already contain a fragment (#...)", () => {
            const text = "@src/foo.ts#L1-3";
            (0, bun_test_1.expect)((0, atMentions_1.findAtMentionAtCursor)(text, text.length)).toBeNull();
        });
        (0, bun_test_1.it)("excludes trailing punctuation from the match", () => {
            const text = "see @src/foo.ts,";
            (0, bun_test_1.expect)((0, atMentions_1.findAtMentionAtCursor)(text, text.length)).toEqual({
                startIndex: 4,
                endIndex: 15,
                query: "src/foo.ts",
            });
        });
    });
});
//# sourceMappingURL=atMentions.test.js.map