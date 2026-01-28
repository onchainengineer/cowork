"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEB_FETCH_MAX_HTML_BYTES = exports.WEB_FETCH_MAX_OUTPUT_BYTES = exports.WEB_FETCH_TIMEOUT_SECS = exports.STATUS_MESSAGE_MAX_LENGTH = exports.INIT_HOOK_MAX_LINES = exports.MAX_TODOS = exports.BASH_MAX_LINE_BYTES = exports.BASH_TRUNCATE_MAX_FILE_BYTES = exports.BASH_TRUNCATE_MAX_TOTAL_BYTES = exports.BASH_MAX_FILE_BYTES = exports.BASH_MAX_TOTAL_BYTES = exports.BASH_HARD_MAX_LINES = exports.BASH_DEFAULT_MAX_LINES = exports.BASH_DEFAULT_TIMEOUT_SECS = void 0;
exports.BASH_DEFAULT_TIMEOUT_SECS = 3;
// tmpfile policy limits (AI agent - conservative for LLM context)
exports.BASH_DEFAULT_MAX_LINES = 300;
exports.BASH_HARD_MAX_LINES = 300;
exports.BASH_MAX_TOTAL_BYTES = 16 * 1024; // 16KB total output to show agent
exports.BASH_MAX_FILE_BYTES = 100 * 1024; // 100KB max to save to temp file
// truncate policy limits (IPC - generous for UI features like code review)
// No line limit or per-line byte limit for IPC - only total byte limit applies
exports.BASH_TRUNCATE_MAX_TOTAL_BYTES = 1024 * 1024; // 1MB total output
exports.BASH_TRUNCATE_MAX_FILE_BYTES = 1024 * 1024; // 1MB file limit (same as total for IPC)
// tmpfile policy limits (AI agent only)
exports.BASH_MAX_LINE_BYTES = 1024; // 1KB per line for AI agent
exports.MAX_TODOS = 7; // Maximum number of TODO items in a list
// Init hook output limits (prevents OOM/freeze with large rsync output)
// Keep only the most recent lines (tail), drop older lines
exports.INIT_HOOK_MAX_LINES = 500;
exports.STATUS_MESSAGE_MAX_LENGTH = 60; // Maximum length for status messages (auto-truncated)
// Web fetch tool limits
exports.WEB_FETCH_TIMEOUT_SECS = 15; // curl timeout
exports.WEB_FETCH_MAX_OUTPUT_BYTES = 64 * 1024; // 64KB markdown output
exports.WEB_FETCH_MAX_HTML_BYTES = 5 * 1024 * 1024; // 5MB HTML input (curl --max-filesize)
//# sourceMappingURL=toolLimits.js.map