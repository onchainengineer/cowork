"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyToolOutputRedaction = applyToolOutputRedaction;
const toolOutputUiOnly_1 = require("../../../common/utils/tools/toolOutputUiOnly");
function applyToolOutputRedaction(messages) {
    return messages.map((msg) => {
        if (msg.role !== "assistant")
            return msg;
        const newParts = msg.parts.map((part) => {
            if (part.type !== "dynamic-tool")
                return part;
            if (part.state !== "output-available")
                return part;
            return {
                ...part,
                output: (0, toolOutputUiOnly_1.stripToolOutputUiOnly)(part.output),
            };
        });
        return {
            ...msg,
            parts: newParts,
        };
    });
}
//# sourceMappingURL=applyToolOutputRedaction.js.map