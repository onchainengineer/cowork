"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const os_1 = require("os");
const fileChangeTracker_1 = require("../../node/services/utils/fileChangeTracker");
const diff_1 = require("../../node/utils/diff");
/**
 * Tests for external file change detection via FileChangeTracker.
 *
 * Pattern: timestamp-based polling with diff injection
 * 1. Track file state (content + mtime) when reading/writing files
 * 2. Poll before each LLM query to detect external modifications
 * 3. Compute diff and inject as context attachment if changed
 */
(0, bun_test_1.describe)("AgentSession change detection", () => {
    let tmpDir;
    (0, bun_test_1.beforeEach)(async () => {
        tmpDir = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "unix-change-detection-test-"));
    });
    (0, bun_test_1.afterEach)(async () => {
        await (0, promises_1.rm)(tmpDir, { recursive: true, force: true });
    });
    // Helper to get mtime for a file
    async function getMtime(filePath) {
        return (await (0, promises_1.stat)(filePath)).mtimeMs;
    }
    (0, bun_test_1.describe)("FileChangeTracker", () => {
        (0, bun_test_1.it)("should detect no changes when file unchanged", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const testFile = (0, path_1.join)(tmpDir, "plan.md");
            const content = "# Plan\n\n## Step 1\n\nDo something";
            await (0, promises_1.writeFile)(testFile, content);
            const mtime = await getMtime(testFile);
            // Record initial state
            tracker.record(testFile, { content, timestamp: mtime });
            // Check for changes - should be empty since file is unchanged
            const attachments = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(attachments).toHaveLength(0);
        });
        (0, bun_test_1.it)("should detect changes when file content modified externally", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const testFile = (0, path_1.join)(tmpDir, "plan.md");
            const originalContent = "# Plan\n\n## Step 1\n\nDo something";
            await (0, promises_1.writeFile)(testFile, originalContent);
            const originalMtime = await getMtime(testFile);
            // Record initial state
            tracker.record(testFile, { content: originalContent, timestamp: originalMtime });
            // Simulate external edit (wait briefly to ensure mtime changes)
            await new Promise((resolve) => setTimeout(resolve, 10));
            const modifiedContent = "# Plan\n\n## Step 1\n\nDo something better\n\n## Step 2\n\nNew step";
            await (0, promises_1.writeFile)(testFile, modifiedContent);
            // Update mtime to be in the future to simulate external edit
            const newMtime = Date.now() + 1000;
            await (0, promises_1.utimes)(testFile, newMtime / 1000, newMtime / 1000);
            // Check for changes - should detect the modification
            const attachments = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(attachments).toHaveLength(1);
            (0, bun_test_1.expect)(attachments[0].type).toBe("edited_text_file");
            (0, bun_test_1.expect)(attachments[0].filename).toBe(testFile);
            (0, bun_test_1.expect)(attachments[0].snippet).toContain("Do something better");
            (0, bun_test_1.expect)(attachments[0].snippet).toContain("Step 2");
            (0, bun_test_1.expect)(attachments[0].snippet).toContain("New step");
        });
        (0, bun_test_1.it)("should update stored state after detecting change", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const testFile = (0, path_1.join)(tmpDir, "plan.md");
            const originalContent = "# Original";
            await (0, promises_1.writeFile)(testFile, originalContent);
            const originalMtime = await getMtime(testFile);
            tracker.record(testFile, { content: originalContent, timestamp: originalMtime });
            // Modify file
            await new Promise((resolve) => setTimeout(resolve, 10));
            const modifiedContent = "# Modified";
            await (0, promises_1.writeFile)(testFile, modifiedContent);
            const newMtime = Date.now() + 1000;
            await (0, promises_1.utimes)(testFile, newMtime / 1000, newMtime / 1000);
            // First detection
            const firstCheck = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(firstCheck).toHaveLength(1);
            // Second check without further changes - should be empty
            // because state was updated after first detection
            const secondCheck = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(secondCheck).toHaveLength(0);
        });
        (0, bun_test_1.it)("should return empty when file deleted", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const testFile = (0, path_1.join)(tmpDir, "plan.md");
            const content = "# Plan";
            await (0, promises_1.writeFile)(testFile, content);
            const mtime = await getMtime(testFile);
            tracker.record(testFile, { content, timestamp: mtime });
            // Delete the file
            await (0, promises_1.rm)(testFile);
            // Should gracefully handle deleted file
            const attachments = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(attachments).toHaveLength(0);
        });
        (0, bun_test_1.it)("should detect changes across multiple tracked files", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const file1 = (0, path_1.join)(tmpDir, "plan.md");
            const file2 = (0, path_1.join)(tmpDir, "notes.md");
            const file3 = (0, path_1.join)(tmpDir, "unchanged.md");
            await (0, promises_1.writeFile)(file1, "Original 1");
            await (0, promises_1.writeFile)(file2, "Original 2");
            await (0, promises_1.writeFile)(file3, "Original 3");
            const mtime1 = await getMtime(file1);
            const mtime2 = await getMtime(file2);
            const mtime3 = await getMtime(file3);
            tracker.record(file1, { content: "Original 1", timestamp: mtime1 });
            tracker.record(file2, { content: "Original 2", timestamp: mtime2 });
            tracker.record(file3, { content: "Original 3", timestamp: mtime3 });
            // Modify only files 1 and 2
            await new Promise((resolve) => setTimeout(resolve, 10));
            await (0, promises_1.writeFile)(file1, "Modified 1");
            await (0, promises_1.writeFile)(file2, "Modified 2");
            const newMtime = Date.now() + 1000;
            await (0, promises_1.utimes)(file1, newMtime / 1000, newMtime / 1000);
            await (0, promises_1.utimes)(file2, newMtime / 1000, newMtime / 1000);
            const attachments = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(attachments).toHaveLength(2);
            const filenames = attachments.map((a) => a.filename);
            (0, bun_test_1.expect)(filenames).toContain(file1);
            (0, bun_test_1.expect)(filenames).toContain(file2);
            (0, bun_test_1.expect)(filenames).not.toContain(file3);
        });
        (0, bun_test_1.it)("should ignore mtime change when content identical (touch scenario)", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const testFile = (0, path_1.join)(tmpDir, "plan.md");
            const content = "# Plan unchanged";
            await (0, promises_1.writeFile)(testFile, content);
            const originalMtime = await getMtime(testFile);
            tracker.record(testFile, { content, timestamp: originalMtime });
            // Update only mtime (like 'touch' command) without changing content
            const newMtime = Date.now() + 1000;
            await (0, promises_1.utimes)(testFile, newMtime / 1000, newMtime / 1000);
            // Should not report change since content is identical
            const attachments = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(attachments).toHaveLength(0);
        });
        (0, bun_test_1.it)("should produce valid unified diff format", async () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const testFile = (0, path_1.join)(tmpDir, "plan.md");
            const originalContent = "line 1\nline 2\nline 3\nline 4\nline 5";
            await (0, promises_1.writeFile)(testFile, originalContent);
            const originalMtime = await getMtime(testFile);
            tracker.record(testFile, { content: originalContent, timestamp: originalMtime });
            // Modify middle line
            await new Promise((resolve) => setTimeout(resolve, 10));
            const modifiedContent = "line 1\nline 2\nmodified line 3\nline 4\nline 5";
            await (0, promises_1.writeFile)(testFile, modifiedContent);
            const newMtime = Date.now() + 1000;
            await (0, promises_1.utimes)(testFile, newMtime / 1000, newMtime / 1000);
            const attachments = await tracker.getChangedAttachments();
            (0, bun_test_1.expect)(attachments).toHaveLength(1);
            const diff = attachments[0].snippet;
            // Verify unified diff format
            (0, bun_test_1.expect)(diff).toContain("@@");
            (0, bun_test_1.expect)(diff).toContain("-line 3");
            (0, bun_test_1.expect)(diff).toContain("+modified line 3");
        });
        (0, bun_test_1.it)("should expose count and paths getters", () => {
            const tracker = new fileChangeTracker_1.FileChangeTracker();
            const file1 = (0, path_1.join)(tmpDir, "file1.md");
            const file2 = (0, path_1.join)(tmpDir, "file2.md");
            (0, bun_test_1.expect)(tracker.count).toBe(0);
            (0, bun_test_1.expect)(tracker.paths).toEqual([]);
            tracker.record(file1, { content: "content1", timestamp: Date.now() });
            (0, bun_test_1.expect)(tracker.count).toBe(1);
            (0, bun_test_1.expect)(tracker.paths).toContain(file1);
            tracker.record(file2, { content: "content2", timestamp: Date.now() });
            (0, bun_test_1.expect)(tracker.count).toBe(2);
            (0, bun_test_1.expect)(tracker.paths).toContain(file1);
            (0, bun_test_1.expect)(tracker.paths).toContain(file2);
            tracker.clear();
            (0, bun_test_1.expect)(tracker.count).toBe(0);
            (0, bun_test_1.expect)(tracker.paths).toEqual([]);
        });
    });
    (0, bun_test_1.describe)("computeDiff utility", () => {
        (0, bun_test_1.it)("should return null for identical content", () => {
            const content = "# Plan\n\nContent here";
            (0, bun_test_1.expect)((0, diff_1.computeDiff)(content, content)).toBeNull();
        });
        (0, bun_test_1.it)("should return diff for modified content", () => {
            const old = "line 1\nline 2\nline 3";
            const modified = "line 1\nmodified line 2\nline 3";
            const diff = (0, diff_1.computeDiff)(old, modified);
            (0, bun_test_1.expect)(diff).not.toBeNull();
            (0, bun_test_1.expect)(diff).toContain("-line 2");
            (0, bun_test_1.expect)(diff).toContain("+modified line 2");
        });
        (0, bun_test_1.it)("should handle added lines", () => {
            const old = "line 1\nline 2";
            const modified = "line 1\nline 2\nline 3";
            const diff = (0, diff_1.computeDiff)(old, modified);
            (0, bun_test_1.expect)(diff).not.toBeNull();
            (0, bun_test_1.expect)(diff).toContain("+line 3");
        });
        (0, bun_test_1.it)("should handle removed lines", () => {
            const old = "line 1\nline 2\nline 3";
            const modified = "line 1\nline 3";
            const diff = (0, diff_1.computeDiff)(old, modified);
            (0, bun_test_1.expect)(diff).not.toBeNull();
            (0, bun_test_1.expect)(diff).toContain("-line 2");
        });
        (0, bun_test_1.it)("should handle empty to non-empty", () => {
            const diff = (0, diff_1.computeDiff)("", "new content");
            (0, bun_test_1.expect)(diff).not.toBeNull();
            (0, bun_test_1.expect)(diff).toContain("+new content");
        });
        (0, bun_test_1.it)("should handle non-empty to empty", () => {
            const diff = (0, diff_1.computeDiff)("old content", "");
            (0, bun_test_1.expect)(diff).not.toBeNull();
            (0, bun_test_1.expect)(diff).toContain("-old content");
        });
    });
});
//# sourceMappingURL=agentSession.changeDetection.test.js.map