"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const startHerePlanSummary_1 = require("./startHerePlanSummary");
function createTextMessage(overrides) {
    return {
        id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
        role: overrides.role ?? "assistant",
        parts: overrides.parts ?? [{ type: "text", text: "hello" }],
        metadata: overrides.metadata,
    };
}
(0, bun_test_1.describe)("isStartHerePlanSummaryMessage", () => {
    (0, bun_test_1.it)("returns true for Start Here summary messages that include plan content", () => {
        const msg = createTextMessage({
            id: "start-here-123",
            role: "assistant",
            metadata: { compacted: "user", agentId: "plan" },
            parts: [
                {
                    type: "text",
                    text: "# My Plan\n\n## Step\n- Do the thing\n\n---\n\n*Plan file preserved at:* `~/.unix/plans/demo.md`",
                },
            ],
        });
        (0, bun_test_1.expect)((0, startHerePlanSummary_1.isStartHerePlanSummaryMessage)(msg)).toBe(true);
    });
    (0, bun_test_1.it)("returns false for Start Here summaries that only include the placeholder", () => {
        const msg = createTextMessage({
            id: "start-here-123",
            role: "assistant",
            metadata: { compacted: "user", agentId: "plan" },
            parts: [
                {
                    type: "text",
                    text: [
                        "# My Plan",
                        "",
                        "*Plan saved to /tmp/demo.md*",
                        "",
                        "Note: This chat already contains the full plan; no need to re-open the plan file.",
                        "",
                        "---",
                        "",
                        "*Plan file preserved at:* `/tmp/demo.md`",
                    ].join("\n"),
                },
            ],
        });
        (0, bun_test_1.expect)((0, startHerePlanSummary_1.isStartHerePlanSummaryMessage)(msg)).toBe(false);
    });
    (0, bun_test_1.it)("returns false for other Start Here messages from the plan agent", () => {
        const msg = createTextMessage({
            id: "start-here-123",
            role: "assistant",
            metadata: { compacted: "user", agentId: "plan" },
            parts: [{ type: "text", text: "Some other message" }],
        });
        (0, bun_test_1.expect)((0, startHerePlanSummary_1.isStartHerePlanSummaryMessage)(msg)).toBe(false);
    });
    (0, bun_test_1.it)("returns false for normal assistant messages", () => {
        const msg = createTextMessage({
            id: "msg-1",
            role: "assistant",
            metadata: { agentId: "plan" },
            parts: [{ type: "text", text: "# My Plan" }],
        });
        (0, bun_test_1.expect)((0, startHerePlanSummary_1.isStartHerePlanSummaryMessage)(msg)).toBe(false);
    });
});
(0, bun_test_1.describe)("hasStartHerePlanSummary", () => {
    (0, bun_test_1.it)("returns true when a Start Here plan summary exists anywhere in history", () => {
        const messages = [
            createTextMessage({
                id: "start-here-123",
                role: "assistant",
                metadata: { compacted: "user", agentId: "plan" },
                parts: [
                    {
                        type: "text",
                        text: "# My Plan\n\n## Step\n- Do the thing\n\n---\n\n*Plan file preserved at:* `~/.unix/plans/demo.md`",
                    },
                ],
            }),
            createTextMessage({
                id: "user-1",
                role: "user",
                parts: [{ type: "text", text: "Implement the plan" }],
            }),
            createTextMessage({ id: "msg-2", role: "assistant", metadata: { agentId: "exec" } }),
        ];
        (0, bun_test_1.expect)((0, startHerePlanSummary_1.hasStartHerePlanSummary)(messages)).toBe(true);
    });
});
//# sourceMappingURL=startHerePlanSummary.test.js.map