"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const NotificationEngine_1 = require("./NotificationEngine");
(0, bun_test_1.describe)("NotificationEngine", () => {
    (0, bun_test_1.test)("dedupes by notification content", async () => {
        const engine = new NotificationEngine_1.NotificationEngine([
            {
                // eslint-disable-next-line @typescript-eslint/require-await
                poll: async () => [{ source: "s1", content: "<notification>hi</notification>" }],
            },
        ]);
        const first = await engine.pollAfterToolCall({ toolName: "bash", toolSucceeded: true, now: 0 });
        (0, bun_test_1.expect)(first).toEqual(["<notification>hi</notification>"]);
        const second = await engine.pollAfterToolCall({
            toolName: "bash",
            toolSucceeded: true,
            now: 1,
        });
        (0, bun_test_1.expect)(second).toEqual([]);
    });
    (0, bun_test_1.test)("aggregates across sources", async () => {
        const engine = new NotificationEngine_1.NotificationEngine([
            {
                // eslint-disable-next-line @typescript-eslint/require-await
                poll: async () => [{ source: "s1", content: "<notification>a</notification>" }],
            },
            {
                // eslint-disable-next-line @typescript-eslint/require-await
                poll: async () => [{ source: "s2", content: "<notification>b</notification>" }],
            },
        ]);
        const result = await engine.pollAfterToolCall({
            toolName: "bash",
            toolSucceeded: true,
            now: 0,
        });
        (0, bun_test_1.expect)(result).toEqual(["<notification>a</notification>", "<notification>b</notification>"]);
    });
});
//# sourceMappingURL=NotificationEngine.test.js.map