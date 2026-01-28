"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const askUserQuestionManager_1 = require("../../node/services/askUserQuestionManager");
const QUESTIONS = [
    {
        question: "What should we do?",
        header: "Next",
        options: [
            { label: "A", description: "Option A" },
            { label: "B", description: "Option B" },
        ],
        multiSelect: false,
    },
];
(0, bun_test_1.describe)("AskUserQuestionManager", () => {
    (0, bun_test_1.it)("resolves when answered", async () => {
        const manager = new askUserQuestionManager_1.AskUserQuestionManager();
        const promise = manager.registerPending("ws", "tool-1", [...QUESTIONS]);
        manager.answer("ws", "tool-1", { "What should we do?": "A" });
        const answers = await promise;
        (0, bun_test_1.expect)(answers).toEqual({ "What should we do?": "A" });
        (0, bun_test_1.expect)(manager.getLatestPending("ws")).toBeNull();
    });
    (0, bun_test_1.it)("rejects when canceled", async () => {
        const manager = new askUserQuestionManager_1.AskUserQuestionManager();
        const promise = manager.registerPending("ws", "tool-1", [...QUESTIONS]);
        // Attach handler *before* cancel to avoid Bun treating the rejection as unhandled.
        const caught = promise.catch((err) => err);
        manager.cancel("ws", "tool-1", "User canceled");
        const error = await caught;
        (0, bun_test_1.expect)(error).toBeInstanceOf(Error);
        (0, bun_test_1.expect)(error.message).toContain("User canceled");
        (0, bun_test_1.expect)(manager.getLatestPending("ws")).toBeNull();
    });
    (0, bun_test_1.it)("tracks latest pending per workspace", async () => {
        const manager = new askUserQuestionManager_1.AskUserQuestionManager();
        const promise1 = manager.registerPending("ws", "tool-1", [...QUESTIONS]);
        await new Promise((r) => setTimeout(r, 5));
        const promise2 = manager.registerPending("ws", "tool-2", [...QUESTIONS]);
        (0, bun_test_1.expect)(manager.getLatestPending("ws")?.toolCallId).toEqual("tool-2");
        // Attach handlers *before* cancel to avoid Bun treating the rejection as unhandled.
        const caught1 = promise1.catch((err) => err);
        const caught2 = promise2.catch((err) => err);
        manager.cancel("ws", "tool-1", "cleanup");
        manager.cancel("ws", "tool-2", "cleanup");
        const error1 = await caught1;
        const error2 = await caught2;
        (0, bun_test_1.expect)(error1).toBeInstanceOf(Error);
        (0, bun_test_1.expect)(error2).toBeInstanceOf(Error);
    });
});
//# sourceMappingURL=askUserQuestionManager.test.js.map