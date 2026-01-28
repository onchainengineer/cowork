"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const hasher_1 = require("../../../common/utils/hasher");
const mcpToolName_1 = require("./mcpToolName");
(0, bun_test_1.describe)("mcpToolName", () => {
    (0, bun_test_1.describe)("normalizeMcpToolNamePart", () => {
        (0, bun_test_1.test)("lowercases and replaces spaces with underscores", () => {
            (0, bun_test_1.expect)((0, mcpToolName_1.normalizeMcpToolNamePart)("Chrome DevTools")).toBe("chrome_devtools");
        });
        (0, bun_test_1.test)("treats non-alphanumeric characters as separators", () => {
            (0, bun_test_1.expect)((0, mcpToolName_1.normalizeMcpToolNamePart)("chrome-devtools/mcp")).toBe("chrome_devtools_mcp");
        });
        (0, bun_test_1.test)("falls back to 'unknown' when nothing is left after sanitization", () => {
            (0, bun_test_1.expect)((0, mcpToolName_1.normalizeMcpToolNamePart)("!!!")).toBe("unknown");
        });
    });
    (0, bun_test_1.describe)("buildMcpToolName", () => {
        (0, bun_test_1.test)("builds a stable base name for provider-safe MCP tools", () => {
            const usedNames = new Set();
            const result = (0, mcpToolName_1.buildMcpToolName)({
                serverName: "Chrome DevTools",
                toolName: "click",
                usedNames,
            });
            (0, bun_test_1.expect)(result).toEqual({
                toolName: "chrome_devtools_click",
                baseName: "chrome_devtools_click",
                wasSuffixed: false,
            });
        });
        (0, bun_test_1.test)("adds a stable suffix on collision", () => {
            const usedNames = new Set();
            const first = (0, mcpToolName_1.buildMcpToolName)({ serverName: "foo bar", toolName: "baz", usedNames });
            (0, bun_test_1.expect)(first).toBeDefined();
            (0, bun_test_1.expect)(first.toolName).toBe("foo_bar_baz");
            (0, bun_test_1.expect)(first.wasSuffixed).toBe(false);
            const second = (0, mcpToolName_1.buildMcpToolName)({ serverName: "foo_bar", toolName: "baz", usedNames });
            (0, bun_test_1.expect)(second).toBeDefined();
            (0, bun_test_1.expect)(second.baseName).toBe("foo_bar_baz");
            (0, bun_test_1.expect)(second.wasSuffixed).toBe(true);
            const expectedSuffix = (0, hasher_1.uniqueSuffix)(["foo_bar", "baz"]);
            (0, bun_test_1.expect)(second.toolName).toBe(`foo_bar_baz_${expectedSuffix}`);
        });
        (0, bun_test_1.test)("enforces the 64 character limit via truncation + suffix", () => {
            const usedNames = new Set();
            const serverName = "a".repeat(60);
            const toolName = "b".repeat(10);
            const result = (0, mcpToolName_1.buildMcpToolName)({ serverName, toolName, usedNames });
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.wasSuffixed).toBe(true);
            (0, bun_test_1.expect)(result.toolName.length).toBe(64);
            const expectedSuffix = (0, hasher_1.uniqueSuffix)([serverName, toolName]);
            (0, bun_test_1.expect)(result.toolName.endsWith(`_${expectedSuffix}`)).toBe(true);
            (0, bun_test_1.expect)(result.toolName).toMatch(/^[a-z0-9_]+$/);
        });
    });
});
//# sourceMappingURL=mcpToolName.test.js.map