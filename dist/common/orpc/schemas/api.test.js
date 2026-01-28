"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const api_1 = require("./api");
/**
 * Schema conformance tests for provider types.
 *
 * These tests ensure that the Zod schemas preserve all fields when parsing data.
 * oRPC uses these schemas for output validation and strips fields not in the schema,
 * so any field present in the TypeScript type MUST be present in the schema.
 *
 * If these tests fail, it means the schema is missing fields that the backend
 * service returns, which would cause data loss when crossing the IPC boundary.
 */
(0, bun_test_1.describe)("ProviderConfigInfoSchema conformance", () => {
    (0, bun_test_1.it)("preserves all AWSCredentialStatus fields", () => {
        const full = {
            region: "us-east-1",
            bearerTokenSet: true,
            accessKeyIdSet: true,
            secretAccessKeySet: false,
        };
        const parsed = api_1.AWSCredentialStatusSchema.parse(full);
        // Verify no fields were stripped
        (0, bun_test_1.expect)(parsed).toEqual(full);
        (0, bun_test_1.expect)(Object.keys(parsed).sort()).toEqual(Object.keys(full).sort());
    });
    (0, bun_test_1.it)("preserves all ProviderConfigInfo fields (base case)", () => {
        const full = {
            apiKeySet: true,
            isConfigured: true,
            baseUrl: "https://api.example.com",
            models: ["model-a", "model-b"],
        };
        const parsed = api_1.ProviderConfigInfoSchema.parse(full);
        (0, bun_test_1.expect)(parsed).toEqual(full);
        (0, bun_test_1.expect)(Object.keys(parsed).sort()).toEqual(Object.keys(full).sort());
    });
    (0, bun_test_1.it)("preserves all ProviderConfigInfo fields (with AWS/Bedrock)", () => {
        const full = {
            apiKeySet: false,
            isConfigured: false,
            baseUrl: undefined,
            models: [],
            aws: {
                region: "eu-west-1",
                bearerTokenSet: false,
                accessKeyIdSet: true,
                secretAccessKeySet: true,
            },
        };
        const parsed = api_1.ProviderConfigInfoSchema.parse(full);
        (0, bun_test_1.expect)(parsed).toEqual(full);
        // Check nested aws object is preserved
        (0, bun_test_1.expect)(parsed.aws).toEqual(full.aws);
    });
    (0, bun_test_1.it)("preserves all ProviderConfigInfo fields (with couponCodeSet)", () => {
        const full = {
            apiKeySet: true,
            isConfigured: true,
            couponCodeSet: true,
        };
        const parsed = api_1.ProviderConfigInfoSchema.parse(full);
        (0, bun_test_1.expect)(parsed).toEqual(full);
        (0, bun_test_1.expect)(parsed.couponCodeSet).toBe(true);
    });
    (0, bun_test_1.it)("preserves all ProviderConfigInfo fields (full object with all optional fields)", () => {
        // This is the most comprehensive test - includes ALL possible fields
        const full = {
            apiKeySet: true,
            isConfigured: true,
            baseUrl: "https://custom.endpoint.com",
            models: ["claude-3-opus", "claude-3-sonnet"],
            serviceTier: "flex",
            aws: {
                region: "ap-northeast-1",
                bearerTokenSet: true,
                accessKeyIdSet: true,
                secretAccessKeySet: true,
            },
            couponCodeSet: true,
        };
        const parsed = api_1.ProviderConfigInfoSchema.parse(full);
        // Deep equality check
        (0, bun_test_1.expect)(parsed).toEqual(full);
        // Explicit field-by-field verification for clarity
        (0, bun_test_1.expect)(parsed.apiKeySet).toBe(full.apiKeySet);
        (0, bun_test_1.expect)(parsed.baseUrl).toBe(full.baseUrl);
        (0, bun_test_1.expect)(parsed.models).toEqual(full.models);
        (0, bun_test_1.expect)(parsed.serviceTier).toBe(full.serviceTier);
        (0, bun_test_1.expect)(parsed.aws).toEqual(full.aws);
        (0, bun_test_1.expect)(parsed.couponCodeSet).toBe(full.couponCodeSet);
    });
    (0, bun_test_1.it)("preserves ProvidersConfigMap with multiple providers", () => {
        const full = {
            anthropic: {
                apiKeySet: true,
                isConfigured: true,
                models: ["claude-3-opus"],
            },
            openai: {
                apiKeySet: true,
                isConfigured: true,
                serviceTier: "auto",
            },
            bedrock: {
                apiKeySet: false,
                isConfigured: false,
                aws: {
                    region: "us-west-2",
                    bearerTokenSet: false,
                    accessKeyIdSet: true,
                    secretAccessKeySet: true,
                },
            },
        };
        const parsed = api_1.ProvidersConfigMapSchema.parse(full);
        (0, bun_test_1.expect)(parsed).toEqual(full);
        (0, bun_test_1.expect)(Object.keys(parsed)).toEqual(Object.keys(full));
    });
});
//# sourceMappingURL=api.test.js.map