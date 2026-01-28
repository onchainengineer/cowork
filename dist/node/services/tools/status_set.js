"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStatusSetTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const toolLimits_1 = require("../../../common/constants/toolLimits");
/**
 * Validates that a string is a single emoji character
 * Uses Intl.Segmenter to count grapheme clusters (handles variation selectors, skin tones, etc.)
 */
function isValidEmoji(str) {
    if (!str)
        return false;
    // Use Intl.Segmenter to count grapheme clusters (what users perceive as single characters)
    // This properly handles emojis with variation selectors (like ✏️), skin tones, flags, etc.
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments = [...segmenter.segment(str)];
    // Must be exactly one grapheme cluster
    if (segments.length !== 1) {
        return false;
    }
    // Check if it's an emoji using Unicode properties
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
    return emojiRegex.test(segments[0].segment);
}
/**
 * Truncates a message to a maximum length, adding an ellipsis if truncated
 */
function truncateMessage(message, maxLength) {
    if (message.length <= maxLength) {
        return message;
    }
    // Truncate to maxLength-1 and add ellipsis (total = maxLength)
    return message.slice(0, maxLength - 1) + "…";
}
/**
 * Status set tool factory for AI assistant
 * Creates a tool that allows the AI to set status indicator showing current activity
 *
 * The status is displayed IMMEDIATELY when this tool is called, even before other
 * tool calls complete. This prevents agents from prematurely declaring success
 * (e.g., "PR checks passed") when operations are still pending. Agents should only
 * set success status after confirming the outcome of long-running operations.
 *
 * @param config Required configuration (not used for this tool, but required by interface)
 */
const createStatusSetTool = () => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.status_set.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.status_set.schema,
        execute: ({ emoji, message, url }) => {
            // Validate emoji
            if (!isValidEmoji(emoji)) {
                return Promise.resolve({
                    success: false,
                    error: "emoji must be a single emoji character",
                });
            }
            // Truncate message if necessary
            const truncatedMessage = truncateMessage(message, toolLimits_1.STATUS_MESSAGE_MAX_LENGTH);
            // Tool execution is a no-op on the backend
            // The status is tracked by StreamingMessageAggregator and displayed in the frontend
            return Promise.resolve({
                success: true,
                emoji,
                message: truncatedMessage,
                ...(url && { url }),
            });
        },
    });
};
exports.createStatusSetTool = createStatusSetTool;
//# sourceMappingURL=status_set.js.map