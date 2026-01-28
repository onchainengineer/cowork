"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const ai_1 = require("ai");
const zod_1 = require("zod");
const cacheStrategy_1 = require("./cacheStrategy");
(0, bun_test_1.describe)("cacheStrategy", () => {
    (0, bun_test_1.describe)("supportsAnthropicCache", () => {
        (0, bun_test_1.it)("should return true for direct Anthropic models", () => {
            (0, bun_test_1.expect)((0, cacheStrategy_1.supportsAnthropicCache)("anthropic:claude-3-5-sonnet-20241022")).toBe(true);
            (0, bun_test_1.expect)((0, cacheStrategy_1.supportsAnthropicCache)("anthropic:claude-3-5-haiku-20241022")).toBe(true);
        });
        (0, bun_test_1.it)("should return true for OpenRouter Anthropic models", () => {
            (0, bun_test_1.expect)((0, cacheStrategy_1.supportsAnthropicCache)("openrouter:anthropic/claude-3.5-sonnet")).toBe(true);
        });
        (0, bun_test_1.it)("should return false for non-Anthropic models", () => {
            (0, bun_test_1.expect)((0, cacheStrategy_1.supportsAnthropicCache)("openai:gpt-4")).toBe(false);
            (0, bun_test_1.expect)((0, cacheStrategy_1.supportsAnthropicCache)("google:gemini-2.0")).toBe(false);
            (0, bun_test_1.expect)((0, cacheStrategy_1.supportsAnthropicCache)("openrouter:meta-llama/llama-3.1")).toBe(false);
        });
    });
    (0, bun_test_1.describe)("applyCacheControl", () => {
        (0, bun_test_1.it)("should not modify messages for non-Anthropic models", () => {
            const messages = [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there!" },
                { role: "user", content: "How are you?" },
            ];
            const result = (0, cacheStrategy_1.applyCacheControl)(messages, "openai:gpt-4");
            (0, bun_test_1.expect)(result).toEqual(messages);
        });
        (0, bun_test_1.it)("should add cache control to single message for Anthropic models", () => {
            const messages = [{ role: "user", content: "Hello" }];
            const result = (0, cacheStrategy_1.applyCacheControl)(messages, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result[0]).toEqual({
                ...messages[0],
                providerOptions: {
                    anthropic: {
                        cacheControl: {
                            type: "ephemeral",
                        },
                    },
                },
            });
        });
        (0, bun_test_1.it)("should add cache control to last message for Anthropic models", () => {
            const messages = [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there!" },
                { role: "user", content: "How are you?" },
            ];
            const result = (0, cacheStrategy_1.applyCacheControl)(messages, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result[0]).toEqual(messages[0]); // First message unchanged
            (0, bun_test_1.expect)(result[1]).toEqual(messages[1]); // Second message unchanged
            (0, bun_test_1.expect)(result[2]).toEqual({
                // Last message has cache control
                ...messages[2],
                providerOptions: {
                    anthropic: {
                        cacheControl: {
                            type: "ephemeral",
                        },
                    },
                },
            });
        });
        (0, bun_test_1.it)("should work with exactly 2 messages", () => {
            const messages = [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there!" },
            ];
            const result = (0, cacheStrategy_1.applyCacheControl)(messages, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result[0]).toEqual(messages[0]); // First message unchanged
            (0, bun_test_1.expect)(result[1]).toEqual({
                // Last message gets cache control
                ...messages[1],
                providerOptions: {
                    anthropic: {
                        cacheControl: {
                            type: "ephemeral",
                        },
                    },
                },
            });
        });
        (0, bun_test_1.it)("should add cache control to last content part for array content", () => {
            // Messages with array content (typical for user/assistant with multiple parts)
            const messages = [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Hello" },
                        { type: "text", text: "World" },
                    ],
                },
                {
                    role: "assistant",
                    content: [
                        { type: "text", text: "Hi there!" },
                        { type: "text", text: "How can I help?" },
                    ],
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Final" },
                        { type: "text", text: "question" },
                    ],
                },
            ];
            const result = (0, cacheStrategy_1.applyCacheControl)(messages, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result[0]).toEqual(messages[0]); // First message unchanged
            (0, bun_test_1.expect)(result[1]).toEqual(messages[1]); // Second message unchanged
            // Last message (array content): cache control on LAST content part only
            const lastMsg = result[2];
            (0, bun_test_1.expect)(lastMsg.role).toBe("user");
            (0, bun_test_1.expect)(Array.isArray(lastMsg.content)).toBe(true);
            const content = lastMsg.content;
            (0, bun_test_1.expect)(content[0].providerOptions).toBeUndefined(); // First part unchanged
            (0, bun_test_1.expect)(content[1].providerOptions).toEqual({
                anthropic: { cacheControl: { type: "ephemeral" } },
            }); // Last part has cache control
        });
    });
    (0, bun_test_1.describe)("createCachedSystemMessage", () => {
        (0, bun_test_1.describe)("integration with streamText parameters", () => {
            (0, bun_test_1.it)("should handle empty system message correctly", () => {
                // When system message is converted to cached message, the system parameter
                // should be undefined, not empty string, to avoid Anthropic API error
                const systemContent = "You are a helpful assistant";
                const cachedMessage = (0, cacheStrategy_1.createCachedSystemMessage)(systemContent, "anthropic:claude-3-5-sonnet");
                (0, bun_test_1.expect)(cachedMessage).toBeDefined();
                (0, bun_test_1.expect)(cachedMessage?.role).toBe("system");
                (0, bun_test_1.expect)(cachedMessage?.content).toBe(systemContent);
                // When using this cached message, system parameter should be set to undefined
                // Example: system: cachedMessage ? undefined : originalSystem
            });
        });
        (0, bun_test_1.it)("should return null for non-Anthropic models", () => {
            const result = (0, cacheStrategy_1.createCachedSystemMessage)("You are a helpful assistant", "openai:gpt-4");
            (0, bun_test_1.expect)(result).toBeNull();
        });
        (0, bun_test_1.it)("should return null for empty system content", () => {
            const result = (0, cacheStrategy_1.createCachedSystemMessage)("", "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result).toBeNull();
        });
        (0, bun_test_1.it)("should create cached system message for Anthropic models", () => {
            const systemContent = "You are a helpful assistant";
            const result = (0, cacheStrategy_1.createCachedSystemMessage)(systemContent, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result).toEqual({
                role: "system",
                content: systemContent,
                providerOptions: {
                    anthropic: {
                        cacheControl: {
                            type: "ephemeral",
                        },
                    },
                },
            });
        });
    });
    (0, bun_test_1.describe)("applyCacheControlToTools", () => {
        const mockTools = {
            readFile: (0, ai_1.tool)({
                description: "Read a file",
                inputSchema: zod_1.z.object({
                    path: zod_1.z.string(),
                }),
                execute: () => Promise.resolve({ success: true }),
            }),
            writeFile: (0, ai_1.tool)({
                description: "Write a file",
                inputSchema: zod_1.z.object({
                    path: zod_1.z.string(),
                    content: zod_1.z.string(),
                }),
                execute: () => Promise.resolve({ success: true }),
            }),
        };
        (0, bun_test_1.it)("should not modify tools for non-Anthropic models", () => {
            const result = (0, cacheStrategy_1.applyCacheControlToTools)(mockTools, "openai:gpt-4");
            (0, bun_test_1.expect)(result).toEqual(mockTools);
        });
        (0, bun_test_1.it)("should return empty object for empty tools", () => {
            const result = (0, cacheStrategy_1.applyCacheControlToTools)({}, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(result).toEqual({});
        });
        (0, bun_test_1.it)("should add cache control only to the last tool for Anthropic models", () => {
            const result = (0, cacheStrategy_1.applyCacheControlToTools)(mockTools, "anthropic:claude-3-5-sonnet");
            // Get the keys to identify first and last tools
            const keys = Object.keys(mockTools);
            const lastKey = keys[keys.length - 1];
            // Check that only the last tool has cache control
            for (const [key, tool] of Object.entries(result)) {
                if (key === lastKey) {
                    // Last tool should have cache control
                    (0, bun_test_1.expect)(tool).toEqual({
                        ...mockTools[key],
                        providerOptions: {
                            anthropic: {
                                cacheControl: {
                                    type: "ephemeral",
                                },
                            },
                        },
                    });
                }
                else {
                    // Other tools should be unchanged
                    (0, bun_test_1.expect)(tool).toEqual(mockTools[key]);
                }
            }
            // Verify all tools are present
            (0, bun_test_1.expect)(Object.keys(result)).toEqual(Object.keys(mockTools));
        });
        (0, bun_test_1.it)("should not modify original tools object", () => {
            const originalTools = { ...mockTools };
            (0, cacheStrategy_1.applyCacheControlToTools)(mockTools, "anthropic:claude-3-5-sonnet");
            (0, bun_test_1.expect)(mockTools).toEqual(originalTools);
        });
        (0, bun_test_1.it)("should handle provider-defined tools without recreating them", () => {
            // Provider-defined tools (like Anthropic's webSearch) have type: "provider-defined"
            // and cannot be recreated with createTool() - they have special internal properties
            const providerDefinedTool = {
                type: "provider-defined",
                id: "web_search",
                name: "web_search_20250305",
                args: { maxUses: 1000 },
                // Note: no description or execute - these are handled internally by the SDK
            };
            const toolsWithProviderDefined = {
                readFile: (0, ai_1.tool)({
                    description: "Read a file",
                    inputSchema: zod_1.z.object({ path: zod_1.z.string() }),
                    execute: () => Promise.resolve({ success: true }),
                }),
                // Provider-defined tool as last tool (typical for Anthropic web search)
                web_search: providerDefinedTool,
            };
            const result = (0, cacheStrategy_1.applyCacheControlToTools)(toolsWithProviderDefined, "anthropic:claude-3-5-sonnet");
            // Verify all tools are present
            (0, bun_test_1.expect)(Object.keys(result)).toEqual(Object.keys(toolsWithProviderDefined));
            // First tool should be unchanged
            (0, bun_test_1.expect)(result.readFile).toEqual(toolsWithProviderDefined.readFile);
            // Provider-defined tool should have cache control added but retain its type
            const cachedWebSearch = result.web_search;
            (0, bun_test_1.expect)(cachedWebSearch.type).toBe("provider-defined");
            (0, bun_test_1.expect)(cachedWebSearch.providerOptions).toEqual({
                anthropic: { cacheControl: { type: "ephemeral" } },
            });
        });
    });
});
//# sourceMappingURL=cacheStrategy.test.js.map