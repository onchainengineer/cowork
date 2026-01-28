"use strict";
/**
 * Provider credential resolution - single source of truth for provider authentication.
 *
 * Used by:
 * - providerService.ts: UI status (isConfigured flag for frontend)
 * - aiService.ts: runtime credential resolution before making API calls
 * - CLI bootstrap: buildProvidersFromEnv() to create initial providers.jsonc
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AZURE_OPENAI_ENV_VARS = exports.PROVIDER_ENV_VARS = void 0;
exports.resolveProviderCredentials = resolveProviderCredentials;
exports.checkProviderConfigured = checkProviderConfigured;
exports.buildProvidersFromEnv = buildProvidersFromEnv;
exports.hasAnyConfiguredProvider = hasAnyConfiguredProvider;
const providers_1 = require("../../common/constants/providers");
// ============================================================================
// Environment variable mappings - single source of truth
// ============================================================================
/** Env var names for each provider credential type (checked in order, first non-empty wins) */
exports.PROVIDER_ENV_VARS = {
    anthropic: {
        apiKey: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
        baseUrl: ["ANTHROPIC_BASE_URL"],
    },
    openai: {
        apiKey: ["OPENAI_API_KEY"],
        baseUrl: ["OPENAI_BASE_URL", "OPENAI_API_BASE"],
        organization: ["OPENAI_ORG_ID"],
    },
    google: {
        apiKey: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
        baseUrl: ["GOOGLE_BASE_URL"],
    },
    xai: {
        apiKey: ["XAI_API_KEY"],
        baseUrl: ["XAI_BASE_URL"],
    },
    openrouter: {
        apiKey: ["OPENROUTER_API_KEY"],
    },
    deepseek: {
        apiKey: ["DEEPSEEK_API_KEY"],
    },
    bedrock: {
        region: ["AWS_REGION", "AWS_DEFAULT_REGION"],
    },
};
/** Azure OpenAI env vars (special case: maps to "openai" provider) */
exports.AZURE_OPENAI_ENV_VARS = {
    apiKey: "AZURE_OPENAI_API_KEY",
    endpoint: "AZURE_OPENAI_ENDPOINT",
    deployment: "AZURE_OPENAI_DEPLOYMENT",
    apiVersion: "AZURE_OPENAI_API_VERSION",
};
/** Resolve first non-empty env var from a list of candidates */
function resolveEnv(keys, env) {
    for (const key of keys ?? []) {
        const val = env[key]?.trim();
        if (val)
            return val;
    }
    return undefined;
}
// ============================================================================
// Credential resolution
// ============================================================================
/**
 * Resolve provider credentials from config and environment.
 * Returns both configuration status AND resolved credential values.
 *
 * @param provider - Provider name
 * @param config - Raw config from providers.jsonc (or empty object)
 * @param env - Environment variables (defaults to process.env)
 */
function resolveProviderCredentials(provider, config, env = process.env) {
    // Bedrock: region required (credentials via AWS SDK chain)
    if (provider === "bedrock") {
        const configRegion = typeof config.region === "string" && config.region ? config.region : null;
        const region = configRegion ?? resolveEnv(exports.PROVIDER_ENV_VARS.bedrock?.region, env);
        return region
            ? { isConfigured: true, region }
            : { isConfigured: false, missingRequirement: "region" };
    }
    // GitHub Copilot (via VS Code LM Proxy): auto-configured, routes through VS Code extension
    if (provider === "github-copilot") {
        return { isConfigured: true };
    }
    // GitHub Copilot Direct: auto-configured via Copilot CLI auth from ~/.config/github-copilot/apps.json
    if (provider === "github-copilot-direct") {
        return { isConfigured: true };
    }
    // Keyless providers (e.g., ollama): require explicit opt-in via baseUrl or models
    const def = providers_1.PROVIDER_DEFINITIONS[provider];
    if (!def.requiresApiKey) {
        const hasExplicitConfig = Boolean(config.baseUrl ?? (config.models?.length ?? 0) > 0);
        return { isConfigured: hasExplicitConfig };
    }
    // Standard API key providers: check config first, then env vars
    const envMapping = exports.PROVIDER_ENV_VARS[provider];
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string should be treated as unset
    const configKey = config.apiKey || null;
    const apiKey = configKey ?? resolveEnv(envMapping?.apiKey, env);
    const baseUrl = config.baseURL ?? config.baseUrl ?? resolveEnv(envMapping?.baseUrl, env);
    // Config organization takes precedence over env var (user's explicit choice)
    const organization = config.organization ?? resolveEnv(envMapping?.organization, env);
    if (apiKey) {
        return { isConfigured: true, apiKey, baseUrl, organization };
    }
    return { isConfigured: false, missingRequirement: "api_key" };
}
/**
 * Check if a provider is configured (has necessary credentials).
 * Convenience wrapper around resolveProviderCredentials for UI status checks.
 */
function checkProviderConfigured(provider, config, env = process.env) {
    const { isConfigured, missingRequirement } = resolveProviderCredentials(provider, config, env);
    return { isConfigured, missingRequirement };
}
// ============================================================================
// Bootstrap: build providers config from environment variables
// ============================================================================
/**
 * Build a ProvidersConfig from environment variables.
 * Used during CLI bootstrap when no providers.jsonc exists.
 *
 * @param env - Environment variables (defaults to process.env)
 * @returns ProvidersConfig with all providers that have credentials in env
 */
function buildProvidersFromEnv(env = process.env) {
    const providers = {};
    // Check each provider that has env var mappings
    for (const provider of Object.keys(exports.PROVIDER_ENV_VARS)) {
        // Skip bedrock - it uses AWS credential chain, not simple API key
        if (provider === "bedrock")
            continue;
        const creds = resolveProviderCredentials(provider, {}, env);
        if (creds.isConfigured && creds.apiKey) {
            const entry = { apiKey: creds.apiKey };
            if (creds.baseUrl)
                entry.baseUrl = creds.baseUrl;
            if (creds.organization)
                entry.organization = creds.organization;
            providers[provider] = entry;
        }
    }
    // Azure OpenAI special case: maps to "openai" provider if not already set
    if (!providers.openai) {
        const azureKey = env[exports.AZURE_OPENAI_ENV_VARS.apiKey]?.trim();
        const azureEndpoint = env[exports.AZURE_OPENAI_ENV_VARS.endpoint]?.trim();
        if (azureKey && azureEndpoint) {
            const entry = {
                apiKey: azureKey,
                baseUrl: azureEndpoint,
            };
            const deployment = env[exports.AZURE_OPENAI_ENV_VARS.deployment]?.trim();
            if (deployment)
                entry.defaultModel = deployment;
            const apiVersion = env[exports.AZURE_OPENAI_ENV_VARS.apiVersion]?.trim();
            if (apiVersion)
                entry.apiVersion = apiVersion;
            providers.openai = entry;
        }
    }
    return providers;
}
/**
 * Check if any provider in the config has an API key configured.
 */
function hasAnyConfiguredProvider(providers) {
    if (!providers)
        return false;
    return Object.values(providers).some((config) => config && typeof config.apiKey === "string" && config.apiKey.trim().length > 0);
}
//# sourceMappingURL=providerRequirements.js.map