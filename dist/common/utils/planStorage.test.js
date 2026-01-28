"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const planStorage_1 = require("./planStorage");
describe("planStorage", () => {
    // Plan paths use tilde prefix for portability across local/remote runtimes
    const expectedUnixHome = "~/.unix";
    describe("getPlanFilePath", () => {
        it("should return path with project name and workspace name", () => {
            const result = (0, planStorage_1.getPlanFilePath)("fix-plan-a1b2", "unix");
            expect(result).toBe(`${expectedUnixHome}/plans/unix/fix-plan-a1b2.md`);
        });
        it("should produce same path for same inputs", () => {
            const result1 = (0, planStorage_1.getPlanFilePath)("fix-bug-x1y2", "myproject");
            const result2 = (0, planStorage_1.getPlanFilePath)("fix-bug-x1y2", "myproject");
            expect(result1).toBe(result2);
        });
        it("should organize plans by project folder", () => {
            const result1 = (0, planStorage_1.getPlanFilePath)("sidebar-a1b2", "unix");
            const result2 = (0, planStorage_1.getPlanFilePath)("auth-c3d4", "other-project");
            expect(result1).toBe(`${expectedUnixHome}/plans/unix/sidebar-a1b2.md`);
            expect(result2).toBe(`${expectedUnixHome}/plans/other-project/auth-c3d4.md`);
        });
        it("should use custom unixHome when provided (Docker uses /var/unix)", () => {
            const result = (0, planStorage_1.getPlanFilePath)("fix-plan-a1b2", "unix", "/var/unix");
            expect(result).toBe("/var/unix/plans/unix/fix-plan-a1b2.md");
        });
        it("should default to ~/.unix when unixHome not provided", () => {
            const withDefault = (0, planStorage_1.getPlanFilePath)("workspace", "project");
            const withExplicit = (0, planStorage_1.getPlanFilePath)("workspace", "project", "~/.unix");
            expect(withDefault).toBe(withExplicit);
        });
    });
    describe("getLegacyPlanFilePath", () => {
        it("should return path with workspace ID", () => {
            const result = (0, planStorage_1.getLegacyPlanFilePath)("a1b2c3d4e5");
            expect(result).toBe(`${expectedUnixHome}/plans/a1b2c3d4e5.md`);
        });
        it("should handle legacy format IDs", () => {
            const result = (0, planStorage_1.getLegacyPlanFilePath)("unix-main");
            expect(result).toBe(`${expectedUnixHome}/plans/unix-main.md`);
        });
    });
});
//# sourceMappingURL=planStorage.test.js.map