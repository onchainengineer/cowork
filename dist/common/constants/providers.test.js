"use strict";
/**
 * Test that provider registry structure is correct
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const providers_1 = require("./providers");
(0, bun_test_1.describe)("Provider Registry", () => {
    (0, bun_test_1.test)("registry is not empty", () => {
        (0, bun_test_1.expect)(Object.keys(providers_1.PROVIDER_REGISTRY).length).toBeGreaterThan(0);
    });
    (0, bun_test_1.test)("all registry values are import functions that return promises", () => {
        // Registry should map provider names to functions returning promises
        for (const importFn of Object.values(providers_1.PROVIDER_REGISTRY)) {
            (0, bun_test_1.expect)(typeof importFn).toBe("function");
            // Verify calling the function returns a Promise (don't await - just type check)
            const result = importFn();
            (0, bun_test_1.expect)(result).toBeInstanceOf(Promise);
        }
    });
    (0, bun_test_1.test)("SUPPORTED_PROVIDERS array stays in sync with registry keys", () => {
        // If these don't match, derived array is out of sync
        (0, bun_test_1.expect)(providers_1.SUPPORTED_PROVIDERS.length).toBe(Object.keys(providers_1.PROVIDER_REGISTRY).length);
    });
    (0, bun_test_1.test)("isValidProvider rejects invalid providers", () => {
        (0, bun_test_1.expect)((0, providers_1.isValidProvider)("invalid")).toBe(false);
        (0, bun_test_1.expect)((0, providers_1.isValidProvider)("")).toBe(false);
        (0, bun_test_1.expect)((0, providers_1.isValidProvider)("gpt-4")).toBe(false);
    });
});
//# sourceMappingURL=providers.test.js.map