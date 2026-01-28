"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileEditReplaceLinesTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const file_edit_operation_1 = require("./file_edit_operation");
const file_edit_replace_shared_1 = require("./file_edit_replace_shared");
/**
 * Line-based file edit replace tool factory
 */
const createFileEditReplaceLinesTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.file_edit_replace_lines.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.file_edit_replace_lines.schema,
        execute: async (args, { abortSignal }) => {
            const result = await (0, file_edit_operation_1.executeFileEditOperation)({
                config,
                filePath: args.file_path,
                operation: (originalContent) => (0, file_edit_replace_shared_1.handleLineReplace)(args, originalContent),
                abortSignal,
            });
            // handleLineReplace always returns lines_replaced and line_delta,
            // so we can safely assert this meets FileEditReplaceLinesToolResult
            if (result.success) {
                return {
                    success: true,
                    diff: result.diff,
                    ui_only: result.ui_only,
                    warning: result.warning,
                    edits_applied: result.edits_applied,
                    lines_replaced: result.lines_replaced,
                    line_delta: result.line_delta,
                };
            }
            return result;
        },
    });
};
exports.createFileEditReplaceLinesTool = createFileEditReplaceLinesTool;
//# sourceMappingURL=file_edit_replace_lines.js.map