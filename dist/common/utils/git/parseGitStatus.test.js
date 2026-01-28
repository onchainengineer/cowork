"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseGitStatus_1 = require("./parseGitStatus");
// Base result shape with zero line deltas (parseGitRevList doesn't compute these)
const base = {
    dirty: false,
    outgoingAdditions: 0,
    outgoingDeletions: 0,
    incomingAdditions: 0,
    incomingDeletions: 0,
};
describe("parseGitRevList", () => {
    test("parses valid ahead and behind counts", () => {
        expect((0, parseGitStatus_1.parseGitRevList)("5\t3")).toEqual({ ...base, ahead: 5, behind: 3 });
        expect((0, parseGitStatus_1.parseGitRevList)("0\t0")).toEqual({ ...base, ahead: 0, behind: 0 });
        expect((0, parseGitStatus_1.parseGitRevList)("10\t0")).toEqual({ ...base, ahead: 10, behind: 0 });
        expect((0, parseGitStatus_1.parseGitRevList)("0\t7")).toEqual({ ...base, ahead: 0, behind: 7 });
    });
    test("handles whitespace variations", () => {
        expect((0, parseGitStatus_1.parseGitRevList)("  5\t3  ")).toEqual({ ...base, ahead: 5, behind: 3 });
        expect((0, parseGitStatus_1.parseGitRevList)("5  3")).toEqual({ ...base, ahead: 5, behind: 3 });
        expect((0, parseGitStatus_1.parseGitRevList)("5   3")).toEqual({ ...base, ahead: 5, behind: 3 });
    });
    test("returns null for invalid formats", () => {
        expect((0, parseGitStatus_1.parseGitRevList)("")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("5")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("5\t3\t1")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("abc\tdef")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("5\tabc")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("abc\t3")).toBe(null);
    });
    test("returns null for empty or whitespace-only input", () => {
        expect((0, parseGitStatus_1.parseGitRevList)("")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("   ")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("\n")).toBe(null);
        expect((0, parseGitStatus_1.parseGitRevList)("\t")).toBe(null);
    });
});
//# sourceMappingURL=parseGitStatus.test.js.map