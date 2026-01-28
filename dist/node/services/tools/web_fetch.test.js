"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const web_fetch_1 = require("./web_fetch");
const toolLimits_1 = require("../../../common/constants/toolLimits");
const testHelpers_1 = require("./testHelpers");
const unixMd_1 = require("../../../common/lib/unixMd");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// ToolCallOptions stub for testing
const itIntegration = process.env.TEST_INTEGRATION === "1" ? bun_test_1.it : bun_test_1.it.skip;
const toolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
// Helper to create web_fetch tool with real LocalRuntime
function createTestWebFetchTool() {
    const tempDir = new testHelpers_1.TestTempDir("test-web-fetch");
    const config = (0, testHelpers_1.createTestToolConfig)(tempDir.path);
    const tool = (0, web_fetch_1.createWebFetchTool)(config);
    return {
        tool,
        tempDir,
        [Symbol.dispose]() {
            tempDir[Symbol.dispose]();
        },
    };
}
(0, bun_test_1.describe)("unix.md URL helpers", () => {
    (0, bun_test_1.describe)("isUnixMdUrl", () => {
        (0, bun_test_1.it)("should detect valid unix.md URLs", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/abc123#key456")).toBe(true);
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/RQJe3#Fbbhosspt9q9Ig")).toBe(true);
        });
        (0, bun_test_1.it)("should reject unix.md URLs without hash", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/abc123")).toBe(false);
        });
        (0, bun_test_1.it)("should reject unix.md URLs with empty hash", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://unix.md/abc123#")).toBe(false);
        });
        (0, bun_test_1.it)("should reject non-unix.md URLs", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://example.com/page#hash")).toBe(false);
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("https://other.md/abc#key")).toBe(false);
        });
        (0, bun_test_1.it)("should handle invalid URLs gracefully", () => {
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("not-a-url")).toBe(false);
            (0, bun_test_1.expect)((0, unixMd_1.isUnixMdUrl)("")).toBe(false);
        });
    });
    (0, bun_test_1.describe)("parseUnixMdUrl", () => {
        (0, bun_test_1.it)("should extract id and key from valid unix.md URL", () => {
            const result = (0, unixMd_1.parseUnixMdUrl)("https://unix.md/abc123#key456");
            (0, bun_test_1.expect)(result).toEqual({ id: "abc123", key: "key456" });
        });
        (0, bun_test_1.it)("should handle base64url characters in key", () => {
            const result = (0, unixMd_1.parseUnixMdUrl)("https://unix.md/RQJe3#Fbbhosspt9q9Ig");
            (0, bun_test_1.expect)(result).toEqual({ id: "RQJe3", key: "Fbbhosspt9q9Ig" });
        });
        (0, bun_test_1.it)("should return null for URLs without hash", () => {
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("https://unix.md/abc123")).toBeNull();
        });
        (0, bun_test_1.it)("should return null for URLs with empty id", () => {
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("https://unix.md/#key")).toBeNull();
        });
        (0, bun_test_1.it)("should return null for invalid URLs", () => {
            (0, bun_test_1.expect)((0, unixMd_1.parseUnixMdUrl)("not-a-url")).toBeNull();
        });
    });
});
(0, bun_test_1.describe)("web_fetch tool", () => {
    // Integration test: fetch a real public URL
    itIntegration("should fetch and convert a real web page to markdown", async () => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_1, createTestWebFetchTool(), false);
            const args = {
                // example.com is a stable, simple HTML page maintained by IANA
                url: "https://example.com",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.title).toContain("Example Domain");
                (0, bun_test_1.expect)(result.url).toBe("https://example.com");
                // example.com mentions documentation examples
                (0, bun_test_1.expect)(result.content).toContain("documentation");
                (0, bun_test_1.expect)(result.length).toBeGreaterThan(0);
            }
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    });
    // Integration test: fetch plain text endpoint (not HTML)
    itIntegration("should fetch plain text content without HTML processing", async () => {
        const env_2 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_2, createTestWebFetchTool(), false);
            const args = {
                // Cloudflare's trace endpoint returns plain text diagnostics
                url: "https://cloudflare.com/cdn-cgi/trace",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                // Should contain typical trace fields
                (0, bun_test_1.expect)(result.content).toContain("fl=");
                (0, bun_test_1.expect)(result.content).toContain("h=");
                (0, bun_test_1.expect)(result.content).toContain("ip=");
                // Title should be the URL for plain text
                (0, bun_test_1.expect)(result.title).toBe("https://cloudflare.com/cdn-cgi/trace");
                (0, bun_test_1.expect)(result.length).toBeGreaterThan(0);
            }
        }
        catch (e_2) {
            env_2.error = e_2;
            env_2.hasError = true;
        }
        finally {
            __disposeResources(env_2);
        }
    });
    itIntegration("should handle DNS failure gracefully", async () => {
        const env_3 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_3, createTestWebFetchTool(), false);
            const args = {
                // .invalid TLD is reserved and guaranteed to never resolve
                url: "https://this-domain-does-not-exist.invalid/page",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Failed to fetch URL");
            }
        }
        catch (e_3) {
            env_3.error = e_3;
            env_3.hasError = true;
        }
        finally {
            __disposeResources(env_3);
        }
    });
    (0, bun_test_1.it)("should handle connection refused gracefully", async () => {
        const env_4 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_4, createTestWebFetchTool(), false);
            const args = {
                // localhost on a random high port should refuse connection
                url: "http://127.0.0.1:59999/page",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Failed to fetch URL");
            }
        }
        catch (e_4) {
            env_4.error = e_4;
            env_4.hasError = true;
        }
        finally {
            __disposeResources(env_4);
        }
    });
    // Test with a local file served via file:// - tests HTML parsing without network
    (0, bun_test_1.it)("should handle local HTML content via file:// URL", async () => {
        const env_5 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_5, createTestWebFetchTool(), false);
            // Create a test HTML file
            const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>Local Test Page</title></head>
<body>
  <article>
    <h1>Test Heading</h1>
    <p>This is test content with <strong>bold</strong> and <em>italic</em> text.</p>
  </article>
</body>
</html>`;
            const htmlPath = path.join(testEnv.tempDir.path, "test.html");
            await fs.writeFile(htmlPath, htmlContent);
            const args = {
                url: `file://${htmlPath}`,
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.title).toBe("Local Test Page");
                (0, bun_test_1.expect)(result.content).toContain("Test Heading");
                (0, bun_test_1.expect)(result.content).toContain("**bold**");
                (0, bun_test_1.expect)(result.content).toContain("_italic_");
            }
        }
        catch (e_5) {
            env_5.error = e_5;
            env_5.hasError = true;
        }
        finally {
            __disposeResources(env_5);
        }
    });
    (0, bun_test_1.it)("should truncate oversized output from local file", async () => {
        const env_6 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_6, createTestWebFetchTool(), false);
            // Create HTML that will produce content larger than WEB_FETCH_MAX_OUTPUT_BYTES
            const largeContent = "x".repeat(toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES + 1000);
            const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>Large Page</title></head>
<body><article><p>${largeContent}</p></article></body>
</html>`;
            const htmlPath = path.join(testEnv.tempDir.path, "large.html");
            await fs.writeFile(htmlPath, htmlContent);
            const args = {
                url: `file://${htmlPath}`,
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.content.length).toBeLessThanOrEqual(toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES + 100 // Allow for truncation message
                );
                (0, bun_test_1.expect)(result.content).toContain("[Content truncated]");
            }
        }
        catch (e_6) {
            env_6.error = e_6;
            env_6.hasError = true;
        }
        finally {
            __disposeResources(env_6);
        }
    });
    (0, bun_test_1.it)("should handle non-article HTML gracefully", async () => {
        const env_7 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_7, createTestWebFetchTool(), false);
            // Minimal HTML that Readability may not parse as an article
            const htmlContent = "<html><body><p>Just some text</p></body></html>";
            const htmlPath = path.join(testEnv.tempDir.path, "minimal.html");
            await fs.writeFile(htmlPath, htmlContent);
            const args = {
                url: `file://${htmlPath}`,
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            // Readability may or may not parse this - the important thing is we don't crash
            (0, bun_test_1.expect)(typeof result.success).toBe("boolean");
        }
        catch (e_7) {
            env_7.error = e_7;
            env_7.hasError = true;
        }
        finally {
            __disposeResources(env_7);
        }
    });
    (0, bun_test_1.it)("should handle empty file", async () => {
        const env_8 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_8, createTestWebFetchTool(), false);
            const htmlPath = path.join(testEnv.tempDir.path, "empty.html");
            await fs.writeFile(htmlPath, "");
            const args = {
                url: `file://${htmlPath}`,
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Empty response");
            }
        }
        catch (e_8) {
            env_8.error = e_8;
            env_8.hasError = true;
        }
        finally {
            __disposeResources(env_8);
        }
    });
    (0, bun_test_1.it)("should handle missing file", async () => {
        const env_9 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_9, createTestWebFetchTool(), false);
            const args = {
                url: `file://${testEnv.tempDir.path}/nonexistent.html`,
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Failed to fetch URL");
            }
        }
        catch (e_9) {
            env_9.error = e_9;
            env_9.hasError = true;
        }
        finally {
            __disposeResources(env_9);
        }
    });
    // Test HTTP error handling with body parsing
    itIntegration("should include HTTP status code in error for non-2xx responses", async () => {
        const env_10 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_10, createTestWebFetchTool(), false);
            const args = {
                // httpbin.dev reliably returns the requested status code
                url: "https://httpbin.dev/status/404",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("HTTP 404");
            }
        }
        catch (e_10) {
            env_10.error = e_10;
            env_10.hasError = true;
        }
        finally {
            __disposeResources(env_10);
        }
    });
    itIntegration("should detect Cloudflare challenge pages", async () => {
        const env_11 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_11, createTestWebFetchTool(), false);
            const args = {
                // platform.openai.com is known to serve Cloudflare challenges
                url: "https://platform.openai.com",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("Cloudflare");
                (0, bun_test_1.expect)(result.error).toContain("JavaScript");
            }
        }
        catch (e_11) {
            env_11.error = e_11;
            env_11.hasError = true;
        }
        finally {
            __disposeResources(env_11);
        }
    });
    // unix.md integration tests
    itIntegration("should handle expired/missing unix.md share links", async () => {
        const env_12 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_12, createTestWebFetchTool(), false);
            const args = {
                // Non-existent share ID should return 404
                url: "https://unix.md/nonexistent123#somekey456",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("expired or not found");
            }
        }
        catch (e_12) {
            env_12.error = e_12;
            env_12.hasError = true;
        }
        finally {
            __disposeResources(env_12);
        }
    });
    (0, bun_test_1.it)("should return error for unix.md URLs without valid key format", async () => {
        const env_13 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_13, createTestWebFetchTool(), false);
            const args = {
                // URL without hash (invalid unix.md format) - should fall through to normal fetch
                // which will fail to extract content from unix.md's HTML viewer
                url: "https://unix.md/someid",
            };
            const result = (await testEnv.tool.execute(args, toolCallOptions));
            // Without the key fragment, it's treated as a normal URL fetch
            // The unix.md viewer page won't have extractable content
            (0, bun_test_1.expect)(result.success).toBe(false);
        }
        catch (e_13) {
            env_13.error = e_13;
            env_13.hasError = true;
        }
        finally {
            __disposeResources(env_13);
        }
    });
    itIntegration("should decrypt and return unix.md content correctly", async () => {
        const env_14 = { stack: [], error: void 0, hasError: false };
        try {
            const testEnv = __addDisposableResource(env_14, createTestWebFetchTool(), false);
            // Upload test content to unix.md
            const testContent = "# Test Heading\n\nThis is **test content** for web_fetch decryption.";
            const uploadResult = await (0, unixMd_1.uploadToUnixMd)(testContent, { name: "test.md", type: "text/markdown", size: testContent.length }, { expiresAt: new Date(Date.now() + 60000) });
            try {
                // Fetch via web_fetch tool
                const args = { url: uploadResult.url };
                const result = (await testEnv.tool.execute(args, toolCallOptions));
                (0, bun_test_1.expect)(result.success).toBe(true);
                if (result.success) {
                    (0, bun_test_1.expect)(result.content).toBe(testContent);
                    (0, bun_test_1.expect)(result.title).toBe("test.md");
                    (0, bun_test_1.expect)(result.url).toBe(uploadResult.url);
                    (0, bun_test_1.expect)(result.length).toBe(testContent.length);
                }
            }
            finally {
                // Clean up
                await (0, unixMd_1.deleteFromUnixMd)(uploadResult.id, uploadResult.mutateKey);
            }
        }
        catch (e_14) {
            env_14.error = e_14;
            env_14.hasError = true;
        }
        finally {
            __disposeResources(env_14);
        }
    });
});
//# sourceMappingURL=web_fetch.test.js.map