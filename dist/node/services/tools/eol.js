"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeNewlinesToLF = normalizeNewlinesToLF;
exports.detectFileEol = detectFileEol;
exports.convertNewlines = convertNewlines;
/**
 * Normalize all newline styles to LF.
 *
 * This is intentionally conservative and scoped to file-edit tools where we want
 * to be resilient to Windows CRLF vs. model-generated LF mismatches.
 */
function normalizeNewlinesToLF(text) {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
/**
 * Detect a file's newline style.
 *
 * We prefer CRLF if we see any CRLF sequences.
 */
function detectFileEol(originalContent) {
    return originalContent.includes("\r\n") ? "\r\n" : "\n";
}
function convertNewlines(text, eol) {
    return normalizeNewlinesToLF(text).replace(/\n/g, eol);
}
//# sourceMappingURL=eol.js.map