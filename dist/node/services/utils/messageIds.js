"use strict";
/**
 * Centralized message ID generation helpers.
 *
 * Each message type uses a consistent prefix + timestamp + random suffix pattern.
 * Prefixes are preserved for backward compatibility with existing history.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileAtMentionMessageId = exports.createTaskReportMessageId = exports.createCompactionSummaryMessageId = exports.createAgentSkillSnapshotMessageId = exports.createFileSnapshotMessageId = exports.createAssistantMessageId = exports.createUserMessageId = void 0;
const randomSuffix = (len = 9) => Math.random()
    .toString(36)
    .substring(2, 2 + len);
/** User message IDs: user-{timestamp}-{random} */
const createUserMessageId = () => `user-${Date.now()}-${randomSuffix(9)}`;
exports.createUserMessageId = createUserMessageId;
/** Assistant message IDs: assistant-{timestamp}-{random} */
const createAssistantMessageId = () => `assistant-${Date.now()}-${randomSuffix(9)}`;
exports.createAssistantMessageId = createAssistantMessageId;
/** File snapshot message IDs: file-snapshot-{timestamp}-{random} */
const createFileSnapshotMessageId = () => `file-snapshot-${Date.now()}-${randomSuffix(7)}`;
exports.createFileSnapshotMessageId = createFileSnapshotMessageId;
/** Agent skill snapshot message IDs: agent-skill-snapshot-{timestamp}-{random} */
const createAgentSkillSnapshotMessageId = () => `agent-skill-snapshot-${Date.now()}-${randomSuffix(7)}`;
exports.createAgentSkillSnapshotMessageId = createAgentSkillSnapshotMessageId;
/** Compaction summary message IDs: summary-{timestamp}-{random} */
const createCompactionSummaryMessageId = () => `summary-${Date.now()}-${randomSuffix(9)}`;
exports.createCompactionSummaryMessageId = createCompactionSummaryMessageId;
/** Task report message IDs: task-report-{timestamp}-{random} */
const createTaskReportMessageId = () => `task-report-${Date.now()}-${randomSuffix(9)}`;
exports.createTaskReportMessageId = createTaskReportMessageId;
/** File @mention block message IDs: file-at-mentions-{timestamp}-{index} */
const createFileAtMentionMessageId = (timestamp, index) => `file-at-mentions-${timestamp}-${index}`;
exports.createFileAtMentionMessageId = createFileAtMentionMessageId;
//# sourceMappingURL=messageIds.js.map