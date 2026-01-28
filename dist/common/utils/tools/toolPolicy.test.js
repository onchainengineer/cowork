"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const toolPolicy_1 = require("./toolPolicy");
const ai_1 = require("ai");
const zod_1 = require("zod");
// Create mock tools for testing
const mockTools = {
    bash: (0, ai_1.tool)({
        description: "Execute bash commands",
        inputSchema: zod_1.z.object({ command: zod_1.z.string() }),
        execute: () => Promise.resolve({ output: "test" }),
    }),
    file_read: (0, ai_1.tool)({
        description: "Read files",
        inputSchema: zod_1.z.object({ path: zod_1.z.string() }),
        execute: () => Promise.resolve({ content: "test" }),
    }),
    file_edit_replace_string: (0, ai_1.tool)({
        description: "Replace content in files using string matching",
        inputSchema: zod_1.z.object({ path: zod_1.z.string(), old_string: zod_1.z.string() }),
        execute: () => Promise.resolve({ success: true }),
    }),
    file_edit_replace_lines: (0, ai_1.tool)({
        description: "Replace content in files using line ranges",
        inputSchema: zod_1.z.object({ path: zod_1.z.string(), start_line: zod_1.z.number() }),
        execute: () => Promise.resolve({ success: true }),
    }),
    file_edit_insert: (0, ai_1.tool)({
        description: "Insert content in files",
        inputSchema: zod_1.z.object({ path: zod_1.z.string() }),
        execute: () => Promise.resolve({ success: true }),
    }),
    web_search: (0, ai_1.tool)({
        description: "Search the web",
        inputSchema: zod_1.z.object({ query: zod_1.z.string() }),
        execute: () => Promise.resolve({ results: [] }),
    }),
};
describe("applyToolPolicy", () => {
    describe("default behavior", () => {
        test("allows all tools when no policy provided", () => {
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools);
            expect(Object.keys(result)).toEqual(Object.keys(mockTools));
        });
        test("allows all tools when policy is empty array", () => {
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, []);
            expect(Object.keys(result)).toEqual(Object.keys(mockTools));
        });
    });
    describe("disabling specific tools", () => {
        test("disables bash tool", () => {
            const policy = [{ regex_match: "bash", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.bash).toBeUndefined();
            expect(result.file_read).toBeDefined();
            expect(result.file_edit_replace_string).toBeDefined();
            expect(result.file_edit_replace_lines).toBeDefined();
            expect(result.file_edit_insert).toBeDefined();
            expect(result.web_search).toBeDefined();
        });
        test("disables multiple specific tools", () => {
            const policy = [
                { regex_match: "bash", action: "disable" },
                { regex_match: "web_search", action: "disable" },
            ];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.bash).toBeUndefined();
            expect(result.web_search).toBeUndefined();
            expect(result.file_read).toBeDefined();
            expect(result.file_edit_replace_string).toBeDefined();
            expect(result.file_edit_replace_lines).toBeDefined();
            expect(result.file_edit_insert).toBeDefined();
        });
    });
    describe("regex patterns", () => {
        test("disables all file_edit_.* tools", () => {
            const policy = [{ regex_match: "file_edit_.*", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
            expect(result.bash).toBeDefined();
            expect(result.file_read).toBeDefined();
            expect(result.web_search).toBeDefined();
        });
        test("disables all tools with .* pattern", () => {
            const policy = [{ regex_match: ".*", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(Object.keys(result)).toHaveLength(0);
        });
        test("disables all tools starting with 'file'", () => {
            const policy = [{ regex_match: "file.*", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.file_read).toBeUndefined();
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
            expect(result.bash).toBeDefined();
            expect(result.web_search).toBeDefined();
        });
    });
    describe("enable after disable (order matters)", () => {
        test("disables all tools then enables bash", () => {
            const policy = [
                { regex_match: ".*", action: "disable" },
                { regex_match: "bash", action: "enable" },
            ];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.bash).toBeDefined();
            expect(result.file_read).toBeUndefined();
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
            expect(result.web_search).toBeUndefined();
        });
        test("disables file_edit_.* then enables file_edit_replace_string", () => {
            const policy = [
                { regex_match: "file_edit_.*", action: "disable" },
                { regex_match: "file_edit_replace_string", action: "enable" },
            ];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.file_edit_replace_string).toBeDefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
            expect(result.bash).toBeDefined();
            expect(result.file_read).toBeDefined();
            expect(result.web_search).toBeDefined();
        });
        test("enables bash then disables it (last wins)", () => {
            const policy = [
                { regex_match: "bash", action: "enable" },
                { regex_match: "bash", action: "disable" },
            ];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.bash).toBeUndefined();
        });
    });
    describe("complex scenarios", () => {
        test("Plan Mode: disables file edits, keeps file_read and bash", () => {
            const policy = [{ regex_match: "file_edit_.*", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.file_read).toBeDefined();
            expect(result.bash).toBeDefined();
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
        });
        test("Execute Mode: allows all tools (no policy)", () => {
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools);
            expect(result.bash).toBeDefined();
            expect(result.file_read).toBeDefined();
            expect(result.file_edit_replace_string).toBeDefined();
            expect(result.file_edit_replace_lines).toBeDefined();
            expect(result.file_edit_insert).toBeDefined();
        });
        test("disables all except bash and file_read", () => {
            const policy = [
                { regex_match: ".*", action: "disable" },
                { regex_match: "bash", action: "enable" },
                { regex_match: "file_read", action: "enable" },
            ];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.bash).toBeDefined();
            expect(result.file_read).toBeDefined();
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
            expect(result.web_search).toBeUndefined();
        });
        test("preset policy cannot be overridden by caller", () => {
            const callerPolicy = [{ regex_match: "file_edit_.*", action: "enable" }];
            const presetPolicy = [{ regex_match: "file_edit_.*", action: "disable" }];
            const merged = [...callerPolicy, ...presetPolicy];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, merged);
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
        });
        test("preset policy cannot be overridden by caller require", () => {
            const callerPolicy = [{ regex_match: "bash", action: "require" }];
            const presetPolicy = [{ regex_match: ".*", action: "disable" }];
            const merged = [...callerPolicy, ...presetPolicy];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, merged);
            expect(result.bash).toBeUndefined();
            expect(Object.keys(result)).toHaveLength(0);
        });
    });
    describe("edge cases", () => {
        test("handles empty tools object", () => {
            const policy = [{ regex_match: ".*", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)({}, policy);
            expect(Object.keys(result)).toHaveLength(0);
        });
        test("handles pattern that matches nothing", () => {
            const policy = [{ regex_match: "nonexistent_tool", action: "disable" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(Object.keys(result)).toEqual(Object.keys(mockTools));
        });
    });
    describe("require action", () => {
        test("requires a single tool and disables all others", () => {
            const policy = [{ regex_match: "bash", action: "require" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            expect(result.bash).toBeDefined();
            expect(Object.keys(result)).toHaveLength(1);
            expect(result.file_read).toBeUndefined();
            expect(result.file_edit_replace_string).toBeUndefined();
            expect(result.file_edit_replace_lines).toBeUndefined();
            expect(result.file_edit_insert).toBeUndefined();
            expect(result.web_search).toBeUndefined();
        });
        test("requires tool with regex pattern", () => {
            const policy = [{ regex_match: "file_.*", action: "require" }];
            // This should throw because multiple tools match (file_read, file_edit_replace_string, file_edit_replace_lines, file_edit_insert)
            expect(() => (0, toolPolicy_1.applyToolPolicy)(mockTools, policy)).toThrow(/Multiple tools marked as required/);
        });
        test("requires specific tool with other filters ignored", () => {
            const policy = [
                { regex_match: ".*", action: "disable" },
                { regex_match: "bash", action: "enable" },
                { regex_match: "file_read", action: "require" },
            ];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            // When a tool is required, all other filters are ignored
            expect(result.file_read).toBeDefined();
            expect(Object.keys(result)).toHaveLength(1);
            expect(result.bash).toBeUndefined();
        });
        test("throws error when multiple tools are required", () => {
            const policy = [
                { regex_match: "bash", action: "require" },
                { regex_match: "file_read", action: "require" },
            ];
            expect(() => (0, toolPolicy_1.applyToolPolicy)(mockTools, policy)).toThrow(/Multiple tools marked as required \(bash, file_read\)/);
        });
        test("requires nonexistent tool returns empty result", () => {
            const policy = [{ regex_match: "nonexistent", action: "require" }];
            const result = (0, toolPolicy_1.applyToolPolicy)(mockTools, policy);
            // No tool matches, so no tools are required, fall back to standard logic
            // Since no other filters exist, all tools should be enabled
            expect(Object.keys(result)).toEqual(Object.keys(mockTools));
        });
    });
});
//# sourceMappingURL=toolPolicy.test.js.map