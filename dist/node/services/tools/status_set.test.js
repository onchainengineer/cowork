"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const status_set_1 = require("./status_set");
const runtimeFactory_1 = require("../../../node/runtime/runtimeFactory");
const toolLimits_1 = require("../../../common/constants/toolLimits");
(0, bun_test_1.describe)("status_set tool validation", () => {
    const mockConfig = {
        cwd: "/test",
        runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
        runtimeTempDir: "/tmp",
        workspaceId: "test-workspace",
    };
    const mockToolCallOptions = {
        toolCallId: "test-call-id",
        messages: [],
    };
    (0, bun_test_1.describe)("emoji validation", () => {
        (0, bun_test_1.it)("should accept single emoji characters", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const emojis = ["🔍", "📝", "✅", "🚀", "⏳"];
            for (const emoji of emojis) {
                const result = (await tool.execute({ emoji, message: "Test" }, mockToolCallOptions));
                (0, bun_test_1.expect)(result).toEqual({ success: true, emoji, message: "Test" });
            }
        });
        (0, bun_test_1.it)("should accept emojis with variation selectors", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            // Emojis with variation selectors (U+FE0F)
            const emojis = ["✏️", "✅", "➡️", "☀️"];
            for (const emoji of emojis) {
                const result = (await tool.execute({ emoji, message: "Test" }, mockToolCallOptions));
                (0, bun_test_1.expect)(result).toEqual({ success: true, emoji, message: "Test" });
            }
        });
        (0, bun_test_1.it)("should accept emojis with skin tone modifiers", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const emojis = ["👋🏻", "👋🏽", "👋🏿"];
            for (const emoji of emojis) {
                const result = (await tool.execute({ emoji, message: "Test" }, mockToolCallOptions));
                (0, bun_test_1.expect)(result).toEqual({ success: true, emoji, message: "Test" });
            }
        });
        (0, bun_test_1.it)("should reject multiple emojis", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result1 = (await tool.execute({ emoji: "🔍📝", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result1.success).toBe(false);
            (0, bun_test_1.expect)(result1.error).toBe("emoji must be a single emoji character");
            const result2 = (await tool.execute({ emoji: "✅✅", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result2.success).toBe(false);
            (0, bun_test_1.expect)(result2.error).toBe("emoji must be a single emoji character");
        });
        (0, bun_test_1.it)("should reject text (non-emoji)", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result1 = (await tool.execute({ emoji: "a", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result1.success).toBe(false);
            (0, bun_test_1.expect)(result1.error).toBe("emoji must be a single emoji character");
            const result2 = (await tool.execute({ emoji: "abc", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result2.success).toBe(false);
            (0, bun_test_1.expect)(result2.error).toBe("emoji must be a single emoji character");
            const result3 = (await tool.execute({ emoji: "!", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result3.success).toBe(false);
            (0, bun_test_1.expect)(result3.error).toBe("emoji must be a single emoji character");
        });
        (0, bun_test_1.it)("should reject empty emoji", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result = (await tool.execute({ emoji: "", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            (0, bun_test_1.expect)(result.error).toBe("emoji must be a single emoji character");
        });
        (0, bun_test_1.it)("should reject emoji with text", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result1 = (await tool.execute({ emoji: "🔍a", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result1.success).toBe(false);
            (0, bun_test_1.expect)(result1.error).toBe("emoji must be a single emoji character");
            const result2 = (await tool.execute({ emoji: "x🔍", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result2.success).toBe(false);
            (0, bun_test_1.expect)(result2.error).toBe("emoji must be a single emoji character");
        });
    });
    (0, bun_test_1.describe)("message validation", () => {
        (0, bun_test_1.it)(`should accept messages up to ${toolLimits_1.STATUS_MESSAGE_MAX_LENGTH} characters`, async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result1 = (await tool.execute({ emoji: "✅", message: "a".repeat(toolLimits_1.STATUS_MESSAGE_MAX_LENGTH) }, mockToolCallOptions));
            (0, bun_test_1.expect)(result1.success).toBe(true);
            (0, bun_test_1.expect)(result1.message).toBe("a".repeat(toolLimits_1.STATUS_MESSAGE_MAX_LENGTH));
            const result2 = (await tool.execute({ emoji: "✅", message: "Analyzing code structure" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result2.success).toBe(true);
        });
        (0, bun_test_1.it)(`should truncate messages longer than ${toolLimits_1.STATUS_MESSAGE_MAX_LENGTH} characters with ellipsis`, async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            // Test with MAX_LENGTH + 1 characters
            const result1 = (await tool.execute({ emoji: "✅", message: "a".repeat(toolLimits_1.STATUS_MESSAGE_MAX_LENGTH + 1) }, mockToolCallOptions));
            (0, bun_test_1.expect)(result1.success).toBe(true);
            (0, bun_test_1.expect)(result1.message).toBe("a".repeat(toolLimits_1.STATUS_MESSAGE_MAX_LENGTH - 1) + "…");
            (0, bun_test_1.expect)(result1.message.length).toBe(toolLimits_1.STATUS_MESSAGE_MAX_LENGTH);
            // Test with longer message
            const longMessage = "This is a very long message that exceeds the 60 character limit and should be truncated";
            const result2 = (await tool.execute({ emoji: "✅", message: longMessage }, mockToolCallOptions));
            (0, bun_test_1.expect)(result2.success).toBe(true);
            (0, bun_test_1.expect)(result2.message).toBe(longMessage.slice(0, toolLimits_1.STATUS_MESSAGE_MAX_LENGTH - 1) + "…");
            (0, bun_test_1.expect)(result2.message.length).toBe(toolLimits_1.STATUS_MESSAGE_MAX_LENGTH);
        });
        (0, bun_test_1.it)("should accept empty message", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result = (await tool.execute({ emoji: "✅", message: "" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
        });
    });
    (0, bun_test_1.describe)("url parameter", () => {
        (0, bun_test_1.it)("should accept valid URLs", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const validUrls = [
                "https://github.com/owner/repo/pull/123",
                "http://example.com",
                "https://example.com/path/to/resource?query=param",
            ];
            for (const url of validUrls) {
                const result = (await tool.execute({ emoji: "🔍", message: "Test", url }, mockToolCallOptions));
                (0, bun_test_1.expect)(result.success).toBe(true);
                (0, bun_test_1.expect)(result.url).toBe(url);
            }
        });
        (0, bun_test_1.it)("should work without URL parameter", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result = (await tool.execute({ emoji: "✅", message: "Test" }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)(result.url).toBeUndefined();
        });
        (0, bun_test_1.it)("should omit URL from result when undefined", async () => {
            const tool = (0, status_set_1.createStatusSetTool)(mockConfig);
            const result = (await tool.execute({ emoji: "✅", message: "Test", url: undefined }, mockToolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            (0, bun_test_1.expect)("url" in result).toBe(false);
        });
    });
});
//# sourceMappingURL=status_set.test.js.map