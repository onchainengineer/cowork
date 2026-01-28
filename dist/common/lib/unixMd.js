"use strict";
/**
 * unix.md Client Library
 *
 * Thin wrapper around @coder/mux-md-client for Unix app integration.
 * Re-exports types and provides convenience functions with default base URL.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIX_MD_HOST = exports.UNIX_MD_BASE_URL = void 0;
exports.isUnixMdUrl = isUnixMdUrl;
exports.parseUnixMdUrl = parseUnixMdUrl;
exports.uploadToUnixMd = uploadToUnixMd;
exports.deleteFromUnixMd = deleteFromUnixMd;
exports.updateUnixMdExpiration = updateUnixMdExpiration;
exports.downloadFromUnixMd = downloadFromUnixMd;
const mux_md_client_1 = require("@coder/mux-md-client");
exports.UNIX_MD_BASE_URL = "https://unix.md";
exports.UNIX_MD_HOST = "unix.md";
// --- URL utilities ---
/**
 * Check if URL is a unix.md share link with encryption key in fragment
 */
function isUnixMdUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.host === exports.UNIX_MD_HOST && (0, mux_md_client_1.parseUrl)(url) !== null;
    }
    catch {
        return false;
    }
}
/**
 * Parse unix.md URL to extract ID and key
 */
function parseUnixMdUrl(url) {
    return (0, mux_md_client_1.parseUrl)(url);
}
// --- Public API ---
/**
 * Upload content to unix.md with end-to-end encryption.
 */
async function uploadToUnixMd(content, fileInfo, options = {}) {
    return (0, mux_md_client_1.upload)(new TextEncoder().encode(content), fileInfo, {
        baseUrl: exports.UNIX_MD_BASE_URL,
        expiresAt: options.expiresAt,
        signature: options.signature,
        sign: options.sign,
    });
}
/**
 * Delete a shared file from unix.md.
 */
async function deleteFromUnixMd(id, mutateKey) {
    await (0, mux_md_client_1.deleteFile)(id, mutateKey, { baseUrl: exports.UNIX_MD_BASE_URL });
}
/**
 * Update expiration of a shared file on unix.md.
 */
async function updateUnixMdExpiration(id, mutateKey, expiresAt) {
    const result = await (0, mux_md_client_1.setExpiration)(id, mutateKey, expiresAt, { baseUrl: exports.UNIX_MD_BASE_URL });
    return result.expiresAt;
}
/**
 * Download and decrypt content from unix.md.
 */
async function downloadFromUnixMd(id, keyMaterial, _signal) {
    const result = await (0, mux_md_client_1.download)(id, keyMaterial, { baseUrl: exports.UNIX_MD_BASE_URL });
    return {
        content: new TextDecoder().decode(result.data),
        fileInfo: result.info,
    };
}
//# sourceMappingURL=unixMd.js.map