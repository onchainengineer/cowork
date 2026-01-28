"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const sanitizeAnthropicDocumentFilename_1 = require("./sanitizeAnthropicDocumentFilename");
(0, bun_test_1.describe)("sanitizeAnthropicDocumentFilename", () => {
    (0, bun_test_1.it)("replaces periods with spaces", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("file.pdf")).toBe("file pdf");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("report.v2.pdf")).toBe("report v2 pdf");
    });
    (0, bun_test_1.it)("preserves allowed characters", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("my-file")).toBe("my-file");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("file (1)")).toBe("file (1)");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("file [draft]")).toBe("file [draft]");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("Document 2024")).toBe("Document 2024");
    });
    (0, bun_test_1.it)("replaces underscores with spaces", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("my_file_name")).toBe("my file name");
    });
    (0, bun_test_1.it)("collapses consecutive whitespace", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("file...name")).toBe("file name");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("a  b  c")).toBe("a b c");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("file___name")).toBe("file name");
    });
    (0, bun_test_1.it)("trims leading and trailing whitespace", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)(".file.")).toBe("file");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("  spaced  ")).toBe("spaced");
    });
    (0, bun_test_1.it)("returns fallback for undefined input", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)(undefined)).toBe("Document");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)(undefined, "PDF")).toBe("PDF");
    });
    (0, bun_test_1.it)("returns fallback for empty result after sanitization", () => {
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("...")).toBe("Document");
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("___", "Attachment")).toBe("Attachment");
    });
    (0, bun_test_1.it)("handles realistic filenames from the reported issue", () => {
        // Original filename that triggered the error
        (0, bun_test_1.expect)((0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicDocumentFilename)("D19910350Lj.pdf")).toBe("D19910350Lj pdf");
    });
});
(0, bun_test_1.describe)("sanitizeAnthropicPdfFilenames", () => {
    const createUserMessageWithPdf = (filename) => ({
        id: "msg-1",
        role: "user",
        parts: [
            { type: "text", text: "Check this document" },
            {
                type: "file",
                url: "data:application/pdf;base64,JVBERi0...",
                mediaType: "application/pdf",
                filename,
            },
        ],
    });
    (0, bun_test_1.it)("sanitizes PDF filenames in user messages", () => {
        const messages = [createUserMessageWithPdf("report.pdf")];
        const result = (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)(messages);
        (0, bun_test_1.expect)(result[0].parts[1]).toEqual({
            type: "file",
            url: "data:application/pdf;base64,JVBERi0...",
            mediaType: "application/pdf",
            filename: "report pdf",
        });
    });
    (0, bun_test_1.it)("does not mutate original messages", () => {
        const messages = [createUserMessageWithPdf("original.pdf")];
        const originalFilename = messages[0].parts[1].filename;
        (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)(messages);
        (0, bun_test_1.expect)(messages[0].parts[1].filename).toBe(originalFilename);
    });
    (0, bun_test_1.it)("passes through assistant messages unchanged", () => {
        const assistantMessage = {
            id: "msg-2",
            role: "assistant",
            parts: [{ type: "text", text: "Response" }],
        };
        const result = (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)([assistantMessage]);
        (0, bun_test_1.expect)(result).toHaveLength(1);
        (0, bun_test_1.expect)(result[0]).toBe(assistantMessage); // Same reference
    });
    (0, bun_test_1.it)("does not sanitize non-PDF files", () => {
        const imageMessage = {
            id: "msg-3",
            role: "user",
            parts: [
                {
                    type: "file",
                    url: "data:image/png;base64,...",
                    mediaType: "image/png",
                    filename: "screenshot.png",
                },
            ],
        };
        const result = (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)([imageMessage]);
        (0, bun_test_1.expect)(result[0]).toBe(imageMessage); // Same reference - no change
    });
    (0, bun_test_1.it)("handles case-insensitive media type matching", () => {
        const messages = [
            {
                id: "msg-4",
                role: "user",
                parts: [
                    {
                        type: "file",
                        url: "data:application/pdf;base64,...",
                        mediaType: "APPLICATION/PDF", // uppercase
                        filename: "test.pdf",
                    },
                ],
            },
        ];
        const result = (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)(messages);
        (0, bun_test_1.expect)(result[0].parts[0].filename).toBe("test pdf");
    });
    (0, bun_test_1.it)("returns original array if no changes needed", () => {
        const messages = [
            {
                id: "msg-5",
                role: "user",
                parts: [{ type: "text", text: "No attachments here" }],
            },
        ];
        const result = (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)(messages);
        (0, bun_test_1.expect)(result).toBe(messages); // Same array reference
    });
});
//# sourceMappingURL=sanitizeAnthropicDocumentFilename.test.js.map