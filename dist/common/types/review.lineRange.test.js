"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const review_1 = require("./review");
(0, bun_test_1.describe)("parseReviewLineRange", () => {
    (0, bun_test_1.test)("parses combined old/new ranges", () => {
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("-10-12 +14-16")).toEqual({
            old: { start: 10, end: 12 },
            new: { start: 14, end: 16 },
        });
    });
    (0, bun_test_1.test)("parses single-line ranges", () => {
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("-10 +14")).toEqual({
            old: { start: 10, end: 10 },
            new: { start: 14, end: 14 },
        });
    });
    (0, bun_test_1.test)("parses old-only and new-only ranges", () => {
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("-3-5")).toEqual({
            old: { start: 3, end: 5 },
            new: undefined,
        });
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("+7")).toEqual({
            old: undefined,
            new: { start: 7, end: 7 },
        });
    });
    (0, bun_test_1.test)("treats legacy ranges as matching either old or new", () => {
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("42")).toEqual({
            old: { start: 42, end: 42 },
            new: { start: 42, end: 42 },
        });
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("42-45")).toEqual({
            old: { start: 42, end: 45 },
            new: { start: 42, end: 45 },
        });
    });
    (0, bun_test_1.test)("returns null for empty/invalid ranges", () => {
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("")).toBeNull();
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)(" ")).toBeNull();
        (0, bun_test_1.expect)((0, review_1.parseReviewLineRange)("nope")).toBeNull();
    });
});
//# sourceMappingURL=review.lineRange.test.js.map