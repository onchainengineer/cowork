"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const events_1 = require("events");
const mockAiStreamPlayer_1 = require("./mockAiStreamPlayer");
const message_1 = require("../../../common/types/message");
const result_1 = require("../../../common/types/result");
class InMemoryHistoryService {
    appended = [];
    messages = new Map();
    nextSequence = 0;
    appendToHistory(workspaceId, message) {
        message.metadata ?? (message.metadata = {});
        if (message.metadata.historySequence === undefined) {
            message.metadata.historySequence = this.nextSequence++;
        }
        else if (message.metadata.historySequence >= this.nextSequence) {
            this.nextSequence = message.metadata.historySequence + 1;
        }
        this.appended.push({ workspaceId, message });
        const existing = this.messages.get(workspaceId) ?? [];
        this.messages.set(workspaceId, [...existing, message]);
        return Promise.resolve((0, result_1.Ok)(undefined));
    }
    deleteMessage(workspaceId, messageId) {
        const existing = this.messages.get(workspaceId) ?? [];
        this.messages.set(workspaceId, existing.filter((message) => message.id !== messageId));
        return Promise.resolve((0, result_1.Ok)(undefined));
    }
}
function readWorkspaceId(payload) {
    if (!payload || typeof payload !== "object")
        return undefined;
    if (!("workspaceId" in payload))
        return undefined;
    const workspaceId = payload.workspaceId;
    return typeof workspaceId === "string" ? workspaceId : undefined;
}
(0, bun_test_1.describe)("MockAiStreamPlayer", () => {
    (0, bun_test_1.test)("appends assistant placeholder even when router turn ends with stream error", async () => {
        const historyStub = new InMemoryHistoryService();
        const aiServiceStub = new events_1.EventEmitter();
        const player = new mockAiStreamPlayer_1.MockAiStreamPlayer({
            historyService: historyStub,
            aiService: aiServiceStub,
        });
        const workspaceId = "workspace-1";
        const firstTurnUser = (0, message_1.createUnixMessage)("user-1", "user", "[mock:list-languages] List 3 programming languages", {
            timestamp: Date.now(),
        });
        const firstResult = await player.play([firstTurnUser], workspaceId);
        (0, bun_test_1.expect)(firstResult.success).toBe(true);
        player.stop(workspaceId);
        const historyBeforeSecondTurn = historyStub.appended.map((entry) => entry.message);
        const secondTurnUser = (0, message_1.createUnixMessage)("user-2", "user", "[mock:error:api] Trigger API error", {
            timestamp: Date.now(),
        });
        const secondResult = await player.play([firstTurnUser, ...historyBeforeSecondTurn, secondTurnUser], workspaceId);
        (0, bun_test_1.expect)(secondResult.success).toBe(true);
        (0, bun_test_1.expect)(historyStub.appended).toHaveLength(2);
        const [firstAppend, secondAppend] = historyStub.appended;
        (0, bun_test_1.expect)(firstAppend.message.id).not.toBe(secondAppend.message.id);
        const firstSeq = firstAppend.message.metadata?.historySequence ?? -1;
        const secondSeq = secondAppend.message.metadata?.historySequence ?? -1;
        (0, bun_test_1.expect)(secondSeq).toBe(firstSeq + 1);
        player.stop(workspaceId);
    });
    (0, bun_test_1.test)("removes assistant placeholder when aborted before stream scheduling", async () => {
        class DeferredHistoryService extends InMemoryHistoryService {
            appendGateResolve;
            appendGate = new Promise((resolve) => {
                this.appendGateResolve = resolve;
            });
            appendedMessageResolve;
            appendedMessage = new Promise((resolve) => {
                this.appendedMessageResolve = resolve;
            });
            appendToHistory(workspaceId, message) {
                void super.appendToHistory(workspaceId, message);
                this.appendedMessageResolve?.(message);
                return this.appendGate;
            }
            resolveAppend() {
                this.appendGateResolve?.((0, result_1.Ok)(undefined));
            }
        }
        const historyStub = new DeferredHistoryService();
        const aiServiceStub = new events_1.EventEmitter();
        const player = new mockAiStreamPlayer_1.MockAiStreamPlayer({
            historyService: historyStub,
            aiService: aiServiceStub,
        });
        const workspaceId = "workspace-abort-startup";
        const userMessage = (0, message_1.createUnixMessage)("user-1", "user", "[mock:list-languages] List 3 programming languages", {
            timestamp: Date.now(),
        });
        const abortController = new AbortController();
        const playPromise = player.play([userMessage], workspaceId, {
            abortSignal: abortController.signal,
        });
        const assistantMessage = await historyStub.appendedMessage;
        historyStub.resolveAppend();
        abortController.abort();
        const result = await playPromise;
        (0, bun_test_1.expect)(result.success).toBe(true);
        const storedMessages = historyStub.messages.get(workspaceId) ?? [];
        (0, bun_test_1.expect)(storedMessages.some((msg) => msg.id === assistantMessage.id)).toBe(false);
    });
    (0, bun_test_1.test)("stop prevents queued stream events from emitting", async () => {
        const historyStub = new InMemoryHistoryService();
        const aiServiceStub = new events_1.EventEmitter();
        const player = new mockAiStreamPlayer_1.MockAiStreamPlayer({
            historyService: historyStub,
            aiService: aiServiceStub,
        });
        const workspaceId = "workspace-2";
        let deltaCount = 0;
        let abortCount = 0;
        let stopped = false;
        aiServiceStub.on("stream-abort", (payload) => {
            if (readWorkspaceId(payload) === workspaceId) {
                abortCount += 1;
            }
        });
        const firstDelta = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timed out waiting for stream-delta"));
            }, 1000);
            aiServiceStub.on("stream-delta", (payload) => {
                if (readWorkspaceId(payload) !== workspaceId)
                    return;
                deltaCount += 1;
                if (!stopped) {
                    stopped = true;
                    clearTimeout(timeout);
                    player.stop(workspaceId);
                    resolve();
                }
            });
        });
        const forceTurnUser = (0, message_1.createUnixMessage)("user-force", "user", "[force] keep streaming", {
            timestamp: Date.now(),
        });
        const playResult = await player.play([forceTurnUser], workspaceId);
        (0, bun_test_1.expect)(playResult.success).toBe(true);
        await firstDelta;
        const deltasAtStop = deltaCount;
        await new Promise((resolve) => setTimeout(resolve, 150));
        (0, bun_test_1.expect)(deltaCount).toBe(deltasAtStop);
        (0, bun_test_1.expect)(abortCount).toBe(1);
    });
});
//# sourceMappingURL=mockAiStreamPlayer.test.js.map