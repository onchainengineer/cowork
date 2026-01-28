"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const messageQueue_1 = require("./messageQueue");
(0, bun_test_1.describe)("MessageQueue", () => {
    let queue;
    (0, bun_test_1.beforeEach)(() => {
        queue = new messageQueue_1.MessageQueue();
    });
    (0, bun_test_1.describe)("getDisplayText", () => {
        (0, bun_test_1.it)("should return joined messages for normal messages", () => {
            queue.add("First message");
            queue.add("Second message");
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("First message\nSecond message");
        });
        (0, bun_test_1.it)("should return rawCommand for compaction request", () => {
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact -t 3000",
                parsed: { maxOutputTokens: 3000 },
            };
            const options = {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            };
            queue.add("Summarize this conversation into a compact form...", options);
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("/compact -t 3000");
        });
        (0, bun_test_1.it)("should throw when adding compaction after normal message", () => {
            queue.add("First message");
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {},
            };
            const options = {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            };
            // Compaction requests cannot be mixed with other messages to prevent
            // silent failures where compaction metadata would be lost
            (0, bun_test_1.expect)(() => queue.add("Summarize this conversation...", options)).toThrow(/Cannot queue compaction request/);
        });
        (0, bun_test_1.it)("should return joined messages when metadata type is not compaction-request", () => {
            const metadata = {
                type: "normal",
            };
            const options = {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            };
            queue.add("Regular message", options);
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("Regular message");
        });
        (0, bun_test_1.it)("should return empty string for empty queue", () => {
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("");
        });
        (0, bun_test_1.it)("should return joined messages after clearing compaction metadata", () => {
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {},
            };
            const options = {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            };
            queue.add("Summarize this...", options);
            queue.clear();
            queue.add("New message");
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("New message");
        });
    });
    (0, bun_test_1.describe)("getMessages", () => {
        (0, bun_test_1.it)("should return raw messages even for compaction requests", () => {
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {},
            };
            const options = {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            };
            queue.add("Summarize this conversation...", options);
            // getMessages should return the actual message text for editing
            (0, bun_test_1.expect)(queue.getMessages()).toEqual(["Summarize this conversation..."]);
            // getDisplayText should return the slash command
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("/compact");
        });
    });
    (0, bun_test_1.describe)("hasCompactionRequest", () => {
        (0, bun_test_1.it)("should return false for empty queue", () => {
            (0, bun_test_1.expect)(queue.hasCompactionRequest()).toBe(false);
        });
        (0, bun_test_1.it)("should return false for normal messages", () => {
            queue.add("Regular message", { model: "gpt-4", agentId: "exec" });
            (0, bun_test_1.expect)(queue.hasCompactionRequest()).toBe(false);
        });
        (0, bun_test_1.it)("should return true when compaction request is queued", () => {
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {},
            };
            queue.add("Summarize...", {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            });
            (0, bun_test_1.expect)(queue.hasCompactionRequest()).toBe(true);
        });
        (0, bun_test_1.it)("should return false after clearing", () => {
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {},
            };
            queue.add("Summarize...", {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            });
            queue.clear();
            (0, bun_test_1.expect)(queue.hasCompactionRequest()).toBe(false);
        });
    });
    (0, bun_test_1.describe)("addOnce", () => {
        (0, bun_test_1.it)("should dedupe repeated entries by key", () => {
            const image = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            const addedFirst = queue.addOnce("Follow up", { model: "gpt-4", agentId: "exec", fileParts: [image] }, "follow-up");
            const addedSecond = queue.addOnce("Follow up", { model: "gpt-4", agentId: "exec", fileParts: [image] }, "follow-up");
            (0, bun_test_1.expect)(addedFirst).toBe(true);
            (0, bun_test_1.expect)(addedSecond).toBe(false);
            (0, bun_test_1.expect)(queue.getMessages()).toEqual(["Follow up"]);
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([image]);
        });
    });
    (0, bun_test_1.describe)("multi-message batching", () => {
        (0, bun_test_1.it)("should batch multiple follow-up messages", () => {
            queue.add("First message");
            queue.add("Second message");
            queue.add("Third message");
            (0, bun_test_1.expect)(queue.getMessages()).toEqual(["First message", "Second message", "Third message"]);
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("First message\nSecond message\nThird message");
        });
        (0, bun_test_1.it)("should preserve compaction metadata when follow-up is added", () => {
            const metadata = {
                type: "compaction-request",
                rawCommand: "/compact",
                parsed: {},
            };
            queue.add("Summarize...", {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            });
            queue.add("And then do this follow-up task");
            // Display shows all messages (multiple messages = not just compaction)
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("Summarize...\nAnd then do this follow-up task");
            // getMessages includes both
            (0, bun_test_1.expect)(queue.getMessages()).toEqual(["Summarize...", "And then do this follow-up task"]);
            // produceMessage preserves compaction metadata from first message
            const { message, options } = queue.produceMessage();
            (0, bun_test_1.expect)(message).toBe("Summarize...\nAnd then do this follow-up task");
            const unixMeta = options?.unixMetadata;
            (0, bun_test_1.expect)(unixMeta.type).toBe("compaction-request");
            if (unixMeta.type === "compaction-request") {
                (0, bun_test_1.expect)(unixMeta.rawCommand).toBe("/compact");
            }
        });
        (0, bun_test_1.it)("should throw when adding agent-skill invocation after normal message", () => {
            queue.add("First message");
            const metadata = {
                type: "agent-skill",
                rawCommand: "/init",
                skillName: "init",
                scope: "built-in",
            };
            const options = {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            };
            (0, bun_test_1.expect)(() => queue.add("Using skill init", options)).toThrow(/Cannot queue agent skill invocation/);
        });
        (0, bun_test_1.it)("should throw when adding normal message after agent-skill invocation", () => {
            const metadata = {
                type: "agent-skill",
                rawCommand: "/init",
                skillName: "init",
                scope: "built-in",
            };
            queue.add("Use skill init", {
                model: "claude-3-5-sonnet-20241022",
                agentId: "exec",
                unixMetadata: metadata,
            });
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("/init");
            (0, bun_test_1.expect)(() => queue.add("Follow-up message")).toThrow(/agent skill invocation is already queued/);
        });
        (0, bun_test_1.it)("should produce combined message for API call", () => {
            queue.add("First message", { model: "gpt-4", agentId: "exec" });
            queue.add("Second message");
            const { message, options } = queue.produceMessage();
            // Messages are joined with newlines
            (0, bun_test_1.expect)(message).toBe("First message\nSecond message");
            // Latest options are used
            (0, bun_test_1.expect)(options?.model).toBe("gpt-4");
        });
        (0, bun_test_1.it)("should batch messages with mixed images", () => {
            const image1 = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            const image2 = { url: "data:image/jpeg;base64,def", mediaType: "image/jpeg" };
            queue.add("Message with image", {
                model: "gpt-4",
                agentId: "exec",
                fileParts: [image1],
            });
            queue.add("Follow-up without image");
            queue.add("Another with image", {
                model: "gpt-4",
                agentId: "exec",
                fileParts: [image2],
            });
            (0, bun_test_1.expect)(queue.getMessages()).toEqual([
                "Message with image",
                "Follow-up without image",
                "Another with image",
            ]);
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([image1, image2]);
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("Message with image\nFollow-up without image\nAnother with image");
        });
    });
    (0, bun_test_1.describe)("getFileParts", () => {
        (0, bun_test_1.it)("should return accumulated images from multiple messages", () => {
            const image1 = {
                url: "data:image/png;base64,abc",
                mediaType: "image/png",
            };
            const image2 = {
                url: "data:image/jpeg;base64,def",
                mediaType: "image/jpeg",
            };
            const image3 = {
                url: "data:image/gif;base64,ghi",
                mediaType: "image/gif",
            };
            queue.add("First message", {
                model: "gpt-4",
                agentId: "exec",
                fileParts: [image1],
            });
            queue.add("Second message", {
                model: "gpt-4",
                agentId: "exec",
                fileParts: [image2, image3],
            });
            const images = queue.getFileParts();
            (0, bun_test_1.expect)(images).toEqual([image1, image2, image3]);
        });
        (0, bun_test_1.it)("should return empty array when no images", () => {
            queue.add("Text only message");
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([]);
        });
        (0, bun_test_1.it)("should return copy of images array", () => {
            const image = {
                type: "file",
                url: "data:image/png;base64,abc",
                mediaType: "image/png",
            };
            queue.add("Message", { model: "gpt-4", agentId: "exec", fileParts: [image] });
            const images1 = queue.getFileParts();
            const images2 = queue.getFileParts();
            (0, bun_test_1.expect)(images1).toEqual(images2);
            (0, bun_test_1.expect)(images1).not.toBe(images2); // Different array instances
        });
        (0, bun_test_1.it)("should clear images when queue is cleared", () => {
            const image = {
                url: "data:image/png;base64,abc",
                mediaType: "image/png",
            };
            queue.add("Message", { model: "gpt-4", agentId: "exec", fileParts: [image] });
            (0, bun_test_1.expect)(queue.getFileParts()).toHaveLength(1);
            queue.clear();
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([]);
        });
    });
    (0, bun_test_1.describe)("image-only messages", () => {
        (0, bun_test_1.it)("should accept image-only messages (empty text with images)", () => {
            const image = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            queue.add("", { model: "gpt-4", agentId: "exec", fileParts: [image] });
            (0, bun_test_1.expect)(queue.getMessages()).toEqual([]);
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([image]);
            (0, bun_test_1.expect)(queue.isEmpty()).toBe(false);
        });
        (0, bun_test_1.it)("should reject messages with empty text and no images", () => {
            queue.add("", { model: "gpt-4", agentId: "exec" });
            (0, bun_test_1.expect)(queue.isEmpty()).toBe(true);
            (0, bun_test_1.expect)(queue.getMessages()).toEqual([]);
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([]);
        });
        (0, bun_test_1.it)("should handle mixed text and image-only messages", () => {
            const image1 = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            const image2 = { url: "data:image/jpeg;base64,def", mediaType: "image/jpeg" };
            queue.add("Text message", { model: "gpt-4", agentId: "exec", fileParts: [image1] });
            queue.add("", { model: "gpt-4", agentId: "exec", fileParts: [image2] }); // Image-only
            (0, bun_test_1.expect)(queue.getMessages()).toEqual(["Text message"]);
            (0, bun_test_1.expect)(queue.getFileParts()).toEqual([image1, image2]);
            (0, bun_test_1.expect)(queue.isEmpty()).toBe(false);
        });
        (0, bun_test_1.it)("should consider queue non-empty when only images present", () => {
            const image = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            queue.add("", { model: "gpt-4", agentId: "exec", fileParts: [image] });
            (0, bun_test_1.expect)(queue.isEmpty()).toBe(false);
        });
        (0, bun_test_1.it)("should produce correct message for image-only queue", () => {
            const image = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            queue.add("", { model: "gpt-4", agentId: "exec", fileParts: [image] });
            const { message, options } = queue.produceMessage();
            (0, bun_test_1.expect)(message).toBe("");
            (0, bun_test_1.expect)(options?.fileParts).toEqual([image]);
            (0, bun_test_1.expect)(options?.model).toBe("gpt-4");
        });
        (0, bun_test_1.it)("should return empty string for getDisplayText with image-only", () => {
            const image = { url: "data:image/png;base64,abc", mediaType: "image/png" };
            queue.add("", { model: "gpt-4", agentId: "exec", fileParts: [image] });
            (0, bun_test_1.expect)(queue.getDisplayText()).toBe("");
        });
    });
});
//# sourceMappingURL=messageQueue.test.js.map