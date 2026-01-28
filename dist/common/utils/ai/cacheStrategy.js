"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportsAnthropicCache = supportsAnthropicCache;
exports.applyCacheControl = applyCacheControl;
exports.createCachedSystemMessage = createCachedSystemMessage;
exports.applyCacheControlToTools = applyCacheControlToTools;
const ai_1 = require("ai");
const models_1 = require("./models");
/**
 * Check if a model supports Anthropic cache control.
 * Matches:
 * - Direct Anthropic provider: "anthropic:claude-opus-4-5"
 * - OpenRouter Anthropic models: "openrouter:anthropic/claude-3.5-sonnet"
 */
function supportsAnthropicCache(modelString) {
    const normalized = (0, models_1.normalizeGatewayModel)(modelString);
    // Direct Anthropic provider
    if (normalized.startsWith("anthropic:")) {
        return true;
    }
    // Other gateway/router providers routing to Anthropic (format: "provider:anthropic/model")
    const [, modelId] = normalized.split(":");
    if (modelId?.startsWith("anthropic/")) {
        return true;
    }
    return false;
}
/** Cache control providerOptions for Anthropic */
const ANTHROPIC_CACHE_CONTROL = {
    anthropic: {
        cacheControl: { type: "ephemeral" },
    },
};
/**
 * Add providerOptions to the last content part of a message.
 * The SDK requires providerOptions on content parts, not on the message itself.
 *
 * For system messages with string content, we use message-level providerOptions
 * (which the SDK handles correctly). For user/assistant messages with array
 * content, we add providerOptions to the last content part.
 */
function addCacheControlToLastContentPart(msg) {
    const content = msg.content;
    // String content (typically system messages): use message-level providerOptions
    // The SDK correctly translates this for system messages
    if (typeof content === "string") {
        return {
            ...msg,
            providerOptions: ANTHROPIC_CACHE_CONTROL,
        };
    }
    // Array content: add providerOptions to the last part
    // Use type assertion since we're adding providerOptions which is valid but not in base types
    if (Array.isArray(content) && content.length > 0) {
        const lastIndex = content.length - 1;
        const newContent = content.map((part, i) => i === lastIndex ? { ...part, providerOptions: ANTHROPIC_CACHE_CONTROL } : part);
        // Type assertion needed: ModelMessage types are strict unions but providerOptions
        // on content parts is valid per SDK docs
        const result = { ...msg, content: newContent };
        return result;
    }
    // Empty or unexpected content: return as-is
    return msg;
}
/**
 * Apply cache control to messages for Anthropic models.
 * Adds a cache marker to the last message so the entire conversation is cached.
 *
 * NOTE: The SDK requires providerOptions on content parts, not on the message.
 * We add cache_control to the last content part of the last message.
 */
function applyCacheControl(messages, modelString) {
    // Only apply cache control for Anthropic models
    if (!supportsAnthropicCache(modelString)) {
        return messages;
    }
    // Need at least 1 message to add a cache breakpoint
    if (messages.length < 1) {
        return messages;
    }
    // Add cache breakpoint at the last message
    const cacheIndex = messages.length - 1;
    return messages.map((msg, index) => {
        if (index === cacheIndex) {
            return addCacheControlToLastContentPart(msg);
        }
        return msg;
    });
}
/**
 * Create a system message with cache control for Anthropic models.
 * System messages rarely change and should always be cached.
 */
function createCachedSystemMessage(systemContent, modelString) {
    if (!systemContent || !supportsAnthropicCache(modelString)) {
        return null;
    }
    return {
        role: "system",
        content: systemContent,
        providerOptions: {
            anthropic: {
                cacheControl: {
                    type: "ephemeral",
                },
            },
        },
    };
}
/**
 * Apply cache control to tool definitions for Anthropic models.
 * Tools are static per model and should always be cached.
 *
 * IMPORTANT: Anthropic has a 4 cache breakpoint limit. We use:
 * 1. System message (1 breakpoint)
 * 2. Conversation history (1 breakpoint)
 * 3. Last tool only (1 breakpoint) - caches all tools up to and including this one
 * = 3 total, leaving 1 for future use
 *
 * NOTE: The SDK requires providerOptions to be passed during tool() creation,
 * not added afterwards. We re-create the last tool with providerOptions included.
 */
function applyCacheControlToTools(tools, modelString) {
    // Only apply cache control for Anthropic models
    if (!supportsAnthropicCache(modelString) || !tools || Object.keys(tools).length === 0) {
        return tools;
    }
    // Get the last tool key (tools are ordered, last one gets cached)
    const toolKeys = Object.keys(tools);
    const lastToolKey = toolKeys[toolKeys.length - 1];
    // Clone tools and add cache control ONLY to the last tool
    // Anthropic caches everything up to the cache breakpoint, so marking
    // only the last tool will cache all tools
    const cachedTools = {};
    for (const [key, existingTool] of Object.entries(tools)) {
        if (key === lastToolKey) {
            // For provider-defined tools (like Anthropic's webSearch), we cannot recreate them
            // with createTool() - they have special properties. Instead, spread providerOptions
            // directly onto the tool object. While this doesn't work for regular tools (SDK
            // requires providerOptions at creation time), provider-defined tools handle it.
            const isProviderDefinedTool = existingTool.type === "provider-defined";
            if (isProviderDefinedTool) {
                // Provider-defined tools: add providerOptions directly (SDK handles it differently)
                cachedTools[key] = {
                    ...existingTool,
                    providerOptions: {
                        anthropic: {
                            cacheControl: { type: "ephemeral" },
                        },
                    },
                };
            }
            else {
                // Regular tools: re-create with providerOptions (SDK requires this at creation time)
                const cachedTool = (0, ai_1.tool)({
                    description: existingTool.description,
                    inputSchema: existingTool.inputSchema,
                    execute: existingTool.execute,
                    providerOptions: {
                        anthropic: {
                            cacheControl: { type: "ephemeral" },
                        },
                    },
                });
                cachedTools[key] = cachedTool;
            }
        }
        else {
            // Other tools are copied as-is
            cachedTools[key] = existingTool;
        }
    }
    return cachedTools;
}
//# sourceMappingURL=cacheStrategy.js.map