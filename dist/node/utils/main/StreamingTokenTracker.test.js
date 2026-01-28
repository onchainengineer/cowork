"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const knownModels_1 = require("../../../common/constants/knownModels");
const StreamingTokenTracker_1 = require("./StreamingTokenTracker");
globals_1.jest.setTimeout(20000);
(0, globals_1.describe)("StreamingTokenTracker", () => {
    let tracker;
    (0, globals_1.beforeEach)(() => {
        tracker = new StreamingTokenTracker_1.StreamingTokenTracker();
    });
    (0, globals_1.describe)("countTokens", () => {
        (0, globals_1.test)("returns 0 for empty string", async () => {
            await tracker.setModel(knownModels_1.KNOWN_MODELS.SONNET.id);
            (0, globals_1.expect)(await tracker.countTokens("")).toBe(0);
        });
        (0, globals_1.test)("counts tokens in simple text", async () => {
            await tracker.setModel(knownModels_1.KNOWN_MODELS.SONNET.id);
            const count = await tracker.countTokens("Hello world");
            (0, globals_1.expect)(count).toBeGreaterThan(0);
            (0, globals_1.expect)(count).toBeLessThan(10); // Reasonable upper bound
        });
        (0, globals_1.test)("counts tokens in longer text", async () => {
            await tracker.setModel(knownModels_1.KNOWN_MODELS.SONNET.id);
            const text = "This is a longer piece of text with more tokens";
            const count = await tracker.countTokens(text);
            (0, globals_1.expect)(count).toBeGreaterThan(5);
        });
        (0, globals_1.test)("handles special characters", async () => {
            await tracker.setModel(knownModels_1.KNOWN_MODELS.SONNET.id);
            const count = await tracker.countTokens("🚀 emoji test");
            (0, globals_1.expect)(count).toBeGreaterThan(0);
        });
        (0, globals_1.test)("is consistent for repeated calls", async () => {
            await tracker.setModel(knownModels_1.KNOWN_MODELS.SONNET.id);
            const text = "Test consistency";
            const count1 = await tracker.countTokens(text);
            const count2 = await tracker.countTokens(text);
            (0, globals_1.expect)(count1).toBe(count2);
        });
    });
    (0, globals_1.describe)("setModel", () => {
        (0, globals_1.test)("switches tokenizer for different models", async () => {
            await tracker.setModel(knownModels_1.KNOWN_MODELS.SONNET.id);
            const initial = await tracker.countTokens("test");
            await tracker.setModel("openai:gpt-4");
            const switched = await tracker.countTokens("test");
            (0, globals_1.expect)(initial).toBeGreaterThan(0);
            (0, globals_1.expect)(switched).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=StreamingTokenTracker.test.js.map