"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileEditReplaceStringTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const file_edit_operation_1 = require("./file_edit_operation");
const file_edit_replace_shared_1 = require("./file_edit_replace_shared");
/**
 * String-based file edit replace tool factory
 */
const createFileEditReplaceStringTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.file_edit_replace_string.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.file_edit_replace_string.schema,
        execute: async (args, { abortSignal }) => {
            return (0, file_edit_operation_1.executeFileEditOperation)({
                config,
                filePath: args.file_path,
                operation: (originalContent) => (0, file_edit_replace_shared_1.handleStringReplace)(args, originalContent),
                abortSignal,
            });
        },
    });
};
exports.createFileEditReplaceStringTool = createFileEditReplaceStringTool;
//# sourceMappingURL=file_edit_replace_string.js.map