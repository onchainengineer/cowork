"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const modelCapabilities_1 = require("./modelCapabilities");
(0, bun_test_1.describe)("getModelCapabilities", () => {
    (0, bun_test_1.it)("returns capabilities for known models", () => {
        const caps = (0, modelCapabilities_1.getModelCapabilities)("anthropic:claude-sonnet-4-5");
        (0, bun_test_1.expect)(caps).not.toBeNull();
        (0, bun_test_1.expect)(caps?.supportsPdfInput).toBe(true);
        (0, bun_test_1.expect)(caps?.supportsVision).toBe(true);
    });
    (0, bun_test_1.it)("merges models.json + modelsExtra so overrides don't wipe capabilities", () => {
        // claude-opus-4-5 exists in both sources; modelsExtra intentionally overrides
        // pricing/token limits, but it should not wipe upstream capability flags.
        const caps = (0, modelCapabilities_1.getModelCapabilities)("anthropic:claude-opus-4-5");
        (0, bun_test_1.expect)(caps).not.toBeNull();
        (0, bun_test_1.expect)(caps?.supportsPdfInput).toBe(true);
    });
    (0, bun_test_1.it)("returns capabilities for models present only in models-extra", () => {
        // This model is defined in models-extra.ts but not (yet) in upstream models.json.
        const caps = (0, modelCapabilities_1.getModelCapabilities)("openrouter:z-ai/glm-4.6");
        (0, bun_test_1.expect)(caps).not.toBeNull();
    });
    (0, bun_test_1.it)("returns maxPdfSizeMb when present in model metadata", () => {
        const caps = (0, modelCapabilities_1.getModelCapabilities)("google:gemini-1.5-flash");
        (0, bun_test_1.expect)(caps).not.toBeNull();
        (0, bun_test_1.expect)(caps?.supportsPdfInput).toBe(true);
        (0, bun_test_1.expect)(caps?.maxPdfSizeMb).toBeGreaterThan(0);
    });
    (0, bun_test_1.it)("returns null for unknown models", () => {
        (0, bun_test_1.expect)((0, modelCapabilities_1.getModelCapabilities)("anthropic:this-model-does-not-exist")).toBeNull();
    });
});
(0, bun_test_1.describe)("getSupportedInputMediaTypes", () => {
    (0, bun_test_1.it)("includes pdf when model supports_pdf_input is true", () => {
        const supported = (0, modelCapabilities_1.getSupportedInputMediaTypes)("anthropic:claude-sonnet-4-5");
        (0, bun_test_1.expect)(supported).not.toBeNull();
        (0, bun_test_1.expect)(supported?.has("pdf")).toBe(true);
    });
});
//# sourceMappingURL=modelCapabilities.test.js.map