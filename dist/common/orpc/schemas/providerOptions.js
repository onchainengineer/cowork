"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnixProviderOptionsSchema = void 0;
const zod_1 = require("zod");
exports.UnixProviderOptionsSchema = zod_1.z.object({
    anthropic: zod_1.z
        .object({
        use1MContext: zod_1.z.boolean().optional().meta({
            description: "Enable 1M context window (requires beta header)",
        }),
    })
        .optional(),
    openai: zod_1.z
        .object({
        serviceTier: zod_1.z.enum(["auto", "default", "flex", "priority"]).optional().meta({
            description: "OpenAI service tier: priority (low-latency), flex (50% cheaper, higher latency), auto/default (standard)",
        }),
        forceContextLimitError: zod_1.z.boolean().optional().meta({
            description: "Force context limit error (used in integration tests to simulate overflow)",
        }),
        simulateToolPolicyNoop: zod_1.z.boolean().optional().meta({
            description: "Simulate successful response without executing tools (used in tool policy tests)",
        }),
    })
        .optional(),
    google: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    ollama: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    openrouter: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    xai: zod_1.z
        .object({
        searchParameters: zod_1.z
            .object({
            mode: zod_1.z.enum(["auto", "off", "on"]),
            returnCitations: zod_1.z.boolean().optional(),
            fromDate: zod_1.z.string().optional(),
            toDate: zod_1.z.string().optional(),
            maxSearchResults: zod_1.z.number().optional(),
            sources: zod_1.z
                .array(zod_1.z.discriminatedUnion("type", [
                zod_1.z.object({
                    type: zod_1.z.literal("web"),
                    country: zod_1.z.string().optional(),
                    excludedWebsites: zod_1.z.array(zod_1.z.string()).optional(),
                    allowedWebsites: zod_1.z.array(zod_1.z.string()).optional(),
                    safeSearch: zod_1.z.boolean().optional(),
                }),
                zod_1.z.object({
                    type: zod_1.z.literal("x"),
                    excludedXHandles: zod_1.z.array(zod_1.z.string()).optional(),
                    includedXHandles: zod_1.z.array(zod_1.z.string()).optional(),
                    postFavoriteCount: zod_1.z.number().optional(),
                    postViewCount: zod_1.z.number().optional(),
                    xHandles: zod_1.z.array(zod_1.z.string()).optional(),
                }),
                zod_1.z.object({
                    type: zod_1.z.literal("news"),
                    country: zod_1.z.string().optional(),
                    excludedWebsites: zod_1.z.array(zod_1.z.string()).optional(),
                    safeSearch: zod_1.z.boolean().optional(),
                }),
                zod_1.z.object({
                    type: zod_1.z.literal("rss"),
                    links: zod_1.z.array(zod_1.z.string()),
                }),
            ]))
                .optional(),
        })
            .optional(),
    })
        .optional(),
});
//# sourceMappingURL=providerOptions.js.map