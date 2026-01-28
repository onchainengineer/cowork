"use strict";
/**
 * UI-related constants shared across components
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECTION_COLOR = exports.SECTION_COLOR_PALETTE = exports.COPY_FEEDBACK_DURATION_MS = exports.FORCE_COMPACTION_BUFFER_PERCENT = exports.WORDS_TO_TOKENS_RATIO = exports.DEFAULT_COMPACTION_WORD_TARGET = exports.DEFAULT_AUTO_COMPACTION_THRESHOLD = exports.DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT = exports.AUTO_COMPACTION_THRESHOLD_MAX = exports.AUTO_COMPACTION_THRESHOLD_MIN = void 0;
exports.buildCompactionPrompt = buildCompactionPrompt;
exports.resolveSectionColor = resolveSectionColor;
/**
 * Auto-compaction threshold bounds (percentage)
 * MIN: Allow any value - user can choose aggressive compaction if desired
 * MAX: Cap at 90% to leave buffer before hitting context limit
 */
exports.AUTO_COMPACTION_THRESHOLD_MIN = 0;
exports.AUTO_COMPACTION_THRESHOLD_MAX = 90;
/**
 * Default auto-compaction threshold percentage (50-90 range)
 * Applied when creating new workspaces
 */
exports.DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT = 70;
/**
 * Default threshold as decimal for calculations (0.7 = 70%)
 */
exports.DEFAULT_AUTO_COMPACTION_THRESHOLD = exports.DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT / 100;
/**
 * Default word target for compaction summaries
 */
exports.DEFAULT_COMPACTION_WORD_TARGET = 2000;
/**
 * Approximate ratio of tokens to words (tokens per word)
 * Used for converting between word counts and token counts
 */
exports.WORDS_TO_TOKENS_RATIO = 1.3;
/**
 * Build the compaction prompt for a given word target.
 * Shared across desktop and mobile clients.
 */
function buildCompactionPrompt(targetWords) {
    return `Summarize this conversation for a new Assistant to continue helping the user.

Your summary must be approximately ${targetWords} words.

Include:
- The user's overall goal and current task
- Key decisions made and their rationale
- Current state of the work (what's done, what's in progress)
- Important technical details (file paths, function names, configurations)
- Any errors encountered and how they were resolved
- Unresolved issues or blockers

Do not include:
- Suggestions for next steps
- Conversational filler or pleasantries
- Redundant information

Write in a factual, dense style. Every sentence should convey essential context.`;
}
/**
 * Force-compact this many percentage points after threshold.
 * Gives user a buffer zone between warning and force-compaction.
 * E.g., with 70% threshold, force-compact triggers at 75%.
 */
exports.FORCE_COMPACTION_BUFFER_PERCENT = 5;
/**
 * Duration (ms) to show "copied" feedback after copying to clipboard
 */
exports.COPY_FEEDBACK_DURATION_MS = 2000;
/**
 * Predefined color palette for project sections.
 * Each color is designed to work well with the dark theme.
 * Format: [name, hex value]
 */
exports.SECTION_COLOR_PALETTE = [
    ["Gray", "#6b7280"],
    ["Slate", "#64748b"],
    ["Blue", "#5a9bd4"],
    ["Cyan", "#22d3ee"],
    ["Teal", "#4ab5a7"],
    ["Green", "#4caf7c"],
    ["Yellow", "#d9b836"],
    ["Orange", "#e5853a"],
    ["Red", "#e54545"],
    ["Pink", "#d465a5"],
];
/**
 * Default color for new sections (neutral gray)
 */
exports.DEFAULT_SECTION_COLOR = exports.SECTION_COLOR_PALETTE[0][1];
/**
 * Resolve a section color string (hex value or preset name) to a canonical hex color.
 *
 * Sections persist their color to config.json as a string, which may be either:
 * - a hex color (e.g. "#5a9bd4")
 * - a palette name (e.g. "Blue")
 *
 * For consistent rendering (and for safely appending hex alpha like "10"), we normalize
 * to a 6-digit "#rrggbb" string.
 */
function resolveSectionColor(color) {
    if (!color) {
        return exports.DEFAULT_SECTION_COLOR;
    }
    const trimmed = color.trim();
    if (trimmed.length === 0) {
        return exports.DEFAULT_SECTION_COLOR;
    }
    const paletteMatch = exports.SECTION_COLOR_PALETTE.find(([name]) => name.toLowerCase() === trimmed.toLowerCase());
    if (paletteMatch) {
        return paletteMatch[1];
    }
    const hex3Match = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
    if (hex3Match) {
        const [r, g, b] = hex3Match[1].split("");
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    const hex6Match = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
    if (hex6Match) {
        return `#${hex6Match[1]}`.toLowerCase();
    }
    // If the stored value includes an alpha channel, drop it so downstream code can
    // safely apply its own alpha.
    const hex8Match = /^#([0-9a-fA-F]{8})$/.exec(trimmed);
    if (hex8Match) {
        return `#${hex8Match[1].slice(0, 6)}`.toLowerCase();
    }
    return exports.DEFAULT_SECTION_COLOR;
}
//# sourceMappingURL=ui.js.map