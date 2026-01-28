"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const server_1 = require("@orpc/server");
const formatOrpcError_1 = require("./formatOrpcError");
(0, bun_test_1.describe)("formatOrpcError", () => {
    (0, bun_test_1.test)("formats output validation errors with request context + issues", () => {
        const cause = new server_1.ValidationError({
            message: "Validation failed",
            issues: [
                {
                    message: "Invalid type",
                    path: ["slots", 0, "preset"],
                },
            ],
            data: { version: 2, slots: [] },
        });
        const error = new server_1.ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Output validation failed",
            cause,
        });
        const formatted = (0, formatOrpcError_1.formatOrpcError)(error, {
            prefix: "/orpc",
            request: {
                method: "GET",
                url: new URL("http://localhost/orpc/uiLayouts/getAll"),
                headers: { authorization: "Bearer secret" },
            },
        });
        (0, bun_test_1.expect)(formatted.message).toContain("GET /orpc/uiLayouts/getAll");
        (0, bun_test_1.expect)(formatted.message).toContain("INTERNAL_SERVER_ERROR");
        (0, bun_test_1.expect)(formatted.message).toContain("Output validation failed");
        (0, bun_test_1.expect)(formatted.message).toContain("slots[0].preset");
        // The whole point of this formatter is to avoid useless `[Object]` / `[Array]` output.
        (0, bun_test_1.expect)(formatted.message).not.toContain("[Object]");
        (0, bun_test_1.expect)(formatted.message).not.toContain("[Array]");
        const request = formatted.debugDump.request;
        const headers = request.headers;
        (0, bun_test_1.expect)(headers.authorization).toBe("<redacted>");
    });
    (0, bun_test_1.test)("does not throw for non-error values", () => {
        const formatted = (0, formatOrpcError_1.formatOrpcError)({ hello: "world" });
        (0, bun_test_1.expect)(formatted.message).toContain("ORPC");
        (0, bun_test_1.expect)(formatted.message).toContain("hello");
    });
});
//# sourceMappingURL=formatOrpcError.test.js.map