"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const unixMd_1 = require("./unixMd");
const itIntegration = process.env.TEST_INTEGRATION === "1" ? bun_test_1.it : bun_test_1.it.skip;
(0, bun_test_1.describe)("unixMd", () => {
    (0, bun_test_1.describe)("isUnixMdUrl", () => {
        (0, bun_test_1.it)("should detect valid unix.md URLs", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/abc123#key456")).toBe(true);
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/RQJe3#Fbbhosspt9q9Ig")).toBe(true);
        });
        (0, bun_test_1.it)("should reject URLs without fragment", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/abc123")).toBe(false);
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/abc123#")).toBe(false);
        });
        (0, bun_test_1.it)("should reject non-unix.md URLs", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://example.com/page#hash")).toBe(false);
        });
    });
    (0, bun_test_1.describe)("parseUnixMdUrl", () => {
        (0, bun_test_1.it)("should extract id and key from URL", () => {
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("https://unix.md/abc123#key456")).toEqual({
                id: "abc123",
                key: "key456",
            });
        });
        (0, bun_test_1.it)("should return null for invalid URLs", () => {
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("https://unix.md/abc123")).toBeNull();
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("https://unix.md/#key")).toBeNull();
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("not-a-url")).toBeNull();
        });
    });
    // Round-trip test: upload then download
    itIntegration("should upload and download content correctly", async () => {
        const testContent = "# Test Message\n\nThis is a test of unix.md encryption.";
        const testFileInfo = {
            name: "test-message.md",
            type: "text/markdown",
            size: testContent.length,
            model: "test-model",
        };
        // Upload
        const uploadResult = await (0, unixMd_1.uploadToUnixMd)(testContent, testFileInfo, {
            expiresAt: new Date(Date.now() + 60000), // Expire in 1 minute
        });
        (0, bun_test_1.expect)(uploadResult.url).toContain("https://unix.md/");
        (0, bun_test_1.expect)(uploadResult.url).toContain("#");
        (0, bun_test_1.expect)(uploadResult.id).toBeTruthy();
        (0, bun_test_1.expect)(uploadResult.key).toBeTruthy();
        (0, bun_test_1.expect)(uploadResult.mutateKey).toBeTruthy();
        try {
            // Download and decrypt
            const downloadResult = await (0, unixMd_1.downloadFromUnixMd)(uploadResult.id, uploadResult.key);
            (0, bun_test_1.expect)(downloadResult.content).toBe(testContent);
            (0, bun_test_1.expect)(downloadResult.fileInfo).toBeDefined();
            (0, bun_test_1.expect)(downloadResult.fileInfo?.name).toBe("test-message.md");
            (0, bun_test_1.expect)(downloadResult.fileInfo?.model).toBe("test-model");
        }
        finally {
            // Clean up - delete the uploaded file
            await (0, unixMd_1.deleteFromUnixMd)(uploadResult.id, uploadResult.mutateKey);
        }
    });
    itIntegration("should fail gracefully for non-existent shares", async () => {
        let error;
        try {
            await (0, unixMd_1.downloadFromUnixMd)("nonexistent123", "fakekey456");
        }
        catch (e) {
            error = e;
        }
        (0, bun_test_1.expect)(error).toBeDefined();
        (0, bun_test_1.expect)(error?.message).toMatch(/not found|expired/i);
    });
});
//# sourceMappingURL=unixMd.test.js.map