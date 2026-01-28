"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSystem1KeepRangesTool = createSystem1KeepRangesTool;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
function createSystem1KeepRangesTool(_config, options) {
    let called = false;
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.system1_keep_ranges.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.system1_keep_ranges.schema,
        execute: ({ keep_ranges }) => {
            // Defensive: the model should only call this once, but don't error-loop if it retries.
            if (called) {
                return { success: true };
            }
            called = true;
            options?.onKeepRanges?.(keep_ranges);
            return { success: true };
        },
    });
}
//# sourceMappingURL=system1_keep_ranges.js.map