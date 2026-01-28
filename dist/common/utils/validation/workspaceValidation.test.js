"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workspaceValidation_1 = require("./workspaceValidation");
describe("validateWorkspaceName", () => {
    describe("valid names", () => {
        test("accepts lowercase letters", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("main").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("feature").valid).toBe(true);
        });
        test("accepts digits", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch123").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("123").valid).toBe(true);
        });
        test("accepts underscores", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("my_branch").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("feature_test_123").valid).toBe(true);
        });
        test("accepts hyphens", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("my-branch").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("feature-test-123").valid).toBe(true);
        });
        test("accepts combinations", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("feature-branch_123").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("a1-b2_c3").valid).toBe(true);
        });
        test("accepts single character", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("a").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("1").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("_").valid).toBe(true);
            expect((0, workspaceValidation_1.validateWorkspaceName)("-").valid).toBe(true);
        });
        test("accepts 64 characters", () => {
            const name = "a".repeat(64);
            expect((0, workspaceValidation_1.validateWorkspaceName)(name).valid).toBe(true);
        });
    });
    describe("invalid names", () => {
        test("rejects empty string", () => {
            const result = (0, workspaceValidation_1.validateWorkspaceName)("");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("empty");
        });
        test("rejects names over 64 characters", () => {
            const name = "a".repeat(65);
            const result = (0, workspaceValidation_1.validateWorkspaceName)(name);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("64 characters");
        });
        test("rejects uppercase letters", () => {
            const result = (0, workspaceValidation_1.validateWorkspaceName)("MyBranch");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("a-z");
        });
        test("rejects spaces", () => {
            const result = (0, workspaceValidation_1.validateWorkspaceName)("my branch");
            expect(result.valid).toBe(false);
        });
        test("rejects special characters", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch@123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch#123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch$123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch%123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch!123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch.123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch/123").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("branch\\123").valid).toBe(false);
        });
        test("rejects names with slashes", () => {
            expect((0, workspaceValidation_1.validateWorkspaceName)("feature/branch").valid).toBe(false);
            expect((0, workspaceValidation_1.validateWorkspaceName)("path\\to\\branch").valid).toBe(false);
        });
    });
});
//# sourceMappingURL=workspaceValidation.test.js.map