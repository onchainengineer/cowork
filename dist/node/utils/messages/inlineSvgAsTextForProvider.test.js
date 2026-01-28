"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const inlineSvgAsTextForProvider_1 = require("./inlineSvgAsTextForProvider");
(0, globals_1.describe)("inlineSvgAsTextForProvider", () => {
    (0, globals_1.it)("replaces base64 SVG file parts with text parts", () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
        const b64 = Buffer.from(svg, "utf8").toString("base64");
        const messages = [
            {
                id: "user-1",
                role: "user",
                metadata: { timestamp: 1, historySequence: 1 },
                parts: [
                    { type: "text", text: "hi" },
                    { type: "file", mediaType: "image/svg+xml", url: `data:image/svg+xml;base64,${b64}` },
                ],
            },
        ];
        const result = (0, inlineSvgAsTextForProvider_1.inlineSvgAsTextForProvider)(messages);
        (0, globals_1.expect)(result[0].parts.some((p) => p.type === "file")).toBe(false);
        const textParts = result[0].parts.filter((p) => p.type === "text");
        (0, globals_1.expect)(textParts).toHaveLength(2);
        (0, globals_1.expect)(textParts[1].text).toContain("```svg");
        (0, globals_1.expect)(textParts[1].text).toContain(svg);
    });
    (0, globals_1.it)("supports URL-encoded SVG data URLs", () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>';
        const encoded = encodeURIComponent(svg);
        const messages = [
            {
                id: "user-2",
                role: "user",
                metadata: { timestamp: 1, historySequence: 1 },
                parts: [
                    { type: "text", text: "hi" },
                    { type: "file", mediaType: "image/svg+xml", url: `data:image/svg+xml,${encoded}` },
                ],
            },
        ];
        const result = (0, inlineSvgAsTextForProvider_1.inlineSvgAsTextForProvider)(messages);
        const inlined = result[0].parts.filter((p) => p.type === "text")[1];
        (0, globals_1.expect)(inlined.text).toContain(svg);
    });
    (0, globals_1.it)("omits SVG when decoded SVG exceeds max bytes", () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg">' + "a".repeat(100) + "</svg>";
        const b64 = Buffer.from(svg, "utf8").toString("base64");
        const messages = [
            {
                id: "user-3",
                role: "user",
                metadata: { timestamp: 1, historySequence: 1 },
                parts: [
                    { type: "text", text: "hi" },
                    { type: "file", mediaType: "image/svg+xml", url: `data:image/svg+xml;base64,${b64}` },
                ],
            },
        ];
        const result = (0, inlineSvgAsTextForProvider_1.inlineSvgAsTextForProvider)(messages, { maxSvgTextBytes: 10 });
        const inlined = result[0].parts.filter((p) => p.type === "text")[1];
        (0, globals_1.expect)(inlined.text).toContain("omitted");
        (0, globals_1.expect)(inlined.text).toContain("too large");
    });
    (0, globals_1.it)("omits SVG when decoded SVG exceeds max chars", () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg">' + "a".repeat(100) + "</svg>";
        const b64 = Buffer.from(svg, "utf8").toString("base64");
        const messages = [
            {
                id: "user-3b",
                role: "user",
                metadata: { timestamp: 1, historySequence: 1 },
                parts: [
                    { type: "text", text: "hi" },
                    { type: "file", mediaType: "image/svg+xml", url: `data:image/svg+xml;base64,${b64}` },
                ],
            },
        ];
        const result = (0, inlineSvgAsTextForProvider_1.inlineSvgAsTextForProvider)(messages, { maxSvgTextChars: 10 });
        const inlined = result[0].parts.filter((p) => p.type === "text")[1];
        (0, globals_1.expect)(inlined.text).toContain("omitted");
        (0, globals_1.expect)(inlined.text).toContain("too long");
    });
    (0, globals_1.it)("returns the same array when there are no SVG parts", () => {
        const messages = [
            {
                id: "user-4",
                role: "user",
                metadata: { timestamp: 1, historySequence: 1 },
                parts: [{ type: "text", text: "hi" }],
            },
        ];
        const result = (0, inlineSvgAsTextForProvider_1.inlineSvgAsTextForProvider)(messages);
        (0, globals_1.expect)(result).toBe(messages);
    });
});
//# sourceMappingURL=inlineSvgAsTextForProvider.test.js.map