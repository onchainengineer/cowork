"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const safeStringifyForCounting_1 = require("./safeStringifyForCounting");
(0, bun_test_1.describe)("safeStringifyForCounting", () => {
    (0, bun_test_1.test)("redacts AI SDK media blocks (base64)", () => {
        const input = {
            type: "media",
            data: "A".repeat(100_000),
            mediaType: "image/png",
        };
        const serialized = (0, safeStringifyForCounting_1.safeStringifyForCounting)(input);
        (0, bun_test_1.expect)(serialized).toContain("[omitted base64 len=100000]");
        (0, bun_test_1.expect)(serialized).not.toContain("A".repeat(1024));
    });
    (0, bun_test_1.test)("redacts base64 data URLs", () => {
        const dataUrl = `data:image/png;base64,${"A".repeat(1000)}`;
        const serialized = (0, safeStringifyForCounting_1.safeStringifyForCounting)({ url: dataUrl });
        (0, bun_test_1.expect)(serialized).toContain("data:image/png;base64,[omitted len=1000]");
        (0, bun_test_1.expect)(serialized).not.toContain("A".repeat(256));
    });
    (0, bun_test_1.test)("does not throw on circular structures", () => {
        const obj = { a: 1 };
        obj.self = obj;
        const serialized = (0, safeStringifyForCounting_1.safeStringifyForCounting)(obj);
        (0, bun_test_1.expect)(serialized).toContain("[circular]");
    });
});
//# sourceMappingURL=safeStringifyForCounting.test.js.map