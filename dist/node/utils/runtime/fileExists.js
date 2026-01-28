"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileExists = fileExists;
/**
 * Check if a path exists using runtime.stat()
 * @param runtime Runtime instance to use
 * @param path Path to check
 * @param abortSignal Optional abort signal to cancel the operation
 * @returns True if path exists, false otherwise
 */
async function fileExists(runtime, path, abortSignal) {
    try {
        await runtime.stat(path, abortSignal);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=fileExists.js.map