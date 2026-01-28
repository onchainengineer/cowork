"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const mcpResultTransform_1 = require("./mcpResultTransform");
(0, bun_test_1.describe)("transformMCPResult", () => {
    (0, bun_test_1.describe)("image data overflow handling", () => {
        (0, bun_test_1.it)("should pass through small images unchanged", () => {
            const smallImageData = "a".repeat(1000); // 1KB of base64 data
            const result = (0, mcpResultTransform_1.transformMCPResult)({
                content: [
                    { type: "text", text: "Screenshot taken" },
                    { type: "image", data: smallImageData, mimeType: "image/png" },
                ],
            });
            (0, bun_test_1.expect)(result).toEqual({
                type: "content",
                value: [
                    { type: "text", text: "Screenshot taken" },
                    { type: "media", data: smallImageData, mediaType: "image/png" },
                ],
            });
        });
        (0, bun_test_1.it)("should omit large image data to prevent context overflow", () => {
            // Create a large base64 string that simulates a screenshot
            // Even 50KB of base64 would be ~12,500 tokens when treated as text
            const largeImageData = "x".repeat(mcpResultTransform_1.MAX_IMAGE_DATA_BYTES + 10_000);
            const result = (0, mcpResultTransform_1.transformMCPResult)({
                content: [
                    { type: "text", text: "Screenshot taken" },
                    { type: "image", data: largeImageData, mimeType: "image/png" },
                ],
            });
            const transformed = result;
            (0, bun_test_1.expect)(transformed.type).toBe("content");
            (0, bun_test_1.expect)(transformed.value).toHaveLength(2);
            (0, bun_test_1.expect)(transformed.value[0]).toEqual({ type: "text", text: "Screenshot taken" });
            // The image should be replaced with a text message explaining why it was omitted
            const imageResult = transformed.value[1];
            (0, bun_test_1.expect)(imageResult.type).toBe("text");
            (0, bun_test_1.expect)(imageResult.text).toContain("Image omitted");
            (0, bun_test_1.expect)(imageResult.text).toContain("per-image guard");
        });
        (0, bun_test_1.it)("should handle multiple images, omitting only the oversized ones", () => {
            const smallImageData = "small".repeat(100);
            const largeImageData = "x".repeat(mcpResultTransform_1.MAX_IMAGE_DATA_BYTES + 5_000);
            const result = (0, mcpResultTransform_1.transformMCPResult)({
                content: [
                    { type: "image", data: smallImageData, mimeType: "image/png" },
                    { type: "image", data: largeImageData, mimeType: "image/jpeg" },
                ],
            });
            const transformed = result;
            (0, bun_test_1.expect)(transformed.value).toHaveLength(2);
            // Small image passes through
            (0, bun_test_1.expect)(transformed.value[0]).toEqual({
                type: "media",
                data: smallImageData,
                mediaType: "image/png",
            });
            // Large image gets omitted with explanation
            (0, bun_test_1.expect)(transformed.value[1].type).toBe("text");
            (0, bun_test_1.expect)(transformed.value[1].text).toContain("Image omitted");
        });
        (0, bun_test_1.it)("should mention size and guard limit in omission message", () => {
            // 100KB of base64 data should trigger the guard if limit is smaller, but we keep it big here
            const largeImageData = "y".repeat(mcpResultTransform_1.MAX_IMAGE_DATA_BYTES + 1_000);
            const result = (0, mcpResultTransform_1.transformMCPResult)({
                content: [{ type: "image", data: largeImageData, mimeType: "image/png" }],
            });
            const transformed = result;
            (0, bun_test_1.expect)(transformed.value[0].type).toBe("text");
            // Should mention size and guard
            (0, bun_test_1.expect)(transformed.value[0].text).toMatch(/Image omitted/);
            (0, bun_test_1.expect)(transformed.value[0].text).toMatch(/per-image guard/i);
            (0, bun_test_1.expect)(transformed.value[0].text).toMatch(/MB|KB/);
        });
    });
    (0, bun_test_1.describe)("existing functionality", () => {
        (0, bun_test_1.it)("should pass through error results unchanged", () => {
            const errorResult = {
                isError: true,
                content: [{ type: "text", text: "Error!" }],
            };
            (0, bun_test_1.expect)((0, mcpResultTransform_1.transformMCPResult)(errorResult)).toBe(errorResult);
        });
        (0, bun_test_1.it)("should pass through toolResult unchanged", () => {
            const toolResult = { toolResult: { foo: "bar" } };
            (0, bun_test_1.expect)((0, mcpResultTransform_1.transformMCPResult)(toolResult)).toBe(toolResult);
        });
        (0, bun_test_1.it)("should pass through results without content array", () => {
            const noContent = { something: "else" };
            (0, bun_test_1.expect)((0, mcpResultTransform_1.transformMCPResult)(noContent)).toBe(noContent);
        });
        (0, bun_test_1.it)("should pass through text-only content without transformation wrapper", () => {
            const textOnly = {
                content: [
                    { type: "text", text: "Hello" },
                    { type: "text", text: "World" },
                ],
            };
            // No images = no transformation needed
            (0, bun_test_1.expect)((0, mcpResultTransform_1.transformMCPResult)(textOnly)).toBe(textOnly);
        });
        (0, bun_test_1.it)("should convert resource content to text", () => {
            const result = (0, mcpResultTransform_1.transformMCPResult)({
                content: [
                    { type: "image", data: "abc", mimeType: "image/png" },
                    { type: "resource", resource: { uri: "file:///test.txt", text: "File content" } },
                ],
            });
            const transformed = result;
            (0, bun_test_1.expect)(transformed.value[1]).toEqual({ type: "text", text: "File content" });
        });
        (0, bun_test_1.it)("should default to image/png when mimeType is missing", () => {
            const result = (0, mcpResultTransform_1.transformMCPResult)({
                content: [{ type: "image", data: "abc", mimeType: "" }],
            });
            const transformed = result;
            (0, bun_test_1.expect)(transformed.value[0].mediaType).toBe("image/png");
        });
    });
});
//# sourceMappingURL=mcpResultTransform.test.js.map