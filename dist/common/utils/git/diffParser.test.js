"use strict";
/**
 * Tests for git diff parsing using a real git repository
 * IMPORTANT: Uses actual git commands, not simulated diffs
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const fs_1 = require("fs");
const fs_2 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const child_process_1 = require("child_process");
const diffParser_1 = require("./diffParser");
(0, bun_test_1.describe)("git diff parser (real repository)", () => {
    let testRepoPath;
    (0, bun_test_1.beforeAll)(() => {
        // Create a temporary directory for our test repo
        testRepoPath = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "git-diff-test-"));
        // Initialize git repo
        (0, child_process_1.execSync)("git init", { cwd: testRepoPath });
        (0, child_process_1.execSync)('git config user.email "test@example.com"', { cwd: testRepoPath });
        // Disable commit signing (some developer machines enforce signing via global config)
        (0, child_process_1.execSync)("git config commit.gpgsign false", { cwd: testRepoPath });
        (0, child_process_1.execSync)('git config user.name "Test User"', { cwd: testRepoPath });
        // Create initial commit with a file
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file1.txt"), "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n");
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file2.js"), 'function hello() {\n  console.log("Hello");\n}\n');
        (0, child_process_1.execSync)("git add .", { cwd: testRepoPath });
        (0, child_process_1.execSync)('git commit -m "Initial commit"', { cwd: testRepoPath });
    });
    (0, bun_test_1.afterAll)(() => {
        // Clean up test repo
        (0, fs_1.rmSync)(testRepoPath, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("should parse single file modification", () => {
        // Modify file1.txt
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file1.txt"), "Line 1\nLine 2 modified\nLine 3\nLine 4\nLine 5\n");
        // Get git diff
        const diff = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        // Parse diff
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("file1.txt");
        (0, bun_test_1.expect)(fileDiffs[0].hunks.length).toBeGreaterThan(0);
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        (0, bun_test_1.expect)(allHunks.length).toBeGreaterThan(0);
        (0, bun_test_1.expect)(allHunks[0].filePath).toBe("file1.txt");
        (0, bun_test_1.expect)(allHunks[0].content.includes("modified")).toBe(true);
    });
    (0, bun_test_1.it)("should parse multiple file modifications", () => {
        // Modify both files
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file1.txt"), "Line 1\nNew line\nLine 2\nLine 3\nLine 4\nLine 5\n");
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file2.js"), 'function hello() {\n  console.log("Hello World");\n  return true;\n}\n');
        const diff = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBe(2);
        const file1Diff = fileDiffs.find((f) => f.filePath === "file1.txt");
        const file2Diff = fileDiffs.find((f) => f.filePath === "file2.js");
        (0, bun_test_1.expect)(file1Diff).toBeDefined();
        (0, bun_test_1.expect)(file2Diff).toBeDefined();
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        (0, bun_test_1.expect)(allHunks.length).toBeGreaterThan(1);
    });
    (0, bun_test_1.it)("should parse new file addition", () => {
        // Reset working directory
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Add new file
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "newfile.md"), "# New File\n\nContent here\n");
        (0, child_process_1.execSync)("git add newfile.md", { cwd: testRepoPath });
        const diff = (0, child_process_1.execSync)("git diff --cached", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs).toHaveLength(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("newfile.md");
        (0, bun_test_1.expect)(fileDiffs[0].changeType).toBe("added");
        (0, bun_test_1.expect)(fileDiffs[0].hunks.length).toBeGreaterThan(0);
        const hunk = fileDiffs[0].hunks[0];
        (0, bun_test_1.expect)(hunk.oldStart).toBe(0);
        (0, bun_test_1.expect)(hunk.oldLines).toBe(0);
        (0, bun_test_1.expect)(hunk.newStart).toBe(1);
        (0, bun_test_1.expect)(hunk.header).toMatch(/^@@ -0,0 \+1,\d+ @@/);
        const contentLines = hunk.content.split("\n");
        // Most lines should be additions. We intentionally tolerate a trailing
        // "phantom" context line (" ") because it helps keep the UI stable when the
        // unified diff ends with a newline.
        const nonPhantomLines = contentLines.filter((l) => l !== " ");
        (0, bun_test_1.expect)(nonPhantomLines.length).toBeGreaterThan(0);
        (0, bun_test_1.expect)(nonPhantomLines.every((l) => l.startsWith("+"))).toBe(true);
    });
    (0, bun_test_1.it)("should normalize CRLF diff output (no \\r in hunk content)", () => {
        const diffOutput = [
            "diff --git a/crlf.txt b/crlf.txt",
            "new file mode 100644",
            "index 0000000..1111111",
            "--- /dev/null",
            "+++ b/crlf.txt",
            "@@ -0,0 +1,2 @@",
            "+hello",
            "+world",
        ].join("\r\n") + "\r\n";
        const fileDiffs = (0, diffParser_1.parseDiff)(diffOutput);
        (0, bun_test_1.expect)(fileDiffs).toHaveLength(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("crlf.txt");
        (0, bun_test_1.expect)(fileDiffs[0].changeType).toBe("added");
        (0, bun_test_1.expect)(fileDiffs[0].hunks).toHaveLength(1);
        const hunk = fileDiffs[0].hunks[0];
        (0, bun_test_1.expect)(hunk.oldStart).toBe(0);
        (0, bun_test_1.expect)(hunk.newStart).toBe(1);
        // `parseDiff` should strip CRLF-derived carriage returns.
        (0, bun_test_1.expect)(hunk.content.includes("\r")).toBe(false);
        // Preserve any trailing phantom context line behavior, but the actual added
        // content should still be present and uncorrupted.
        (0, bun_test_1.expect)(hunk.content.startsWith("+hello\n+world")).toBe(true);
    });
    (0, bun_test_1.it)("should parse file deletion", () => {
        // Reset and commit newfile
        (0, child_process_1.execSync)("git add . && git commit -m 'Add newfile'", { cwd: testRepoPath });
        // Delete file
        (0, child_process_1.execSync)("rm newfile.md", { cwd: testRepoPath });
        const diff = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("newfile.md");
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        // Check that all content lines start with - (deletions)
        const contentLines = allHunks[0].content.split("\n");
        (0, bun_test_1.expect)(contentLines.some((l) => l.startsWith("-"))).toBe(true);
    });
    (0, bun_test_1.it)("should parse branch comparison (three-dot diff)", () => {
        // Reset
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Create a feature branch
        (0, child_process_1.execSync)("git checkout -b feature", { cwd: testRepoPath });
        // Make changes on feature branch
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "feature.txt"), "Feature content\n");
        (0, child_process_1.execSync)("git add . && git commit -m 'Add feature'", { cwd: testRepoPath });
        // Get diff between main (or master) and feature
        // Note: mainBranch is determined by the initial setup
        const _mainBranch = (0, child_process_1.execSync)("git rev-parse --abbrev-ref HEAD", {
            cwd: testRepoPath,
            encoding: "utf-8",
        }).trim();
        // Checkout main and compare
        (0, child_process_1.execSync)("git checkout -", { cwd: testRepoPath });
        const baseBranch = (0, child_process_1.execSync)("git rev-parse --abbrev-ref HEAD", {
            cwd: testRepoPath,
            encoding: "utf-8",
        }).trim();
        const diff = (0, child_process_1.execSync)(`git diff ${baseBranch}...feature`, {
            cwd: testRepoPath,
            encoding: "utf-8",
        });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBeGreaterThan(0);
        const featureFile = fileDiffs.find((f) => f.filePath === "feature.txt");
        (0, bun_test_1.expect)(featureFile).toBeDefined();
    });
    (0, bun_test_1.it)("should handle empty diff", () => {
        // Reset to clean state
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        const diff = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBe(0);
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        (0, bun_test_1.expect)(allHunks.length).toBe(0);
    });
    (0, bun_test_1.it)("should generate stable hunk IDs for same content", () => {
        // Reset
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Make a specific change
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file1.txt"), "Line 1\nStable change\nLine 3\nLine 4\nLine 5\n");
        const diff1 = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        const hunks1 = (0, diffParser_1.extractAllHunks)((0, diffParser_1.parseDiff)(diff1));
        const id1 = hunks1[0]?.id;
        // Reset and make the SAME change again
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "file1.txt"), "Line 1\nStable change\nLine 3\nLine 4\nLine 5\n");
        const diff2 = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        const hunks2 = (0, diffParser_1.extractAllHunks)((0, diffParser_1.parseDiff)(diff2));
        const id2 = hunks2[0]?.id;
        (0, bun_test_1.expect)(id1).toBeDefined();
        (0, bun_test_1.expect)(id2).toBeDefined();
        (0, bun_test_1.expect)(id1).toBe(id2);
    });
    (0, bun_test_1.it)("should handle large diffs with many hunks", () => {
        // Reset
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Create a file with many lines
        const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "large.txt"), lines.join("\n") + "\n");
        (0, child_process_1.execSync)("git add . && git commit -m 'Add large file'", { cwd: testRepoPath });
        // Modify multiple sections
        const modifiedLines = lines.map((line, i) => {
            if (i % 20 === 0)
                return `Modified ${line}`;
            return line;
        });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "large.txt"), modifiedLines.join("\n") + "\n");
        const diff = (0, child_process_1.execSync)("git diff HEAD", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].hunks.length).toBeGreaterThan(1);
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        (0, bun_test_1.expect)(allHunks.length).toBeGreaterThan(1);
        // All hunks should have valid IDs
        (0, bun_test_1.expect)(allHunks.every((h) => h.id && h.id.length > 0)).toBe(true);
    });
    (0, bun_test_1.it)("should handle pure file rename (no content changes)", () => {
        // Reset
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Rename a file with git mv (preserves history)
        (0, child_process_1.execSync)("git mv file1.txt file1-renamed.txt", { cwd: testRepoPath });
        // Use -M flag to detect renames (though pure renames are detected by default)
        const diff = (0, child_process_1.execSync)("git diff --cached -M", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        // A pure rename should be detected
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("file1-renamed.txt");
        (0, bun_test_1.expect)(fileDiffs[0].oldPath).toBe("file1.txt");
        (0, bun_test_1.expect)(fileDiffs[0].changeType).toBe("renamed");
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        // Pure renames with no content changes should have NO hunks
        // because git shows "similarity index 100%" with no diff content
        (0, bun_test_1.expect)(allHunks.length).toBe(0);
    });
    (0, bun_test_1.it)("should handle file rename with content changes", () => {
        // Reset
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Create a larger file so a small change maintains high similarity
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "large-file.js"), `// Header comment
function hello() {
  console.log("Hello");
}

function goodbye() {
  console.log("Goodbye");
}

function greet(name) {
  console.log(\`Hello \${name}\`);
}

// Footer comment
`);
        (0, child_process_1.execSync)("git add . && git commit -m 'Add large file'", { cwd: testRepoPath });
        // Rename and make a small modification (maintains >50% similarity)
        (0, child_process_1.execSync)("git mv large-file.js renamed-file.js", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "renamed-file.js"), `// Header comment
function hello() {
  console.log("Hello World"); // MODIFIED
}

function goodbye() {
  console.log("Goodbye");
}

function greet(name) {
  console.log(\`Hello \${name}\`);
}

// Footer comment
`);
        (0, child_process_1.execSync)("git add renamed-file.js", { cwd: testRepoPath });
        // Use -M flag to detect renames
        const diff = (0, child_process_1.execSync)("git diff --cached -M", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("renamed-file.js");
        (0, bun_test_1.expect)(fileDiffs[0].oldPath).toBe("large-file.js");
        (0, bun_test_1.expect)(fileDiffs[0].changeType).toBe("renamed");
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        (0, bun_test_1.expect)(allHunks.length).toBeGreaterThan(0);
        // Hunks should show the content changes
        (0, bun_test_1.expect)(allHunks[0].changeType).toBe("renamed");
        (0, bun_test_1.expect)(allHunks[0].oldPath).toBe("large-file.js");
        (0, bun_test_1.expect)(allHunks[0].content.includes("World")).toBe(true);
    });
    (0, bun_test_1.it)("should handle renamed directory with files", () => {
        // Reset and setup
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Create a directory structure
        (0, child_process_1.execSync)("mkdir -p old-dir", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "old-dir", "nested1.txt"), "Nested file 1\n");
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "old-dir", "nested2.txt"), "Nested file 2\n");
        (0, child_process_1.execSync)("git add . && git commit -m 'Add nested files'", { cwd: testRepoPath });
        // Rename the directory
        (0, child_process_1.execSync)("git mv old-dir new-dir", { cwd: testRepoPath });
        // Use -M flag to detect renames
        const diff = (0, child_process_1.execSync)("git diff --cached -M", { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diff);
        // Should detect renames for all files in the directory
        (0, bun_test_1.expect)(fileDiffs.length).toBeGreaterThanOrEqual(2);
        const nested1 = fileDiffs.find((f) => f.filePath === "new-dir/nested1.txt");
        const nested2 = fileDiffs.find((f) => f.filePath === "new-dir/nested2.txt");
        (0, bun_test_1.expect)(nested1).toBeDefined();
        (0, bun_test_1.expect)(nested2).toBeDefined();
        if (nested1) {
            (0, bun_test_1.expect)(nested1.changeType).toBe("renamed");
            (0, bun_test_1.expect)(nested1.oldPath).toBe("old-dir/nested1.txt");
        }
        if (nested2) {
            (0, bun_test_1.expect)(nested2.changeType).toBe("renamed");
            (0, bun_test_1.expect)(nested2.oldPath).toBe("old-dir/nested2.txt");
        }
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        // Pure directory renames should have NO hunks (files are identical)
        (0, bun_test_1.expect)(allHunks.length).toBe(0);
    });
    (0, bun_test_1.it)("should show unified diff when includeUncommitted is true", () => {
        // Verify includeUncommitted produces single unified diff (not separate committed + uncommitted)
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        const baseBranch = (0, child_process_1.execSync)("git rev-parse --abbrev-ref HEAD", {
            cwd: testRepoPath,
            encoding: "utf-8",
        }).trim();
        (0, child_process_1.execSync)("git checkout -b unified-test", { cwd: testRepoPath });
        // Commit a change, then make uncommitted change
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "test-file.txt"), "Line 1\nLine 2\nLine 3\n");
        (0, child_process_1.execSync)("git add test-file.txt && git commit -m 'Add test file'", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "test-file.txt"), "Line 1\nLine 2\nLine 3 modified\nLine 4\n");
        const gitCommand = (0, diffParser_1.buildGitDiffCommand)(baseBranch, true, "", "diff");
        const diffOutput = (0, child_process_1.execSync)(gitCommand, { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diffOutput);
        // Single FileDiff with unified changes (no duplicates)
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("test-file.txt");
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        const allContent = allHunks.map((h) => h.content).join("\n");
        (0, bun_test_1.expect)(allContent.includes("Line 3 modified") || allContent.includes("Line 4")).toBe(true);
        (0, child_process_1.execSync)("git reset --hard HEAD && git checkout -", { cwd: testRepoPath });
    });
    (0, bun_test_1.it)("should exclude uncommitted changes when includeUncommitted is false", () => {
        // Verify includeUncommitted=false uses three-dot (committed only)
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        const baseBranch = (0, child_process_1.execSync)("git rev-parse --abbrev-ref HEAD", {
            cwd: testRepoPath,
            encoding: "utf-8",
        }).trim();
        (0, child_process_1.execSync)("git checkout -b committed-only-test", { cwd: testRepoPath });
        // Commit a change
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "committed-file.txt"), "Line 1\nLine 2\n");
        (0, child_process_1.execSync)("git add committed-file.txt && git commit -m 'Add committed file'", {
            cwd: testRepoPath,
        });
        // Make uncommitted change (should NOT appear in diff)
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "committed-file.txt"), "Line 1\nLine 2\nUncommitted line\n");
        const gitCommand = (0, diffParser_1.buildGitDiffCommand)(baseBranch, false, "", "diff");
        const diffOutput = (0, child_process_1.execSync)(gitCommand, { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diffOutput);
        // Should get FileDiff showing only committed changes
        (0, bun_test_1.expect)(fileDiffs.length).toBe(1);
        (0, bun_test_1.expect)(fileDiffs[0].filePath).toBe("committed-file.txt");
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        const allContent = allHunks.map((h) => h.content).join("\n");
        // Should NOT include uncommitted "Uncommitted line"
        (0, bun_test_1.expect)(allContent.includes("Uncommitted line")).toBe(false);
        // Should include committed content
        (0, bun_test_1.expect)(allContent.includes("Line 1") || allContent.includes("Line 2")).toBe(true);
        (0, child_process_1.execSync)("git reset --hard HEAD && git checkout -", { cwd: testRepoPath });
    });
    (0, bun_test_1.it)("should handle staged + uncommitted when diffBase is --staged", () => {
        // Verify --staged with includeUncommitted produces TWO diffs (staged + unstaged)
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "staged-test.txt"), "Line 1\nLine 2\nLine 3\n");
        (0, child_process_1.execSync)("git add staged-test.txt", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "staged-test.txt"), "Line 1\nLine 2 staged\nLine 3\n");
        (0, child_process_1.execSync)("git add staged-test.txt", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "staged-test.txt"), "Line 1\nLine 2 staged\nLine 3 unstaged\n");
        const gitCommand = (0, diffParser_1.buildGitDiffCommand)("--staged", true, "", "diff");
        const diffOutput = (0, child_process_1.execSync)(gitCommand, { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diffOutput);
        // Two FileDiff entries (staged + unstaged)
        (0, bun_test_1.expect)(fileDiffs.length).toBe(2);
        (0, bun_test_1.expect)(fileDiffs.every((f) => f.filePath === "staged-test.txt")).toBe(true);
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        (0, bun_test_1.expect)(allHunks.length).toBe(2);
        const allContent = allHunks.map((h) => h.content).join("\n");
        (0, bun_test_1.expect)(allContent.includes("staged")).toBe(true);
        (0, bun_test_1.expect)(allContent.includes("unstaged")).toBe(true);
    });
    (0, bun_test_1.it)("should not show inverse deltas when branch is behind base ref", () => {
        // Scenario: Branch A is 3 commits behind origin/main
        //
        // Git history:
        //   test-main:  Initial---Y---Z---W (3 commits ahead)
        //                 \
        //   feature:       Feature (committed) + uncommitted changes
        //
        // Problem: Old behavior with includeUncommitted=true used two-dot diff,
        // comparing W to working directory, showing Y, Z, W as inverse deltas.
        //
        // Expected: Should only show feature branch changes (committed + uncommitted),
        // NOT inverse deltas from Y, Z, W commits that landed on test-main.
        (0, child_process_1.execSync)("git reset --hard HEAD", { cwd: testRepoPath });
        // Create a "main" branch and add 3 commits
        (0, child_process_1.execSync)("git checkout -b test-main", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "main-file.txt"), "Initial content\n");
        (0, child_process_1.execSync)("git add main-file.txt && git commit -m 'Initial on main'", { cwd: testRepoPath });
        // Branch off from here (this is the merge-base)
        (0, child_process_1.execSync)("git checkout -b feature-branch", { cwd: testRepoPath });
        // Add commits on feature branch
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "feature-file.txt"), "Feature content\n");
        (0, child_process_1.execSync)("git add feature-file.txt && git commit -m 'Add feature file'", {
            cwd: testRepoPath,
        });
        // Simulate origin/main moving forward (3 commits ahead)
        (0, child_process_1.execSync)("git checkout test-main", { cwd: testRepoPath });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "main-file.txt"), "Initial content\nCommit Y\n");
        (0, child_process_1.execSync)("git add main-file.txt && git commit -m 'Commit Y on main'", {
            cwd: testRepoPath,
        });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "main-file.txt"), "Initial content\nCommit Y\nCommit Z\n");
        (0, child_process_1.execSync)("git add main-file.txt && git commit -m 'Commit Z on main'", {
            cwd: testRepoPath,
        });
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "main-file.txt"), "Initial content\nCommit Y\nCommit Z\nCommit W\n");
        (0, child_process_1.execSync)("git add main-file.txt && git commit -m 'Commit W on main'", {
            cwd: testRepoPath,
        });
        // Back to feature branch
        (0, child_process_1.execSync)("git checkout feature-branch", { cwd: testRepoPath });
        // Add uncommitted changes to feature branch
        (0, fs_2.writeFileSync)((0, path_1.join)(testRepoPath, "feature-file.txt"), "Feature content\nUncommitted change\n");
        // Test 1: includeUncommitted=false (committed only, uses three-dot)
        const gitCommandCommittedOnly = (0, diffParser_1.buildGitDiffCommand)("test-main", false, "", "diff");
        const diffOutputCommittedOnly = (0, child_process_1.execSync)(gitCommandCommittedOnly, {
            cwd: testRepoPath,
            encoding: "utf-8",
        });
        const fileDiffsCommittedOnly = (0, diffParser_1.parseDiff)(diffOutputCommittedOnly);
        const featureFileCommittedOnly = fileDiffsCommittedOnly.find((f) => f.filePath === "feature-file.txt");
        const mainFileCommittedOnly = fileDiffsCommittedOnly.find((f) => f.filePath === "main-file.txt");
        (0, bun_test_1.expect)(featureFileCommittedOnly).toBeDefined();
        (0, bun_test_1.expect)(mainFileCommittedOnly).toBeUndefined(); // No inverse deltas
        const hunksCommittedOnly = (0, diffParser_1.extractAllHunks)(fileDiffsCommittedOnly);
        const contentCommittedOnly = hunksCommittedOnly.map((h) => h.content).join("\n");
        // Should show committed feature work
        (0, bun_test_1.expect)(contentCommittedOnly.includes("Feature content")).toBe(true);
        // Should NOT show uncommitted changes (key difference from includeUncommitted=true)
        (0, bun_test_1.expect)(contentCommittedOnly.includes("Uncommitted change")).toBe(false);
        // Should NOT show inverse deltas from main
        (0, bun_test_1.expect)(contentCommittedOnly.includes("Commit Y")).toBe(false);
        (0, bun_test_1.expect)(contentCommittedOnly.includes("Commit Z")).toBe(false);
        (0, bun_test_1.expect)(contentCommittedOnly.includes("Commit W")).toBe(false);
        // Test 2: includeUncommitted=true (committed + uncommitted, uses merge-base)
        const gitCommand = (0, diffParser_1.buildGitDiffCommand)("test-main", true, "", "diff");
        const diffOutput = (0, child_process_1.execSync)(gitCommand, { cwd: testRepoPath, encoding: "utf-8" });
        const fileDiffs = (0, diffParser_1.parseDiff)(diffOutput);
        // Should show only feature-file.txt (the file we added/modified)
        // Should NOT show main-file.txt as deletions (inverse deltas)
        const featureFile = fileDiffs.find((f) => f.filePath === "feature-file.txt");
        const mainFile = fileDiffs.find((f) => f.filePath === "main-file.txt");
        (0, bun_test_1.expect)(featureFile).toBeDefined();
        (0, bun_test_1.expect)(mainFile).toBeUndefined(); // Should NOT appear
        // Verify we see both committed and uncommitted changes in feature-file.txt
        const allHunks = (0, diffParser_1.extractAllHunks)(fileDiffs);
        const allContent = allHunks.map((h) => h.content).join("\n");
        (0, bun_test_1.expect)(allContent.includes("Feature content")).toBe(true);
        (0, bun_test_1.expect)(allContent.includes("Uncommitted change")).toBe(true);
        // Critically: should NOT show any deletions from Commit Y, Z, W
        (0, bun_test_1.expect)(allContent.includes("Commit Y")).toBe(false);
        (0, bun_test_1.expect)(allContent.includes("Commit Z")).toBe(false);
        (0, bun_test_1.expect)(allContent.includes("Commit W")).toBe(false);
        // Cleanup
        (0, child_process_1.execSync)("git checkout test-main --force", { cwd: testRepoPath });
        (0, child_process_1.execSync)("git branch -D feature-branch", { cwd: testRepoPath });
    });
});
//# sourceMappingURL=diffParser.test.js.map