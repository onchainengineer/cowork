"use strict";
/**
 * Constants for the post-compaction attachment system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_POST_COMPACTION_PLAN_CHARS = exports.MAX_POST_COMPACTION_INJECTION_CHARS = exports.MAX_EDITED_FILES = exports.MAX_FILE_CONTENT_SIZE = exports.TURNS_BETWEEN_ATTACHMENTS = void 0;
/** Number of turns between post-compaction attachment injections after the first immediate injection */
exports.TURNS_BETWEEN_ATTACHMENTS = 5;
/** Maximum size of file content before truncation (50KB) */
exports.MAX_FILE_CONTENT_SIZE = 50_000;
/** Maximum number of edited files to include in attachments */
exports.MAX_EDITED_FILES = 10;
/**
 * Maximum total size of the post-compaction context injection.
 *
 * Note: This is a character-based heuristic (provider-agnostic) to avoid large diffs/plan files
 * causing context_exceeded loops even after compaction.
 */
exports.MAX_POST_COMPACTION_INJECTION_CHARS = 80_000;
/** Maximum size of plan content included in post-compaction attachments */
exports.MAX_POST_COMPACTION_PLAN_CHARS = 30_000;
//# sourceMappingURL=attachments.js.map