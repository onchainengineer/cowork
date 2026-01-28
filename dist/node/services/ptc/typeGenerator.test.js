"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const zod_1 = require("zod");
const typeGenerator_1 = require("./typeGenerator");
/**
 * Create a mock tool with the given schema and optional execute function.
 */
function createMockTool(schema, hasExecute = true) {
    return {
        description: "Mock tool",
        inputSchema: schema,
        execute: hasExecute ? () => Promise.resolve({ success: true }) : undefined,
    };
}
(0, bun_test_1.describe)("generateMuxTypes", () => {
    (0, bun_test_1.test)("generates interface from tool input schema", async () => {
        const fileReadTool = createMockTool(zod_1.z.object({
            filePath: zod_1.z.string(),
            offset: zod_1.z.number().optional(),
            limit: zod_1.z.number().optional(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ file_read: fileReadTool });
        (0, bun_test_1.expect)(types).toContain("interface FileReadArgs");
        (0, bun_test_1.expect)(types).toContain("filePath: string");
        (0, bun_test_1.expect)(types).toContain("offset?: number");
        (0, bun_test_1.expect)(types).toContain("limit?: number");
    });
    (0, bun_test_1.test)("returns result types directly (not Promise, due to Asyncify)", async () => {
        const fileReadTool = createMockTool(zod_1.z.object({
            filePath: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ file_read: fileReadTool });
        // Asyncify makes async host functions appear synchronous to QuickJS
        (0, bun_test_1.expect)(types).toContain("function file_read(args: FileReadArgs): FileReadResult");
        (0, bun_test_1.expect)(types).not.toContain("Promise<FileReadResult>");
    });
    (0, bun_test_1.test)("generates result type from Zod schema (not hardcoded)", async () => {
        const fileReadTool = createMockTool(zod_1.z.object({
            filePath: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ file_read: fileReadTool });
        // Should include FileReadResult type definition
        (0, bun_test_1.expect)(types).toContain("type FileReadResult =");
        // Should include fields from the actual Zod schema in toolDefinitions.ts
        (0, bun_test_1.expect)(types).toContain("file_size");
        (0, bun_test_1.expect)(types).toContain("modifiedTime");
        (0, bun_test_1.expect)(types).toContain("lines_read");
        (0, bun_test_1.expect)(types).toContain("content");
    });
    (0, bun_test_1.test)("generates discriminated union result types with success: true/false", async () => {
        const bashTool = createMockTool(zod_1.z.object({
            script: zod_1.z.string(),
            timeout_secs: zod_1.z.number(),
            run_in_background: zod_1.z.boolean(),
            display_name: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ bash: bashTool });
        // Should have success branches
        (0, bun_test_1.expect)(types).toContain("success: true");
        (0, bun_test_1.expect)(types).toContain("success: false");
        // Should have discriminated union (multiple object types joined by |)
        (0, bun_test_1.expect)(types).toMatch(/\{[^}]*success: true[^}]*\}[^|]*\|[^{]*\{/);
    });
    (0, bun_test_1.test)("handles MCP tools with MCPCallToolResult", async () => {
        const mcpTool = createMockTool(zod_1.z.object({
            issue_title: zod_1.z.string(),
            issue_body: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ mcp__github__create_issue: mcpTool });
        // MCP tools also return directly (not Promise) due to Asyncify
        (0, bun_test_1.expect)(types).toContain("function mcp__github__create_issue(args: McpGithubCreateIssueArgs): MCPCallToolResult");
        (0, bun_test_1.expect)(types).not.toContain("Promise<MCPCallToolResult>");
        (0, bun_test_1.expect)(types).toContain("type MCPCallToolResult");
        // MCP result type should have content array
        (0, bun_test_1.expect)(types).toContain("content: Array<");
    });
    (0, bun_test_1.test)("only includes MCPCallToolResult when MCP tools present", async () => {
        const fileReadTool = createMockTool(zod_1.z.object({
            filePath: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ file_read: fileReadTool });
        (0, bun_test_1.expect)(types).not.toContain("MCPCallToolResult");
    });
    (0, bun_test_1.test)("handles tools without known result type (returns unknown)", async () => {
        const customTool = createMockTool(zod_1.z.object({
            input: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ custom_tool: customTool });
        (0, bun_test_1.expect)(types).toContain("function custom_tool(args: CustomToolArgs): unknown");
        (0, bun_test_1.expect)(types).not.toContain("Promise<unknown>");
        (0, bun_test_1.expect)(types).not.toContain("CustomToolResult");
    });
    (0, bun_test_1.test)("declares console global", async () => {
        const types = await (0, typeGenerator_1.generateMuxTypes)({});
        (0, bun_test_1.expect)(types).toContain("declare var console");
        (0, bun_test_1.expect)(types).toContain("log(...args: unknown[]): void");
        (0, bun_test_1.expect)(types).toContain("warn(...args: unknown[]): void");
        (0, bun_test_1.expect)(types).toContain("error(...args: unknown[]): void");
    });
    (0, bun_test_1.test)("converts snake_case tool names to PascalCase for types", async () => {
        const tool = createMockTool(zod_1.z.object({
            file_path: zod_1.z.string(),
            old_string: zod_1.z.string(),
            new_string: zod_1.z.string(),
        }));
        const types = await (0, typeGenerator_1.generateMuxTypes)({ file_edit_replace_string: tool });
        (0, bun_test_1.expect)(types).toContain("FileEditReplaceStringArgs");
        (0, bun_test_1.expect)(types).toContain("FileEditReplaceStringResult");
    });
    (0, bun_test_1.test)("sorts tools alphabetically for deterministic output", async () => {
        const tools = {
            z_last: createMockTool(zod_1.z.object({ x: zod_1.z.string() })),
            a_first: createMockTool(zod_1.z.object({ y: zod_1.z.string() })),
            m_middle: createMockTool(zod_1.z.object({ z: zod_1.z.string() })),
        };
        const types = await (0, typeGenerator_1.generateMuxTypes)(tools);
        // Find positions of each function declaration
        const aPos = types.indexOf("function a_first");
        const mPos = types.indexOf("function m_middle");
        const zPos = types.indexOf("function z_last");
        (0, bun_test_1.expect)(aPos).toBeLessThan(mPos);
        (0, bun_test_1.expect)(mPos).toBeLessThan(zPos);
    });
    (0, bun_test_1.test)("generates all bridgeable tool types correctly", async () => {
        // Test all 8 bridgeable tools have proper result types
        const tools = {
            bash: createMockTool(zod_1.z.object({ script: zod_1.z.string() })),
            bash_output: createMockTool(zod_1.z.object({ process_id: zod_1.z.string() })),
            bash_background_list: createMockTool(zod_1.z.object({})),
            bash_background_terminate: createMockTool(zod_1.z.object({ process_id: zod_1.z.string() })),
            file_read: createMockTool(zod_1.z.object({ filePath: zod_1.z.string() })),
            file_edit_insert: createMockTool(zod_1.z.object({ file_path: zod_1.z.string() })),
            file_edit_replace_string: createMockTool(zod_1.z.object({ file_path: zod_1.z.string() })),
            web_fetch: createMockTool(zod_1.z.object({ url: zod_1.z.string() })),
        };
        const types = await (0, typeGenerator_1.generateMuxTypes)(tools);
        // All should have result types (not unknown)
        (0, bun_test_1.expect)(types).toContain("BashResult");
        (0, bun_test_1.expect)(types).toContain("BashOutputResult");
        (0, bun_test_1.expect)(types).toContain("BashBackgroundListResult");
        (0, bun_test_1.expect)(types).toContain("BashBackgroundTerminateResult");
        (0, bun_test_1.expect)(types).toContain("FileReadResult");
        (0, bun_test_1.expect)(types).toContain("FileEditInsertResult");
        (0, bun_test_1.expect)(types).toContain("FileEditReplaceStringResult");
        (0, bun_test_1.expect)(types).toContain("WebFetchResult");
        // None should be unknown (no Promise since Asyncify makes calls sync)
        (0, bun_test_1.expect)(types).not.toContain("function bash(args: BashArgs): unknown");
        (0, bun_test_1.expect)(types).not.toContain("function file_read(args: FileReadArgs): unknown");
    });
    (0, bun_test_1.test)("handles JSON Schema input (MCP tools)", async () => {
        // MCP tools come with JSON Schema, not Zod
        const mcpTool = {
            description: "Mock MCP tool",
            parameters: {
                type: "object",
                properties: {
                    repo: { type: "string" },
                    owner: { type: "string" },
                },
                required: ["repo", "owner"],
            },
            execute: () => Promise.resolve({ content: [] }),
        };
        const types = await (0, typeGenerator_1.generateMuxTypes)({ mcp__github__list_repos: mcpTool });
        (0, bun_test_1.expect)(types).toContain("interface McpGithubListReposArgs");
        (0, bun_test_1.expect)(types).toContain("repo: string");
        (0, bun_test_1.expect)(types).toContain("owner: string");
    });
    (0, bun_test_1.test)("handles empty tool set", async () => {
        const types = await (0, typeGenerator_1.generateMuxTypes)({});
        (0, bun_test_1.expect)(types).toContain("declare namespace unix {");
        (0, bun_test_1.expect)(types).toContain("}");
        (0, bun_test_1.expect)(types).toContain("declare var console");
    });
});
(0, bun_test_1.describe)("getCachedMuxTypes", () => {
    (0, bun_test_1.beforeEach)(() => {
        (0, typeGenerator_1.clearTypeCache)();
    });
    (0, bun_test_1.test)("invalidates cache when tool schema changes", async () => {
        const toolV1 = createMockTool(zod_1.z.object({ name: zod_1.z.string() }));
        const toolV2 = createMockTool(zod_1.z.object({ name: zod_1.z.string(), age: zod_1.z.number() }));
        const types1 = await (0, typeGenerator_1.getCachedMuxTypes)({ my_tool: toolV1 });
        (0, bun_test_1.expect)(types1).toContain("name: string");
        (0, bun_test_1.expect)(types1).not.toContain("age");
        // Same tool name, different schema - should regenerate
        const types2 = await (0, typeGenerator_1.getCachedMuxTypes)({ my_tool: toolV2 });
        (0, bun_test_1.expect)(types2).toContain("name: string");
        (0, bun_test_1.expect)(types2).toContain("age: number");
    });
    (0, bun_test_1.test)("invalidates cache when tool description changes", async () => {
        const tool1 = {
            description: "Version 1",
            inputSchema: zod_1.z.object({ x: zod_1.z.string() }),
            execute: () => Promise.resolve({ success: true }),
        };
        const tool2 = {
            description: "Version 2",
            inputSchema: zod_1.z.object({ x: zod_1.z.string() }),
            execute: () => Promise.resolve({ success: true }),
        };
        const types1 = await (0, typeGenerator_1.getCachedMuxTypes)({ my_tool: tool1 });
        (0, bun_test_1.expect)(types1).toContain("Version 1");
        const types2 = await (0, typeGenerator_1.getCachedMuxTypes)({ my_tool: tool2 });
        (0, bun_test_1.expect)(types2).toContain("Version 2");
    });
    (0, bun_test_1.test)("returns cached types when tools are identical", async () => {
        const tool = createMockTool(zod_1.z.object({ value: zod_1.z.string() }));
        const types1 = await (0, typeGenerator_1.getCachedMuxTypes)({ my_tool: tool });
        const types2 = await (0, typeGenerator_1.getCachedMuxTypes)({ my_tool: tool });
        // Should be the exact same object reference (cached)
        (0, bun_test_1.expect)(types1).toBe(types2);
    });
});
//# sourceMappingURL=typeGenerator.test.js.map