"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
const featureFlags_1 = require("../../common/constants/featureFlags");
const FLAG_CACHE_TTL_MS = 10 * 60 * 1000;
class FeatureFlagService {
    config;
    telemetryService;
    cachedVariant = null;
    constructor(config, telemetryService) {
        this.config = config;
        this.telemetryService = telemetryService;
    }
    getOverride() {
        return this.config.getFeatureFlagOverride(featureFlags_1.FEATURE_FLAG_KEYS.statsTabV1);
    }
    async getVariant() {
        const now = Date.now();
        if (this.cachedVariant && now - this.cachedVariant.fetchedAt < FLAG_CACHE_TTL_MS) {
            return this.cachedVariant.value;
        }
        const value = await this.telemetryService.getFeatureFlag(featureFlags_1.FEATURE_FLAG_KEYS.statsTabV1);
        const variant = value === true || value === "stats" ? "stats" : "control";
        this.cachedVariant = { value: variant, fetchedAt: now };
        return variant;
    }
    async getStatsTabState() {
        const override = this.getOverride();
        const variant = await this.getVariant();
        const enabled = override === "on" ? true : override === "off" ? false : variant === "stats";
        return { enabled, variant, override };
    }
    async setStatsTabOverride(override) {
        await this.config.setFeatureFlagOverride(featureFlags_1.FEATURE_FLAG_KEYS.statsTabV1, override);
        return this.getStatsTabState();
    }
}
exports.FeatureFlagService = FeatureFlagService;
//# sourceMappingURL=featureFlagService.js.map