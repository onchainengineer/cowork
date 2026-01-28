"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askUserQuestionManager = exports.AskUserQuestionManager = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
class AskUserQuestionManager {
    pendingByWorkspace = new Map();
    registerPending(workspaceId, toolCallId, questions) {
        (0, strict_1.default)(workspaceId.length > 0, "workspaceId must be non-empty");
        (0, strict_1.default)(toolCallId.length > 0, "toolCallId must be non-empty");
        (0, strict_1.default)(Array.isArray(questions) && questions.length > 0, "questions must be a non-empty array");
        const workspaceMap = this.getOrCreateWorkspaceMap(workspaceId);
        (0, strict_1.default)(!workspaceMap.has(toolCallId), `ask_user_question already pending for toolCallId=${toolCallId}`);
        return new Promise((resolve, reject) => {
            const entry = {
                toolCallId,
                questions,
                createdAt: Date.now(),
                resolve,
                reject,
            };
            workspaceMap.set(toolCallId, entry);
        }).finally(() => {
            // Ensure cleanup no matter how the promise resolves.
            this.deletePending(workspaceId, toolCallId);
        });
    }
    answer(workspaceId, toolCallId, answers) {
        (0, strict_1.default)(workspaceId.length > 0, "workspaceId must be non-empty");
        (0, strict_1.default)(toolCallId.length > 0, "toolCallId must be non-empty");
        (0, strict_1.default)(answers && typeof answers === "object", "answers must be an object");
        const entry = this.getPending(workspaceId, toolCallId);
        entry.resolve(answers);
    }
    cancel(workspaceId, toolCallId, reason) {
        (0, strict_1.default)(workspaceId.length > 0, "workspaceId must be non-empty");
        (0, strict_1.default)(toolCallId.length > 0, "toolCallId must be non-empty");
        (0, strict_1.default)(reason.length > 0, "reason must be non-empty");
        const entry = this.getPending(workspaceId, toolCallId);
        entry.reject(new Error(reason));
    }
    cancelAll(workspaceId, reason) {
        (0, strict_1.default)(workspaceId.length > 0, "workspaceId must be non-empty");
        (0, strict_1.default)(reason.length > 0, "reason must be non-empty");
        const workspaceMap = this.pendingByWorkspace.get(workspaceId);
        if (!workspaceMap) {
            return;
        }
        for (const toolCallId of workspaceMap.keys()) {
            // cancel() will delete from map via finally cleanup
            this.cancel(workspaceId, toolCallId, reason);
        }
    }
    getLatestPending(workspaceId) {
        (0, strict_1.default)(workspaceId.length > 0, "workspaceId must be non-empty");
        const workspaceMap = this.pendingByWorkspace.get(workspaceId);
        if (!workspaceMap || workspaceMap.size === 0) {
            return null;
        }
        let latest = null;
        for (const entry of workspaceMap.values()) {
            if (!latest || entry.createdAt > latest.createdAt) {
                latest = entry;
            }
        }
        (0, strict_1.default)(latest !== null, "Expected latest pending entry to be non-null");
        return {
            toolCallId: latest.toolCallId,
            questions: latest.questions,
        };
    }
    getOrCreateWorkspaceMap(workspaceId) {
        let workspaceMap = this.pendingByWorkspace.get(workspaceId);
        if (!workspaceMap) {
            workspaceMap = new Map();
            this.pendingByWorkspace.set(workspaceId, workspaceMap);
        }
        return workspaceMap;
    }
    getPending(workspaceId, toolCallId) {
        const workspaceMap = this.pendingByWorkspace.get(workspaceId);
        (0, strict_1.default)(workspaceMap, `No pending ask_user_question entries for workspaceId=${workspaceId}`);
        const entry = workspaceMap.get(toolCallId);
        (0, strict_1.default)(entry, `No pending ask_user_question entry for toolCallId=${toolCallId}`);
        return entry;
    }
    deletePending(workspaceId, toolCallId) {
        const workspaceMap = this.pendingByWorkspace.get(workspaceId);
        if (!workspaceMap) {
            return;
        }
        workspaceMap.delete(toolCallId);
        if (workspaceMap.size === 0) {
            this.pendingByWorkspace.delete(workspaceId);
        }
    }
}
exports.AskUserQuestionManager = AskUserQuestionManager;
exports.askUserQuestionManager = new AskUserQuestionManager();
//# sourceMappingURL=askUserQuestionManager.js.map