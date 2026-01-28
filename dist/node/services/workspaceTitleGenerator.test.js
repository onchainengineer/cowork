"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const workspaceTitleGenerator_1 = require("./workspaceTitleGenerator");
// Helper to create a mock AIService that succeeds for specific models
function createMockAIService(availableModels) {
    const service = {
        createModel: (modelString) => {
            if (availableModels.includes(modelString)) {
                const result = { success: true, data: null };
                return Promise.resolve(result);
            }
            const err = {
                success: false,
                error: { type: "api_key_not_found", provider: "test" },
            };
            return Promise.resolve(err);
        },
    };
    return service;
}
(0, bun_test_1.describe)("workspaceTitleGenerator", () => {
    (0, bun_test_1.describe)("findAvailableModel", () => {
        (0, bun_test_1.it)("returns null when no models available", async () => {
            const aiService = createMockAIService([]);
            (0, bun_test_1.expect)(await (0, workspaceTitleGenerator_1.findAvailableModel)(aiService, ["model-a", "model-b"])).toBeNull();
        });
        (0, bun_test_1.it)("returns null for empty models list", async () => {
            const aiService = createMockAIService(["any-model"]);
            (0, bun_test_1.expect)(await (0, workspaceTitleGenerator_1.findAvailableModel)(aiService, [])).toBeNull();
        });
        (0, bun_test_1.it)("returns first available model", async () => {
            const aiService = createMockAIService(["model-b", "model-c"]);
            const model = await (0, workspaceTitleGenerator_1.findAvailableModel)(aiService, ["model-a", "model-b", "model-c"]);
            (0, bun_test_1.expect)(model).toBe("model-b");
        });
        (0, bun_test_1.it)("tries models in order", async () => {
            const aiService = createMockAIService(["model-a", "model-b"]);
            const model = await (0, workspaceTitleGenerator_1.findAvailableModel)(aiService, ["model-a", "model-b"]);
            (0, bun_test_1.expect)(model).toBe("model-a");
        });
    });
});
//# sourceMappingURL=workspaceTitleGenerator.test.js.map