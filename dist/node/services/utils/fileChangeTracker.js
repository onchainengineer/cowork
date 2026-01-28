"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileChangeTracker = void 0;
const promises_1 = require("fs/promises");
const diff_1 = require("../../../node/utils/diff");
/**
 * Tracks file content state and detects external modifications.
 *
 * Used to inject diffs of externally-edited files as context attachments
 * before each LLM query.
 */
class FileChangeTracker {
    fileState = new Map();
    /** Record a file's current content and mtime. */
    record(filePath, state) {
        this.fileState.set(filePath, state);
    }
    /** Get count of tracked files. */
    get count() {
        return this.fileState.size;
    }
    /** Get paths of all tracked files. */
    get paths() {
        return Array.from(this.fileState.keys());
    }
    /** Clear all tracked state (e.g., on /clear). */
    clear() {
        this.fileState.clear();
    }
    /**
     * Check all tracked files for external modifications.
     * Updates internal state for changed files and returns diff attachments.
     */
    async getChangedAttachments() {
        const checks = Array.from(this.fileState.entries()).map(async ([filePath, state]) => {
            try {
                const currentMtime = (await (0, promises_1.stat)(filePath)).mtimeMs;
                if (currentMtime <= state.timestamp)
                    return null; // No change
                const currentContent = await (0, promises_1.readFile)(filePath, "utf-8");
                const diff = (0, diff_1.computeDiff)(state.content, currentContent);
                if (!diff)
                    return null; // Content identical despite mtime change
                // Update stored state
                this.fileState.set(filePath, { content: currentContent, timestamp: currentMtime });
                return {
                    type: "edited_text_file",
                    filename: filePath,
                    snippet: diff,
                };
            }
            catch {
                // File deleted or inaccessible, skip
                return null;
            }
        });
        const results = await Promise.all(checks);
        return results.filter((r) => r !== null);
    }
}
exports.FileChangeTracker = FileChangeTracker;
//# sourceMappingURL=fileChangeTracker.js.map