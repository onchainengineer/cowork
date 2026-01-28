"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderService = void 0;
const events_1 = require("events");
const providers_1 = require("../../common/constants/providers");
const log_1 = require("../../node/services/log");
const providerRequirements_1 = require("../../node/utils/providerRequirements");
class ProviderService {
    config;
    emitter = new events_1.EventEmitter();
    constructor(config) {
        this.config = config;
        // The provider config subscription may have many concurrent listeners (e.g. multiple windows).
        // Avoid noisy MaxListenersExceededWarning for normal usage.
        this.emitter.setMaxListeners(50);
    }
    /**
     * Subscribe to config change events. Used by oRPC subscription handler.
     * Returns a cleanup function.
     */
    onConfigChanged(callback) {
        this.emitter.on("configChanged", callback);
        return () => this.emitter.off("configChanged", callback);
    }
    emitConfigChanged() {
        this.emitter.emit("configChanged");
    }
    list() {
        try {
            return [...providers_1.SUPPORTED_PROVIDERS];
        }
        catch (error) {
            log_1.log.error("Failed to list providers:", error);
            return [];
        }
    }
    /**
     * Get the full providers config with safe info (no actual API keys)
     */
    getConfig() {
        const providersConfig = this.config.loadProvidersConfig() ?? {};
        const result = {};
        for (const provider of providers_1.SUPPORTED_PROVIDERS) {
            const config = (providersConfig[provider] ?? {});
            const providerInfo = {
                apiKeySet: !!config.apiKey,
                isConfigured: false, // computed below
                baseUrl: config.baseUrl,
                models: config.models,
            };
            // OpenAI-specific fields
            const serviceTier = config.serviceTier;
            if (provider === "openai" &&
                (serviceTier === "auto" ||
                    serviceTier === "default" ||
                    serviceTier === "flex" ||
                    serviceTier === "priority")) {
                providerInfo.serviceTier = serviceTier;
            }
            // AWS/Bedrock-specific fields
            if (provider === "bedrock") {
                providerInfo.aws = {
                    region: config.region,
                    bearerTokenSet: !!config.bearerToken,
                    accessKeyIdSet: !!config.accessKeyId,
                    secretAccessKeySet: !!config.secretAccessKey,
                };
            }
            // Compute isConfigured using shared utility (checks config + env vars)
            providerInfo.isConfigured = (0, providerRequirements_1.checkProviderConfigured)(provider, config).isConfigured;
            result[provider] = providerInfo;
        }
        return result;
    }
    /**
     * Set custom models for a provider
     */
    setModels(provider, models) {
        try {
            const providersConfig = this.config.loadProvidersConfig() ?? {};
            if (!providersConfig[provider]) {
                providersConfig[provider] = {};
            }
            providersConfig[provider].models = models;
            this.config.saveProvidersConfig(providersConfig);
            this.emitConfigChanged();
            return { success: true, data: undefined };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Failed to set models: ${message}` };
        }
    }
    setConfig(provider, keyPath, value) {
        try {
            // Load current providers config or create empty
            const providersConfig = this.config.loadProvidersConfig() ?? {};
            // Ensure provider exists
            if (!providersConfig[provider]) {
                providersConfig[provider] = {};
            }
            // Set nested property value
            let current = providersConfig[provider];
            for (let i = 0; i < keyPath.length - 1; i++) {
                const key = keyPath[i];
                if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
                    current[key] = {};
                }
                current = current[key];
            }
            if (keyPath.length > 0) {
                const lastKey = keyPath[keyPath.length - 1];
                // Delete key if value is empty string (used for clearing API keys), otherwise set it
                if (value === "") {
                    delete current[lastKey];
                }
                else {
                    current[lastKey] = value;
                }
            }
            // Save updated config
            this.config.saveProvidersConfig(providersConfig);
            this.emitConfigChanged();
            return { success: true, data: undefined };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Failed to set provider config: ${message}` };
        }
    }
}
exports.ProviderService = ProviderService;
//# sourceMappingURL=providerService.js.map