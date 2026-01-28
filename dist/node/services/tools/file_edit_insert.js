"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileEditInsertTool = void 0;
const ai_1 = require("ai");
const tools_1 = require("../../../common/types/tools");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const fileCommon_1 = require("./fileCommon");
const file_edit_operation_1 = require("./file_edit_operation");
const eol_1 = require("./eol");
const fileExists_1 = require("../../../node/utils/runtime/fileExists");
const helpers_1 = require("../../../node/utils/runtime/helpers");
const Runtime_1 = require("../../../node/runtime/Runtime");
const READ_AND_RETRY_NOTE = `${tools_1.EDIT_FAILED_NOTE_PREFIX} ${tools_1.NOTE_READ_FILE_RETRY}`;
function guardFailure(error) {
    return {
        success: false,
        error,
        note: READ_AND_RETRY_NOTE,
    };
}
const createFileEditInsertTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.file_edit_insert.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.file_edit_insert.schema,
        execute: async ({ file_path, content, before, after }, { abortSignal }) => {
            try {
                const { correctedPath, warning: pathWarning } = (0, fileCommon_1.validateAndCorrectPath)(file_path, config.cwd, config.runtime);
                file_path = correctedPath;
                const resolvedPath = config.runtime.normalizePath(file_path, config.cwd);
                // Validate plan mode access restrictions
                const planModeError = await (0, fileCommon_1.validatePlanModeAccess)(file_path, config);
                if (planModeError) {
                    return planModeError;
                }
                const exists = await (0, fileExists_1.fileExists)(config.runtime, resolvedPath, abortSignal);
                if (!exists) {
                    try {
                        await (0, helpers_1.writeFileString)(config.runtime, resolvedPath, content, abortSignal);
                    }
                    catch (err) {
                        if (err instanceof Runtime_1.RuntimeError) {
                            return {
                                success: false,
                                error: err.message,
                            };
                        }
                        throw err;
                    }
                    // Record file state for post-compaction attachment tracking
                    if (config.recordFileState) {
                        try {
                            const newStat = await config.runtime.stat(resolvedPath, abortSignal);
                            config.recordFileState(resolvedPath, {
                                content,
                                timestamp: newStat.modifiedTime.getTime(),
                            });
                        }
                        catch {
                            // File stat failed, skip recording
                        }
                    }
                    const diff = (0, fileCommon_1.generateDiff)(resolvedPath, "", content);
                    return {
                        success: true,
                        diff: tools_1.FILE_EDIT_DIFF_OMITTED_MESSAGE,
                        ui_only: {
                            file_edit: {
                                diff,
                            },
                        },
                        ...(pathWarning && { warning: pathWarning }),
                    };
                }
                return (0, file_edit_operation_1.executeFileEditOperation)({
                    config,
                    filePath: file_path,
                    abortSignal,
                    operation: (originalContent) => insertContent(originalContent, content, {
                        before,
                        after,
                    }),
                });
            }
            catch (error) {
                if (error && typeof error === "object" && "code" in error && error.code === "EACCES") {
                    return {
                        success: false,
                        error: `Permission denied: ${file_path}`,
                    };
                }
                const message = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    error: `Failed to insert content: ${message}`,
                };
            }
        },
    });
};
exports.createFileEditInsertTool = createFileEditInsertTool;
function insertContent(originalContent, contentToInsert, options) {
    const { before, after } = options;
    if (before !== undefined && after !== undefined) {
        return guardFailure("Provide only one of before or after (not both).");
    }
    if (before === undefined && after === undefined) {
        return guardFailure("Provide either a before or after guard when editing existing files.");
    }
    const fileEol = (0, eol_1.detectFileEol)(originalContent);
    const normalizedContentToInsert = (0, eol_1.convertNewlines)(contentToInsert, fileEol);
    return insertWithGuards(originalContent, normalizedContentToInsert, { before, after });
}
function insertWithGuards(originalContent, contentToInsert, anchors) {
    const anchorResult = resolveGuardAnchor(originalContent, anchors);
    if (!anchorResult.success) {
        return anchorResult;
    }
    const newContent = originalContent.slice(0, anchorResult.index) +
        contentToInsert +
        originalContent.slice(anchorResult.index);
    return {
        success: true,
        newContent,
        metadata: {},
    };
}
function findUniqueSubstringIndex(haystack, needle, label) {
    const firstIndex = haystack.indexOf(needle);
    if (firstIndex === -1) {
        return guardFailure(`Guard mismatch: unable to find ${label} substring in the current file.`);
    }
    const secondIndex = haystack.indexOf(needle, firstIndex + needle.length);
    if (secondIndex !== -1) {
        return guardFailure(`Guard mismatch: ${label} substring matched multiple times. Include more surrounding context (e.g., full signature, adjacent lines) to make it unique.`);
    }
    return { success: true, index: firstIndex };
}
function resolveGuardAnchor(originalContent, { before, after }) {
    const fileEol = (0, eol_1.detectFileEol)(originalContent);
    if (before !== undefined) {
        const exactBeforeIndexResult = findUniqueSubstringIndex(originalContent, before, "before");
        if (exactBeforeIndexResult.success) {
            return { success: true, index: exactBeforeIndexResult.index + before.length };
        }
        const normalizedBefore = (0, eol_1.convertNewlines)(before, fileEol);
        if (normalizedBefore !== before) {
            const normalizedBeforeIndexResult = findUniqueSubstringIndex(originalContent, normalizedBefore, "before");
            if (!normalizedBeforeIndexResult.success) {
                return normalizedBeforeIndexResult;
            }
            return {
                success: true,
                index: normalizedBeforeIndexResult.index + normalizedBefore.length,
            };
        }
        return exactBeforeIndexResult;
    }
    if (after !== undefined) {
        const exactAfterIndexResult = findUniqueSubstringIndex(originalContent, after, "after");
        if (exactAfterIndexResult.success) {
            return { success: true, index: exactAfterIndexResult.index };
        }
        const normalizedAfter = (0, eol_1.convertNewlines)(after, fileEol);
        if (normalizedAfter !== after) {
            const normalizedAfterIndexResult = findUniqueSubstringIndex(originalContent, normalizedAfter, "after");
            if (!normalizedAfterIndexResult.success) {
                return normalizedAfterIndexResult;
            }
            return { success: true, index: normalizedAfterIndexResult.index };
        }
        return exactAfterIndexResult;
    }
    return guardFailure("Unable to determine insertion point from guards.");
}
//# sourceMappingURL=file_edit_insert.js.map