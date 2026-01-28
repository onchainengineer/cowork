"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const tokenizer_1 = require("./tokenizer");
const knownModels_1 = require("../../../common/constants/knownModels");
globals_1.jest.setTimeout(20000);
const openaiModel = knownModels_1.KNOWN_MODELS.GPT.id;
const googleModel = knownModels_1.KNOWN_MODELS.GEMINI_3_PRO.id;
(0, globals_1.beforeAll)(async () => {
    // warm up the worker_thread and tokenizer before running tests
    const results = await (0, tokenizer_1.loadTokenizerModules)([openaiModel, googleModel]);
    (0, globals_1.expect)(results).toHaveLength(2);
    (0, globals_1.expect)(results[0]).toMatchObject({ status: "fulfilled" });
    (0, globals_1.expect)(results[1]).toMatchObject({ status: "fulfilled" });
});
(0, globals_1.beforeEach)(() => {
    (0, tokenizer_1.__resetTokenizerForTests)();
});
(0, globals_1.describe)("tokenizer", () => {
    (0, globals_1.test)("loadTokenizerModules warms known encodings", async () => {
        const tokenizer = await (0, tokenizer_1.getTokenizerForModel)(openaiModel);
        (0, globals_1.expect)(typeof tokenizer.encoding).toBe("string");
        (0, globals_1.expect)(tokenizer.encoding.length).toBeGreaterThan(0);
    });
    (0, globals_1.test)("countTokens returns stable values", async () => {
        const text = "unix-tokenizer-smoke-test";
        const first = await (0, tokenizer_1.countTokens)(openaiModel, text);
        const second = await (0, tokenizer_1.countTokens)(openaiModel, text);
        (0, globals_1.expect)(first).toBeGreaterThan(0);
        (0, globals_1.expect)(second).toBe(first);
    });
    (0, globals_1.test)("countTokensBatch matches individual calls", async () => {
        const texts = ["alpha", "beta", "gamma"];
        const batch = await (0, tokenizer_1.countTokensBatch)(openaiModel, texts);
        (0, globals_1.expect)(batch).toHaveLength(texts.length);
        const individual = await Promise.all(texts.map((text) => (0, tokenizer_1.countTokens)(openaiModel, text)));
        (0, globals_1.expect)(batch).toEqual(individual);
    });
    (0, globals_1.test)("getTokenizerForModel supports google gemini 3 via override", async () => {
        const tokenizer = await (0, tokenizer_1.getTokenizerForModel)(googleModel);
        (0, globals_1.expect)(typeof tokenizer.encoding).toBe("string");
        (0, globals_1.expect)(tokenizer.encoding.length).toBeGreaterThan(0);
    });
    (0, globals_1.test)("countTokens returns stable values for google gemini 3", async () => {
        const text = "unix-google-tokenizer-test";
        const first = await (0, tokenizer_1.countTokens)(googleModel, text);
        const second = await (0, tokenizer_1.countTokens)(googleModel, text);
        (0, globals_1.expect)(first).toBeGreaterThan(0);
        (0, globals_1.expect)(second).toBe(first);
    });
});
//# sourceMappingURL=tokenizer.test.js.map