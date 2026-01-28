"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const tokenMeterUtils_1 = require("./tokenMeterUtils");
(0, bun_test_1.describe)("formatTokens", () => {
    (0, bun_test_1.test)("formats small numbers as-is with locale formatting", () => {
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(0)).toBe("0");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(500)).toBe("500");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(999)).toBe("999");
    });
    (0, bun_test_1.test)("formats thousands with k suffix", () => {
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(1000)).toBe("1.0k");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(1500)).toBe("1.5k");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(58507)).toBe("58.5k");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(999_999)).toBe("1000.0k");
    });
    (0, bun_test_1.test)("formats millions with M suffix", () => {
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(1_000_000)).toBe("1.0M");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(1_500_000)).toBe("1.5M");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(58_507_900)).toBe("58.5M");
        (0, bun_test_1.expect)((0, tokenMeterUtils_1.formatTokens)(4_133_000)).toBe("4.1M");
    });
});
//# sourceMappingURL=tokenMeterUtils.test.js.map