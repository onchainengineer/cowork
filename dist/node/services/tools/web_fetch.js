"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebFetchTool = void 0;
const ai_1 = require("ai");
const jsdom_1 = require("jsdom");
const readability_1 = require("@mozilla/readability");
const turndown_1 = __importDefault(require("turndown"));
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const toolLimits_1 = require("../../../common/constants/toolLimits");
const helpers_1 = require("../../../node/utils/runtime/helpers");
const unixMd_1 = require("../../../common/lib/unixMd");
const USER_AGENT = "DEV-OS/1.0 (web-fetch tool)";
/** Parse curl -i output into headers and body */
function parseResponse(output) {
    // Find the last HTTP status line (after redirects) and its headers
    // curl -i with -L shows all redirect responses, we want the final one
    const httpMatches = [...output.matchAll(/HTTP\/[\d.]+ (\d{3})[^\r\n]*/g)];
    const lastStatusMatch = httpMatches.length > 0 ? httpMatches[httpMatches.length - 1] : null;
    const statusCode = lastStatusMatch ? lastStatusMatch[1] : "";
    // Headers end with \r\n\r\n (or \n\n for some servers)
    const headerEndIndex = output.indexOf("\r\n\r\n");
    const altHeaderEndIndex = output.indexOf("\n\n");
    const splitIndex = headerEndIndex !== -1
        ? headerEndIndex + 4
        : altHeaderEndIndex !== -1
            ? altHeaderEndIndex + 2
            : 0;
    const headers = splitIndex > 0 ? output.slice(0, splitIndex).toLowerCase() : "";
    const body = splitIndex > 0 ? output.slice(splitIndex) : output;
    return { headers, body, statusCode };
}
/** Detect if error response is a Cloudflare challenge page */
function isCloudflareChallenge(headers, body) {
    return (headers.includes("cf-mitigated") ||
        (body.includes("Just a moment") && body.includes("Enable JavaScript")));
}
/** Try to extract readable content from HTML, returns null on failure */
function tryExtractContent(body, url, maxBytes) {
    try {
        const dom = new jsdom_1.JSDOM(body, { url });
        const reader = new readability_1.Readability(dom.window.document);
        const article = reader.parse();
        if (!article?.content)
            return null;
        const turndown = new turndown_1.default({
            headingStyle: "atx",
            codeBlockStyle: "fenced",
        });
        let content = turndown.turndown(article.content);
        if (content.length > maxBytes) {
            content = content.slice(0, maxBytes) + "\n\n[Content truncated]";
        }
        return { title: article.title ?? "Untitled", content };
    }
    catch {
        return null;
    }
}
function isUnixMdHost(url) {
    try {
        return new URL(url).host === unixMd_1.UNIX_MD_HOST;
    }
    catch {
        return false;
    }
}
/**
 * Web fetch tool factory for AI assistant
 * Creates a tool that fetches web pages and extracts readable content as markdown
 * Uses curl via Runtime to respect workspace network context
 * @param config Required configuration including runtime
 */
const createWebFetchTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.web_fetch.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.web_fetch.schema,
        execute: async ({ url }, { abortSignal }) => {
            try {
                // Handle unix.md share links with client-side decryption
                const unixMdParsed = (0, unixMd_1.parseUnixMdUrl)(url);
                if (unixMdParsed) {
                    try {
                        const result = await (0, unixMd_1.downloadFromUnixMd)(unixMdParsed.id, unixMdParsed.key, abortSignal);
                        let content = result.content;
                        if (content.length > toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES) {
                            content = content.slice(0, toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES) + "\n\n[Content truncated]";
                        }
                        return {
                            success: true,
                            title: result.fileInfo?.name ?? "Shared Message",
                            content,
                            url: `${unixMd_1.UNIX_MD_BASE_URL}/${unixMdParsed.id}#${unixMdParsed.key}`,
                            length: content.length,
                        };
                    }
                    catch (err) {
                        return {
                            success: false,
                            error: err instanceof Error ? err.message : "Failed to download from unix.md",
                        };
                    }
                }
                if (isUnixMdHost(url)) {
                    return { success: false, error: "Invalid unix.md URL format" };
                }
                // Build curl command with safe defaults
                // Use shell quoting helper to escape values safely
                const shellQuote = (s) => `'${s.replace(/'/g, "'\\''")}'`;
                const curlCommand = [
                    "curl",
                    "-sS", // Silent but show errors
                    "-L", // Follow redirects
                    "-i", // Include headers in output
                    "--fail-with-body", // Return exit code 22 for HTTP 4xx/5xx but still output body
                    "--max-time",
                    String(toolLimits_1.WEB_FETCH_TIMEOUT_SECS),
                    "--max-filesize",
                    String(toolLimits_1.WEB_FETCH_MAX_HTML_BYTES),
                    "-A",
                    shellQuote(USER_AGENT),
                    "--compressed", // Accept gzip/deflate
                    "-H",
                    shellQuote("Accept: text/markdown, text/x-markdown, text/plain, text/html, application/xhtml+xml"),
                    shellQuote(url),
                ].join(" ");
                // Execute via Runtime (respects workspace network context)
                const result = await (0, helpers_1.execBuffered)(config.runtime, curlCommand, {
                    cwd: config.cwd,
                    abortSignal,
                    timeout: toolLimits_1.WEB_FETCH_TIMEOUT_SECS + 5, // Slightly longer than curl's timeout (seconds)
                });
                if (result.exitCode !== 0) {
                    // curl exit codes: https://curl.se/docs/manpage.html
                    const exitCodeMessages = {
                        6: "Could not resolve host",
                        7: "Failed to connect",
                        28: "Operation timed out",
                        35: "SSL/TLS handshake failed",
                        56: "Network data receive error",
                        63: "Maximum file size exceeded",
                    };
                    // For HTTP errors (exit 22), try to parse and include the error body
                    if (result.exitCode === 22 && result.stdout) {
                        const { headers, body, statusCode } = parseResponse(result.stdout);
                        const statusText = statusCode ? `HTTP ${statusCode}` : "HTTP error";
                        // Detect Cloudflare challenge pages
                        if (isCloudflareChallenge(headers, body)) {
                            return {
                                success: false,
                                error: `${statusText}: Cloudflare security challenge (page requires JavaScript)`,
                            };
                        }
                        // Try to extract readable content from error page
                        const extracted = tryExtractContent(body, url, toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES);
                        if (extracted) {
                            return {
                                success: false,
                                error: statusText,
                                content: extracted.content,
                            };
                        }
                        return {
                            success: false,
                            error: statusText,
                        };
                    }
                    const reason = exitCodeMessages[result.exitCode] || result.stderr || "Unknown error";
                    return {
                        success: false,
                        error: `Failed to fetch URL: ${reason}`,
                    };
                }
                // Parse headers and body from curl -i output
                const { headers, body } = parseResponse(result.stdout);
                if (!body || body.trim().length === 0) {
                    return {
                        success: false,
                        error: "Empty response from URL",
                    };
                }
                // Check content-type to determine processing strategy
                const contentTypeMatch = /content-type:\s*([^\r\n;]+)/.exec(headers);
                const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : "";
                const isPlainText = contentType.includes("text/plain") ||
                    contentType.includes("text/markdown") ||
                    contentType.includes("text/x-markdown");
                // For plain text/markdown, return as-is without HTML processing
                if (isPlainText) {
                    let content = body;
                    if (content.length > toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES) {
                        content = content.slice(0, toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES) + "\n\n[Content truncated]";
                    }
                    return {
                        success: true,
                        title: url,
                        content,
                        url,
                        length: content.length,
                    };
                }
                // Parse HTML with JSDOM (runs locally in Unix, not over SSH)
                const dom = new jsdom_1.JSDOM(body, { url });
                // Extract article with Readability
                const reader = new readability_1.Readability(dom.window.document);
                const article = reader.parse();
                if (!article) {
                    return {
                        success: false,
                        error: "Could not extract readable content from page",
                    };
                }
                // Convert to markdown
                const turndown = new turndown_1.default({
                    headingStyle: "atx",
                    codeBlockStyle: "fenced",
                });
                let content = turndown.turndown(article.content ?? "");
                // Truncate if needed
                if (content.length > toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES) {
                    content = content.slice(0, toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES) + "\n\n[Content truncated]";
                }
                return {
                    success: true,
                    title: article.title ?? "Untitled",
                    content,
                    url,
                    byline: article.byline ?? undefined,
                    length: content.length,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    error: `web_fetch error: ${message}`,
                };
            }
        },
    });
};
exports.createWebFetchTool = createWebFetchTool;
//# sourceMappingURL=web_fetch.js.map