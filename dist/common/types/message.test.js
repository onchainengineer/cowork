"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const message_1 = require("./message");
// Helper to create valid ReviewNoteData for tests
const makeReview = (filePath) => ({
    filePath,
    lineRange: "1-10",
    selectedCode: "const x = 1;",
    userNote: "fix this",
});
(0, bun_test_1.describe)("buildContinueMessage", () => {
    (0, bun_test_1.test)("returns undefined when no content provided", () => {
        const result = (0, message_1.buildContinueMessage)({
            model: "test-model",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result).toBeUndefined();
    });
    (0, bun_test_1.test)("returns undefined when text is empty string", () => {
        const result = (0, message_1.buildContinueMessage)({
            text: "",
            model: "test-model",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result).toBeUndefined();
    });
    (0, bun_test_1.test)("returns message when text is provided", () => {
        const result = (0, message_1.buildContinueMessage)({
            text: "hello",
            model: "test-model",
            agentId: "exec",
        });
        // Check individual fields instead of toEqual (branded type can't be matched with plain object)
        (0, bun_test_1.expect)(result?.text).toBe("hello");
        (0, bun_test_1.expect)(result?.model).toBe("test-model");
        (0, bun_test_1.expect)(result?.agentId).toBe("exec");
        (0, bun_test_1.expect)(result?.fileParts).toBeUndefined();
        (0, bun_test_1.expect)(result?.reviews).toBeUndefined();
    });
    (0, bun_test_1.test)("returns message when only images provided", () => {
        const result = (0, message_1.buildContinueMessage)({
            fileParts: [{ url: "data:image/png;base64,abc", mediaType: "image/png" }],
            model: "test-model",
            agentId: "plan",
        });
        (0, bun_test_1.expect)(result?.fileParts?.length).toBe(1);
        (0, bun_test_1.expect)(result?.text).toBe("");
        (0, bun_test_1.expect)(result?.agentId).toBe("plan");
    });
    (0, bun_test_1.test)("preserves unixMetadata when provided", () => {
        const unixMetadata = {
            type: "agent-skill",
            rawCommand: "/test-skill hello",
            skillName: "test-skill",
            scope: "project",
        };
        const result = (0, message_1.buildContinueMessage)({
            text: "hello",
            unixMetadata,
            model: "test-model",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result?.unixMetadata).toEqual(unixMetadata);
    });
    (0, bun_test_1.test)("returns message when only reviews provided", () => {
        const result = (0, message_1.buildContinueMessage)({
            reviews: [makeReview("a.ts")],
            model: "test-model",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result?.reviews?.length).toBe(1);
        (0, bun_test_1.expect)(result?.text).toBe("");
    });
});
(0, bun_test_1.describe)("rebuildContinueMessage", () => {
    (0, bun_test_1.test)("returns undefined when persisted is undefined", () => {
        const result = (0, message_1.rebuildContinueMessage)(undefined, { model: "default", agentId: "exec" });
        (0, bun_test_1.expect)(result).toBeUndefined();
    });
    (0, bun_test_1.test)("returns undefined when persisted has no content", () => {
        const result = (0, message_1.rebuildContinueMessage)({}, { model: "default", agentId: "exec" });
        (0, bun_test_1.expect)(result).toBeUndefined();
    });
    (0, bun_test_1.test)("uses persisted values when available", () => {
        const result = (0, message_1.rebuildContinueMessage)({ text: "continue", model: "persisted-model", agentId: "plan" }, { model: "default", agentId: "exec" });
        (0, bun_test_1.expect)(result?.text).toBe("continue");
        (0, bun_test_1.expect)(result?.model).toBe("persisted-model");
        (0, bun_test_1.expect)(result?.agentId).toBe("plan");
    });
    (0, bun_test_1.test)("migrates legacy mode to agentId", () => {
        const result = (0, message_1.rebuildContinueMessage)({ text: "continue", mode: "plan" }, { model: "default-model", agentId: "exec" });
        (0, bun_test_1.expect)(result?.agentId).toBe("plan");
    });
    (0, bun_test_1.test)("prefers persisted agentId over legacy mode", () => {
        const result = (0, message_1.rebuildContinueMessage)({ text: "continue", agentId: "custom-agent", mode: "plan" }, { model: "default-model", agentId: "exec" });
        (0, bun_test_1.expect)(result?.agentId).toBe("custom-agent");
    });
    (0, bun_test_1.test)("uses defaults when persisted values missing", () => {
        const result = (0, message_1.rebuildContinueMessage)({ text: "continue" }, { model: "default-model", agentId: "plan" });
        (0, bun_test_1.expect)(result?.text).toBe("continue");
        (0, bun_test_1.expect)(result?.model).toBe("default-model");
        (0, bun_test_1.expect)(result?.agentId).toBe("plan");
    });
    (0, bun_test_1.test)("preserves unixMetadata from persisted data", () => {
        const unixMetadata = {
            type: "agent-skill",
            rawCommand: "/test-skill hello",
            skillName: "test-skill",
            scope: "project",
        };
        const result = (0, message_1.rebuildContinueMessage)({ text: "continue", unixMetadata }, { model: "m", agentId: "exec" });
        (0, bun_test_1.expect)(result?.unixMetadata).toEqual(unixMetadata);
    });
    (0, bun_test_1.test)("preserves reviews from persisted data", () => {
        const review = makeReview("a.ts");
        const result = (0, message_1.rebuildContinueMessage)({ text: "review this", reviews: [review] }, { model: "m", agentId: "exec" });
        (0, bun_test_1.expect)(result?.reviews?.length).toBe(1);
        (0, bun_test_1.expect)(result?.reviews?.[0].filePath).toBe("a.ts");
    });
    (0, bun_test_1.test)("preserves fileParts from persisted data", () => {
        const result = (0, message_1.rebuildContinueMessage)({
            text: "with image",
            fileParts: [{ url: "data:image/png;base64,xyz", mediaType: "image/png" }],
        }, { model: "m", agentId: "exec" });
        (0, bun_test_1.expect)(result?.fileParts?.length).toBe(1);
    });
});
//# sourceMappingURL=message.test.js.map