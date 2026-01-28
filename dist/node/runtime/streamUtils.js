"use strict";
/**
 * Stream and shell utilities shared across runtime implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.shescape = void 0;
exports.streamToString = streamToString;
/**
 * Shell-escape helper for bash commands.
 * Uses single-quote wrapping with proper escaping for embedded quotes.
 * Reused across SSH and Docker runtime operations.
 */
exports.shescape = {
    quote(value) {
        const s = String(value);
        if (s.length === 0)
            return "''";
        // Use POSIX-safe pattern to embed single quotes within single-quoted strings
        return "'" + s.replace(/'/g, "'\"'\"'") + "'";
    },
};
/**
 * Convert a ReadableStream to a string.
 * Used by SSH and Docker runtimes for capturing command output.
 */
async function streamToString(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let result = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            result += decoder.decode(value, { stream: true });
        }
        result += decoder.decode();
        return result;
    }
    finally {
        reader.releaseLock();
    }
}
//# sourceMappingURL=streamUtils.js.map