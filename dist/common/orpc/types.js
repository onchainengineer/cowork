"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCaughtUpMessage = isCaughtUpMessage;
exports.isStreamError = isStreamError;
exports.isDeleteMessage = isDeleteMessage;
exports.isStreamStart = isStreamStart;
exports.isStreamDelta = isStreamDelta;
exports.isStreamEnd = isStreamEnd;
exports.isStreamAbort = isStreamAbort;
exports.isToolCallStart = isToolCallStart;
exports.isToolCallDelta = isToolCallDelta;
exports.isBashOutputEvent = isBashOutputEvent;
exports.isToolCallEnd = isToolCallEnd;
exports.isReasoningDelta = isReasoningDelta;
exports.isReasoningEnd = isReasoningEnd;
exports.isUsageDelta = isUsageDelta;
exports.isUnixMessage = isUnixMessage;
exports.isInitStart = isInitStart;
exports.isInitOutput = isInitOutput;
exports.isInitEnd = isInitEnd;
exports.isQueuedMessageChanged = isQueuedMessageChanged;
exports.isRestoreToInput = isRestoreToInput;
exports.isRuntimeStatus = isRuntimeStatus;
// Type guards for common chat message variants
function isCaughtUpMessage(msg) {
    return msg.type === "caught-up";
}
function isStreamError(msg) {
    return msg.type === "stream-error";
}
function isDeleteMessage(msg) {
    return msg.type === "delete";
}
function isStreamStart(msg) {
    return msg.type === "stream-start";
}
function isStreamDelta(msg) {
    return msg.type === "stream-delta";
}
function isStreamEnd(msg) {
    return msg.type === "stream-end";
}
function isStreamAbort(msg) {
    return msg.type === "stream-abort";
}
function isToolCallStart(msg) {
    return msg.type === "tool-call-start";
}
function isToolCallDelta(msg) {
    return msg.type === "tool-call-delta";
}
function isBashOutputEvent(msg) {
    return msg.type === "bash-output";
}
function isToolCallEnd(msg) {
    return msg.type === "tool-call-end";
}
function isReasoningDelta(msg) {
    return msg.type === "reasoning-delta";
}
function isReasoningEnd(msg) {
    return msg.type === "reasoning-end";
}
function isUsageDelta(msg) {
    return msg.type === "usage-delta";
}
function isUnixMessage(msg) {
    return msg.type === "message";
}
function isInitStart(msg) {
    return msg.type === "init-start";
}
function isInitOutput(msg) {
    return msg.type === "init-output";
}
function isInitEnd(msg) {
    return msg.type === "init-end";
}
function isQueuedMessageChanged(msg) {
    return msg.type === "queued-message-changed";
}
function isRestoreToInput(msg) {
    return msg.type === "restore-to-input";
}
function isRuntimeStatus(msg) {
    return msg.type === "runtime-status";
}
//# sourceMappingURL=types.js.map