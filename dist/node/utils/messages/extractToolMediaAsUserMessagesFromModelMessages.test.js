"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const extractToolMediaAsUserMessagesFromModelMessages_1 = require("./extractToolMediaAsUserMessagesFromModelMessages");
(0, globals_1.describe)("extractToolMediaAsUserMessagesFromModelMessages", () => {
    (0, globals_1.it)("moves base64 media out of tool output and into a synthetic user image part", () => {
        const base64 = "A".repeat(50_000);
        const input = [
            { role: "user", content: "hi" },
            {
                role: "tool",
                content: [
                    {
                        type: "tool-result",
                        toolCallId: "call1",
                        toolName: "mcp_chrome_devtools_screenshot",
                        output: {
                            type: "content",
                            value: [{ type: "media", mediaType: "image/png", data: base64 }],
                        },
                    },
                ],
            },
        ];
        const rewritten = (0, extractToolMediaAsUserMessagesFromModelMessages_1.extractToolMediaAsUserMessagesFromModelMessages)(input);
        (0, globals_1.expect)(rewritten).toHaveLength(3);
        const rewrittenTool = rewritten[1];
        (0, globals_1.expect)(rewrittenTool.role).toBe("tool");
        const toolResultPart = rewrittenTool.content[0];
        const outputText = JSON.stringify(toolResultPart.output);
        (0, globals_1.expect)(outputText).toContain("[Image attached:");
        (0, globals_1.expect)(outputText).not.toMatch(/[A]{1000,}/);
        const syntheticUser = rewritten[2];
        (0, globals_1.expect)(syntheticUser.role).toBe("user");
        (0, globals_1.expect)(Array.isArray(syntheticUser.content)).toBe(true);
        const imagePart = Array.isArray(syntheticUser.content)
            ? syntheticUser.content.find((p) => p.type === "image")
            : undefined;
        (0, globals_1.expect)(imagePart).toBeDefined();
        if (imagePart?.type === "image") {
            (0, globals_1.expect)(imagePart.mediaType).toBe("image/png");
            (0, globals_1.expect)(imagePart.image).toBe(base64);
        }
    });
    (0, globals_1.it)("is a no-op when tool outputs have no media", () => {
        const input = [
            {
                role: "tool",
                content: [
                    {
                        type: "tool-result",
                        toolCallId: "call1",
                        toolName: "bash",
                        output: { type: "json", value: { stdout: "/tmp" } },
                    },
                ],
            },
        ];
        const rewritten = (0, extractToolMediaAsUserMessagesFromModelMessages_1.extractToolMediaAsUserMessagesFromModelMessages)(input);
        (0, globals_1.expect)(rewritten).toBe(input);
    });
});
//# sourceMappingURL=extractToolMediaAsUserMessagesFromModelMessages.test.js.map