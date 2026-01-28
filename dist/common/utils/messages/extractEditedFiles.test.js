"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const diff_1 = require("diff");
const tools_1 = require("../../../common/types/tools");
const extractEditedFiles_1 = require("./extractEditedFiles");
/**
 * Helper to create a mock UnixMessage with file edit tool results.
 */
function createAssistantMessage(toolCalls) {
    return {
        id: `msg-${Math.random().toString(36).slice(2)}`,
        role: "assistant",
        parts: toolCalls.map((tc) => ({
            type: "dynamic-tool",
            toolCallId: `tc-${Math.random().toString(36).slice(2)}`,
            toolName: tc.toolName,
            state: "output-available",
            input: { file_path: tc.filePath },
            output: {
                success: tc.success ?? true,
                diff: tc.diff,
                ...(tc.uiOnlyDiff
                    ? {
                        ui_only: {
                            file_edit: {
                                diff: tc.uiOnlyDiff,
                            },
                        },
                    }
                    : {}),
            },
        })),
    };
}
/**
 * Helper to generate a unified diff.
 */
function makeDiff(filePath, oldContent, newContent) {
    return (0, diff_1.createPatch)(filePath, oldContent, newContent, "", "", { context: 3 });
}
(0, bun_test_1.describe)("extractEditedFilePaths", () => {
    (0, bun_test_1.it)("should extract file paths from successful edits", () => {
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file1.ts",
                    diff: makeDiff("/path/to/file1.ts", "old", "new"),
                },
            ]),
            createAssistantMessage([
                {
                    toolName: "file_edit_insert",
                    filePath: "/path/to/file2.ts",
                    diff: makeDiff("/path/to/file2.ts", "", "content"),
                },
            ]),
        ];
        const paths = (0, extractEditedFiles_1.extractEditedFilePaths)(messages);
        (0, bun_test_1.expect)(paths).toEqual(["/path/to/file2.ts", "/path/to/file1.ts"]);
    });
    (0, bun_test_1.it)("should ignore failed edits", () => {
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file1.ts",
                    diff: "",
                    success: false,
                },
            ]),
        ];
        const paths = (0, extractEditedFiles_1.extractEditedFilePaths)(messages);
        (0, bun_test_1.expect)(paths).toEqual([]);
    });
    (0, bun_test_1.it)("should dedupe paths and return most recent first", () => {
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file1.ts",
                    diff: makeDiff("/path/to/file1.ts", "v1", "v2"),
                },
            ]),
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file2.ts",
                    diff: makeDiff("/path/to/file2.ts", "old", "new"),
                },
            ]),
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file1.ts",
                    diff: makeDiff("/path/to/file1.ts", "v2", "v3"),
                },
            ]),
        ];
        const paths = (0, extractEditedFiles_1.extractEditedFilePaths)(messages);
        // file1 was edited last, so it should be first
        (0, bun_test_1.expect)(paths).toEqual(["/path/to/file1.ts", "/path/to/file2.ts"]);
    });
});
(0, bun_test_1.describe)("extractEditedFileDiffs", () => {
    (0, bun_test_1.it)("should extract single diff for a file", () => {
        const originalContent = "line1\nline2\nline3";
        const newContent = "line1\nmodified\nline3";
        const diff = makeDiff("/path/to/file.ts", originalContent, newContent);
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file.ts",
                    diff,
                },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        (0, bun_test_1.expect)(result[0].path).toBe("/path/to/file.ts");
        (0, bun_test_1.expect)(result[0].truncated).toBe(false);
        // Single diff should be returned as-is
        (0, bun_test_1.expect)(result[0].diff).toBe(diff);
    });
    (0, bun_test_1.it)("should prefer ui_only diffs when present", () => {
        const originalContent = "line1\nline2\nline3";
        const newContent = "line1\nmodified\nline3";
        const diff = makeDiff("/path/to/file.ts", originalContent, newContent);
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file.ts",
                    diff: tools_1.FILE_EDIT_DIFF_OMITTED_MESSAGE,
                    uiOnlyDiff: diff,
                },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        (0, bun_test_1.expect)(result[0].diff).toBe(diff);
    });
    (0, bun_test_1.it)("should combine multiple non-overlapping diffs for the same file", () => {
        // Edit 1: change line 2
        const original = "line1\nline2\nline3\nline4\nline5";
        const afterEdit1 = "line1\nMODIFIED2\nline3\nline4\nline5";
        const diff1 = makeDiff("/path/to/file.ts", original, afterEdit1);
        // Edit 2: change line 4
        const afterEdit2 = "line1\nMODIFIED2\nline3\nMODIFIED4\nline5";
        const diff2 = makeDiff("/path/to/file.ts", afterEdit1, afterEdit2);
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file.ts",
                    diff: diff1,
                },
            ]),
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file.ts",
                    diff: diff2,
                },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        (0, bun_test_1.expect)(result[0].path).toBe("/path/to/file.ts");
        // The combined diff should show original -> final
        const expectedCombinedDiff = makeDiff("/path/to/file.ts", original, afterEdit2);
        (0, bun_test_1.expect)(result[0].diff).toBe(expectedCombinedDiff);
    });
    (0, bun_test_1.it)("should combine overlapping diffs (editing same lines twice)", () => {
        // Edit 1: change line 2
        const original = "line1\nline2\nline3";
        const afterEdit1 = "line1\nFIRST_EDIT\nline3";
        const diff1 = makeDiff("/path/to/file.ts", original, afterEdit1);
        // Edit 2: change line 2 again (overlapping edit)
        const afterEdit2 = "line1\nSECOND_EDIT\nline3";
        const diff2 = makeDiff("/path/to/file.ts", afterEdit1, afterEdit2);
        const messages = [
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file.ts",
                    diff: diff1,
                },
            ]),
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/path/to/file.ts",
                    diff: diff2,
                },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        // Combined diff should show original -> final (skipping intermediate state)
        const expectedCombinedDiff = makeDiff("/path/to/file.ts", original, afterEdit2);
        (0, bun_test_1.expect)(result[0].diff).toBe(expectedCombinedDiff);
    });
    (0, bun_test_1.it)("should handle three sequential edits to the same lines", () => {
        const original = "function foo() {\n  return 1;\n}";
        const v1 = "function foo() {\n  return 2;\n}";
        const v2 = "function foo() {\n  return 3;\n}";
        const v3 = "function foo() {\n  return 42;\n}";
        const diff1 = makeDiff("/path/to/file.ts", original, v1);
        const diff2 = makeDiff("/path/to/file.ts", v1, v2);
        const diff3 = makeDiff("/path/to/file.ts", v2, v3);
        const messages = [
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/path/to/file.ts", diff: diff1 },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/path/to/file.ts", diff: diff2 },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/path/to/file.ts", diff: diff3 },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        // Should show original -> final
        const expectedCombinedDiff = makeDiff("/path/to/file.ts", original, v3);
        (0, bun_test_1.expect)(result[0].diff).toBe(expectedCombinedDiff);
    });
    (0, bun_test_1.it)("should handle edits that add and then modify new lines", () => {
        // Start with empty file
        const original = "";
        const afterInsert = "line1\nline2\nline3";
        const diff1 = makeDiff("/path/to/file.ts", original, afterInsert);
        // Then modify one of the inserted lines
        const afterModify = "line1\nMODIFIED\nline3";
        const diff2 = makeDiff("/path/to/file.ts", afterInsert, afterModify);
        const messages = [
            createAssistantMessage([
                { toolName: "file_edit_insert", filePath: "/path/to/file.ts", diff: diff1 },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/path/to/file.ts", diff: diff2 },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        // Combined diff should show empty -> final
        const expectedCombinedDiff = makeDiff("/path/to/file.ts", original, afterModify);
        (0, bun_test_1.expect)(result[0].diff).toBe(expectedCombinedDiff);
    });
    (0, bun_test_1.it)("should handle multiple files with different edit counts", () => {
        const file1Original = "a";
        const file1Final = "b";
        const diff1 = makeDiff("/file1.ts", file1Original, file1Final);
        const file2Original = "x";
        const file2V1 = "y";
        const file2Final = "z";
        const diff2a = makeDiff("/file2.ts", file2Original, file2V1);
        const diff2b = makeDiff("/file2.ts", file2V1, file2Final);
        const messages = [
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/file1.ts", diff: diff1 },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/file2.ts", diff: diff2a },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/file2.ts", diff: diff2b },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(2);
        // file2 was edited last, so it should be first
        (0, bun_test_1.expect)(result[0].path).toBe("/file2.ts");
        (0, bun_test_1.expect)(result[0].diff).toBe(makeDiff("/file2.ts", file2Original, file2Final));
        (0, bun_test_1.expect)(result[1].path).toBe("/file1.ts");
        (0, bun_test_1.expect)(result[1].diff).toBe(diff1);
    });
    (0, bun_test_1.it)("should ignore failed edits when combining", () => {
        const original = "original";
        const afterSuccess = "modified";
        const successDiff = makeDiff("/file.ts", original, afterSuccess);
        const messages = [
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/file.ts", diff: successDiff },
            ]),
            createAssistantMessage([
                {
                    toolName: "file_edit_replace_string",
                    filePath: "/file.ts",
                    diff: "",
                    success: false,
                },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        (0, bun_test_1.expect)(result[0].diff).toBe(successDiff);
    });
    (0, bun_test_1.it)("should handle edit that deletes content from edited lines", () => {
        // Edit 1: add some content
        const original = "start\nend";
        const afterAdd = "start\nmiddle1\nmiddle2\nend";
        const diff1 = makeDiff("/file.ts", original, afterAdd);
        // Edit 2: remove some of the added content
        const afterDelete = "start\nmiddle1\nend";
        const diff2 = makeDiff("/file.ts", afterAdd, afterDelete);
        const messages = [
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/file.ts", diff: diff1 },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/file.ts", diff: diff2 },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        const expectedCombinedDiff = makeDiff("/file.ts", original, afterDelete);
        (0, bun_test_1.expect)(result[0].diff).toBe(expectedCombinedDiff);
    });
    (0, bun_test_1.it)("should combine non-overlapping diffs in large files with separate hunks", () => {
        // Create a file large enough that edits at top and bottom produce separate hunks
        // (more than 6 lines apart, so the 3-line context doesn't overlap)
        const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
        const original = lines.join("\n");
        // Edit 1: change line 2 (near the top)
        const linesAfterEdit1 = [...lines];
        linesAfterEdit1[1] = "MODIFIED_LINE2";
        const afterEdit1 = linesAfterEdit1.join("\n");
        const diff1 = makeDiff("/large-file.ts", original, afterEdit1);
        // Edit 2: change line 18 (near the bottom) - far enough to be a separate hunk
        const linesAfterEdit2 = [...linesAfterEdit1];
        linesAfterEdit2[17] = "MODIFIED_LINE18";
        const afterEdit2 = linesAfterEdit2.join("\n");
        const diff2 = makeDiff("/large-file.ts", afterEdit1, afterEdit2);
        const messages = [
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/large-file.ts", diff: diff1 },
            ]),
            createAssistantMessage([
                { toolName: "file_edit_replace_string", filePath: "/large-file.ts", diff: diff2 },
            ]),
        ];
        const result = (0, extractEditedFiles_1.extractEditedFileDiffs)(messages);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        (0, bun_test_1.expect)(result[0].path).toBe("/large-file.ts");
        // The combined diff should show original -> final with both edits
        const expectedCombinedDiff = makeDiff("/large-file.ts", original, afterEdit2);
        (0, bun_test_1.expect)(result[0].diff).toBe(expectedCombinedDiff);
    });
});
//# sourceMappingURL=extractEditedFiles.test.js.map