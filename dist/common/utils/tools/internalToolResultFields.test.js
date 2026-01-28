"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const internalToolResultFields_1 = require("./internalToolResultFields");
(0, bun_test_1.describe)("internalToolResultFields", () => {
    (0, bun_test_1.test)("attachModelOnlyToolNotifications only attaches to plain objects", () => {
        (0, bun_test_1.expect)((0, internalToolResultFields_1.attachModelOnlyToolNotifications)("hello", ["<n/>"])).toBe("hello");
        const attached = (0, internalToolResultFields_1.attachModelOnlyToolNotifications)({ ok: true }, ["<n/>"]);
        (0, bun_test_1.expect)(attached.ok).toBe(true);
        (0, bun_test_1.expect)(attached[internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD]).toEqual(["<n/>"]);
    });
    (0, bun_test_1.test)("stripInternalToolResultFields removes model-only notifications", () => {
        const input = { ok: true, [internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD]: ["a"] };
        const stripped = (0, internalToolResultFields_1.stripInternalToolResultFields)(input);
        (0, bun_test_1.expect)(stripped.ok).toBe(true);
        (0, bun_test_1.expect)(internalToolResultFields_1.MODEL_ONLY_TOOL_NOTIFICATIONS_FIELD in stripped).toBe(false);
    });
});
//# sourceMappingURL=internalToolResultFields.test.js.map