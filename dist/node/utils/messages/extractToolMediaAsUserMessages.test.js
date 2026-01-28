"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const extractToolMediaAsUserMessages_1 = require("./extractToolMediaAsUserMessages");
(0, globals_1.describe)("extractToolMediaAsUserMessages", () => {
    (0, globals_1.it)("moves base64 media out of tool output and into a synthetic user file part", () => {
        const base64 = "A".repeat(50_000);
        const input = [
            {
                id: "a1",
                role: "assistant",
                parts: [
                    {
                        type: "dynamic-tool",
                        toolCallId: "call1",
                        toolName: "mcp_chrome_devtools_screenshot",
                        input: { tabId: 1 },
                        state: "output-available",
                        output: {
                            type: "content",
                            value: [{ type: "media", mediaType: "image/png", data: base64 }],
                        },
                    },
                ],
                metadata: { timestamp: 1 },
            },
        ];
        const rewritten = (0, extractToolMediaAsUserMessages_1.extractToolMediaAsUserMessages)(input);
        (0, globals_1.expect)(rewritten).toHaveLength(2);
        const rewrittenAssistant = rewritten[0];
        (0, globals_1.expect)(rewrittenAssistant.role).toBe("assistant");
        const toolPart = rewrittenAssistant.parts[0];
        (0, globals_1.expect)(toolPart.type).toBe("dynamic-tool");
        if (toolPart.type === "dynamic-tool" && toolPart.state === "output-available") {
            const outputText = JSON.stringify(toolPart.output);
            (0, globals_1.expect)(outputText).toContain("[Image attached:");
            (0, globals_1.expect)(outputText).not.toMatch(/[A]{1000,}/);
        }
        const syntheticUser = rewritten[1];
        (0, globals_1.expect)(syntheticUser.role).toBe("user");
        (0, globals_1.expect)(syntheticUser.metadata?.synthetic).toBe(true);
        const filePart = syntheticUser.parts.find((p) => p.type === "file");
        (0, globals_1.expect)(filePart).toBeDefined();
        if (filePart?.type === "file") {
            (0, globals_1.expect)(filePart.mediaType).toBe("image/png");
            (0, globals_1.expect)(filePart.url.startsWith("data:image/png;base64,")).toBe(true);
            // Full base64 is expected in the file url, but NOT in tool output JSON.
            (0, globals_1.expect)(filePart.url).toContain(base64.slice(0, 100));
        }
    });
    (0, globals_1.it)("is a no-op when tool outputs have no media", () => {
        const input = [
            {
                id: "a1",
                role: "assistant",
                parts: [
                    {
                        type: "dynamic-tool",
                        toolCallId: "call1",
                        toolName: "bash",
                        input: { script: "pwd" },
                        state: "output-available",
                        output: { type: "json", value: { stdout: "/tmp" } },
                    },
                ],
                metadata: { timestamp: 1 },
            },
        ];
        const rewritten = (0, extractToolMediaAsUserMessages_1.extractToolMediaAsUserMessages)(input);
        (0, globals_1.expect)(rewritten).toEqual(input);
    });
});
//# sourceMappingURL=extractToolMediaAsUserMessages.test.js.map