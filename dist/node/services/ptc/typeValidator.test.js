"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const zod_1 = require("zod");
const typeValidator_1 = require("./typeValidator");
const typeGenerator_1 = require("./typeGenerator");
/**
 * Create a mock tool with the given schema.
 */
function createMockTool(schema) {
    return {
        description: "Mock tool",
        inputSchema: schema,
        execute: () => Promise.resolve({ success: true }),
    };
}
(0, bun_test_1.describe)("validateTypes", () => {
    let muxTypes;
    // Generate types once for all tests
    (0, bun_test_1.beforeAll)(async () => {
        const tools = {
            file_read: createMockTool(zod_1.z.object({
                filePath: zod_1.z.string(),
                offset: zod_1.z.number().optional(),
                limit: zod_1.z.number().optional(),
            })),
            bash: createMockTool(zod_1.z.object({
                script: zod_1.z.string(),
                timeout_secs: zod_1.z.number(),
                run_in_background: zod_1.z.boolean(),
                display_name: zod_1.z.string(),
            })),
        };
        muxTypes = await (0, typeGenerator_1.generateMuxTypes)(tools);
    });
    (0, bun_test_1.test)("accepts valid code with correct property names", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      const content =unix.file_read({ filePath: "test.txt" });
      return content.success;
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
        (0, bun_test_1.expect)(result.errors).toHaveLength(0);
    });
    (0, bun_test_1.test)("accepts code using optional properties", () => {
        const result = (0, typeValidator_1.validateTypes)(`
     unix.file_read({ filePath: "test.txt", offset: 10, limit: 50 });
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("catches wrong property name", () => {
        const result = (0, typeValidator_1.validateTypes)(`
     unix.file_read({ path: "test.txt" });
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        // Error should mention 'path' doesn't exist or 'filePath' is missing
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("path") || e.message.includes("filePath"))).toBe(true);
    });
    (0, bun_test_1.test)("catches missing required property", () => {
        const result = (0, typeValidator_1.validateTypes)(`
     unix.bash({ script: "ls" });
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        // Should error on missing required props
        (0, bun_test_1.expect)(result.errors.length).toBeGreaterThan(0);
    });
    (0, bun_test_1.test)("catches wrong type for property", () => {
        const result = (0, typeValidator_1.validateTypes)(`
     unix.file_read({ filePath: 123 });
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("number") || e.message.includes("string"))).toBe(true);
    });
    (0, bun_test_1.test)("catches calling non-existent tool", () => {
        const result = (0, typeValidator_1.validateTypes)(`
     unix.nonexistent_tool({ foo: "bar" });
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("nonexistent_tool"))).toBe(true);
    });
    (0, bun_test_1.test)("returns line numbers for type errors", () => {
        const result = (0, typeValidator_1.validateTypes)(`const x = 1;
const y = 2;
unix.file_read({ path: "test.txt" });`, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        // Error should be on line 3 (the unix.file_read call)
        const errorWithLine = result.errors.find((e) => e.line !== undefined);
        (0, bun_test_1.expect)(errorWithLine).toBeDefined();
        (0, bun_test_1.expect)(errorWithLine.line).toBe(3);
    });
    (0, bun_test_1.test)("returns line 1 for error on first line", () => {
        const result = (0, typeValidator_1.validateTypes)(`unix.file_read({ path: "test.txt" });`, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        const errorWithLine = result.errors.find((e) => e.line !== undefined);
        (0, bun_test_1.expect)(errorWithLine).toBeDefined();
        (0, bun_test_1.expect)(errorWithLine.line).toBe(1);
    });
    (0, bun_test_1.test)("returns correct line for error on last line of multi-line code", () => {
        const result = (0, typeValidator_1.validateTypes)(`const a = 1;
const b = 2;
const c = 3;
const d = 4;
unix.file_read({ path: "wrong" });`, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        const errorWithLine = result.errors.find((e) => e.line !== undefined);
        (0, bun_test_1.expect)(errorWithLine).toBeDefined();
        (0, bun_test_1.expect)(errorWithLine.line).toBe(5);
    });
    (0, bun_test_1.test)("returns column number for type errors", () => {
        // Column should point to the problematic property
        const result = (0, typeValidator_1.validateTypes)(`unix.file_read({ path: "test.txt" });`, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        const errorWithLine = result.errors.find((e) => e.column !== undefined);
        (0, bun_test_1.expect)(errorWithLine).toBeDefined();
        (0, bun_test_1.expect)(errorWithLine.column).toBeGreaterThan(0);
    });
    (0, bun_test_1.test)("allows dynamic property access (no strict checking on unknown keys)", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      const result =unix.file_read({ filePath: "test.txt" });
      const key = "content";
      console.log(result[key]);
    `, muxTypes);
        // This should pass - we don't enforce strict property checking on results
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("allows console.log/warn/error", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      console.log("hello");
      console.warn("warning");
      console.error("error");
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("allows dynamic properties on empty object literals", () => {
        // Claude frequently uses this pattern to collate parallel reads
        const result = (0, typeValidator_1.validateTypes)(`
      const results = {};
      results.file1 =unix.file_read({ filePath: "a.txt" });
      results.file2 =unix.file_read({ filePath: "b.txt" });
      return results;
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("still catches unix tool typos", () => {
        // Must not filter errors for typos on the unix namespace
        const result = (0, typeValidator_1.validateTypes)(`
     unix.file_reade({ filePath: "test.txt" });
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("file_reade"))).toBe(true);
    });
    (0, bun_test_1.test)("catches reads from empty object literals (typos)", () => {
        // Reads from {} should still error - only writes are allowed
        const result = (0, typeValidator_1.validateTypes)(`
      const results = {};
      results.file1 =unix.file_read({ filePath: "a.txt" });
      return results.filee1;  // typo: should be file1
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("filee1"))).toBe(true);
    });
    (0, bun_test_1.test)("catches empty object properties used in tool args", () => {
        // Using unset properties from {} in tool calls should error
        const result = (0, typeValidator_1.validateTypes)(`
      const config = {};
     unix.file_read({ filePath: config.path });  // config.path doesn't exist
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("path"))).toBe(true);
    });
    (0, bun_test_1.test)("catches empty object reads in expressions", () => {
        // Reading from {} in any expression context should error
        const result = (0, typeValidator_1.validateTypes)(`
      const obj = {};
      const x = obj.value + 1;  // obj.value doesn't exist
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("value"))).toBe(true);
    });
    (0, bun_test_1.test)("catches empty object reads in conditionals", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      const obj = {};
      if (obj.flag) { console.log("yes"); }  // obj.flag doesn't exist
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("flag"))).toBe(true);
    });
    (0, bun_test_1.test)("allows multiple writes to empty object", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      const data = {};
      data.a = 1;
      data.b = 2;
      data.c =unix.file_read({ filePath: "test.txt" });
      data.d = "string";
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("catches compound assignment on empty object (+=)", () => {
        // Compound assignments read then write, so should error
        const result = (0, typeValidator_1.validateTypes)(`
      const obj = {};
      obj.count += 1;  // reads obj.count first
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.some((e) => e.message.includes("count"))).toBe(true);
    });
    (0, bun_test_1.test)("accepts ES2021+ features (replaceAll, at, etc.)", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      const str = "a-b-c".replaceAll("-", "_");
      const arr = [1, 2, 3];
      const last = arr.at(-1);
      const hasA = Object.hasOwn({ a: 1 }, "a");
      return { str, last, hasA };
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("allows discriminated union narrowing with negation (!result.success)", () => {
        // This is the idiomatic pattern for handling Result types
        const result = (0, typeValidator_1.validateTypes)(`
      const result =unix.file_read({ filePath: "test.txt" });
      if (!result.success) {
        console.log(result.error);  // Should be allowed after narrowing
        return { error: result.error };
      }
      return { content: result.content };
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("allows discriminated union narrowing with === false", () => {
        const result = (0, typeValidator_1.validateTypes)(`
      const result =unix.file_read({ filePath: "test.txt" });
      if (result.success === false) {
        console.log(result.error);
        return null;
      }
      return result.content;
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(true);
    });
    (0, bun_test_1.test)("catches syntax error gracefully", () => {
        const result = (0, typeValidator_1.validateTypes)(`
     unix.file_read({ filePath: "test.txt" // missing closing brace
    `, muxTypes);
        (0, bun_test_1.expect)(result.valid).toBe(false);
        (0, bun_test_1.expect)(result.errors.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=typeValidator.test.js.map