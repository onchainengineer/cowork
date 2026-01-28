"use strict";
/**
 * mux.md Client Library
 *
 * Thin wrapper around @coder/mux-md-client for Mux app integration.
 * Re-exports types and provides convenience functions with default base URL.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUX_MD_HOST = exports.MUX_MD_BASE_URL = void 0;
exports.isMuxMdUrl = isMuxMdUrl;
exports.parseMuxMdUrl = parseMuxMdUrl;
exports.uploadToMuxMd = uploadToMuxMd;
exports.deleteFromMuxMd = deleteFromMuxMd;
exports.updateMuxMdExpiration = updateMuxMdExpiration;
exports.downloadFromMuxMd = downloadFromMuxMd;
const mux_md_client_1 = require("@coder/mux-md-client");
exports.MUX_MD_BASE_URL = "https://mux.md";
exports.MUX_MD_HOST = "mux.md";
// --- URL utilities ---
/**
 * Check if URL is a mux.md share link with encryption key in fragment
 */
function isMuxMdUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.host === exports.MUX_MD_HOST && (0, mux_md_client_1.parseUrl)(url) !== null;
    }
    catch {
        return false;
    }
}
/**
 * Parse mux.md URL to extract ID and key
 */
function parseMuxMdUrl(url) {
    return (0, mux_md_client_1.parseUrl)(url);
}
// --- Public API ---
/**
 * Upload content to mux.md with end-to-end encryption.
 */
async function uploadToMuxMd(content, fileInfo, options = {}) {
    return (0, mux_md_client_1.upload)(new TextEncoder().encode(content), fileInfo, {
        baseUrl: exports.MUX_MD_BASE_URL,
        expiresAt: options.expiresAt,
        signature: options.signature,
        sign: options.sign,
    });
}
/**
 * Delete a shared file from mux.md.
 */
async function deleteFromMuxMd(id, mutateKey) {
    await (0, mux_md_client_1.deleteFile)(id, mutateKey, { baseUrl: exports.MUX_MD_BASE_URL });
}
/**
 * Update expiration of a shared file on mux.md.
 */
async function updateMuxMdExpiration(id, mutateKey, expiresAt) {
    const result = await (0, mux_md_client_1.setExpiration)(id, mutateKey, expiresAt, { baseUrl: exports.MUX_MD_BASE_URL });
    return result.expiresAt;
}
/**
 * Download and decrypt content from mux.md.
 */
async function downloadFromMuxMd(id, keyMaterial, _signal) {
    const result = await (0, mux_md_client_1.download)(id, keyMaterial, { baseUrl: exports.MUX_MD_BASE_URL });
    return {
        content: new TextDecoder().decode(result.data),
        fileInfo: result.info,
    };
}
//# sourceMappingURL=muxMd.js.map