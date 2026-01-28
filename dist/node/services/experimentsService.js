"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExperimentsService = void 0;
const assert_1 = __importDefault(require("../../common/utils/assert"));
const experiments_1 = require("../../common/constants/experiments");
const paths_1 = require("../../common/constants/paths");
const log_1 = require("../../node/services/log");
const fs = __importStar(require("fs/promises"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const path = __importStar(require("path"));
const CACHE_FILE_NAME = "feature_flags.json";
const CACHE_FILE_VERSION = 1;
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
/**
 * Backend experiments service.
 *
 * Evaluates PostHog feature flags in the main process (via posthog-node) and exposes
 * the current assignments to the renderer via oRPC.
 *
 * Design goals:
 * - Never block user flows on network calls (use cached values and refresh in background)
 * - Fail closed (unknown = control/disabled)
 * - Avoid calling PostHog when telemetry is disabled
 */
class ExperimentsService {
    telemetryService;
    unixHome;
    cacheFilePath;
    cacheTtlMs;
    cachedVariants = new Map();
    refreshInFlight = new Map();
    cacheLoaded = false;
    constructor(options) {
        this.telemetryService = options.telemetryService;
        this.unixHome = options.unixHome ?? (0, paths_1.getUnixHome)();
        this.cacheFilePath = path.join(this.unixHome, CACHE_FILE_NAME);
        this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    }
    async initialize() {
        if (this.cacheLoaded) {
            return;
        }
        await this.loadCacheFromDisk();
        this.cacheLoaded = true;
        // Populate telemetry properties from cache immediately so variant breakdowns
        // are present even before a background refresh completes.
        for (const [experimentId, cached] of this.cachedVariants) {
            this.telemetryService.setFeatureFlagVariant(this.getFlagKey(experimentId), cached.value);
        }
        // Refresh in background (best effort). We only refresh values that are stale or missing
        // to avoid unnecessary network calls during startup.
        if (this.isRemoteEvaluationEnabled()) {
            for (const experimentId of Object.keys(experiments_1.EXPERIMENTS)) {
                this.maybeRefreshInBackground(experimentId);
            }
        }
    }
    isRemoteEvaluationEnabled() {
        return (this.telemetryService.getPostHogClient() !== null &&
            this.telemetryService.getDistinctId() !== null);
    }
    /**
     * Return current values for all known experiments.
     * This is used to render Settings → Experiments.
     */
    getAll() {
        const result = {};
        for (const experimentId of Object.keys(experiments_1.EXPERIMENTS)) {
            result[experimentId] = this.getExperimentValue(experimentId);
        }
        return result;
    }
    getExperimentValue(experimentId) {
        (0, assert_1.default)(experimentId in experiments_1.EXPERIMENTS, `Unknown experimentId: ${experimentId}`);
        if (!this.isRemoteEvaluationEnabled()) {
            return { value: null, source: "disabled" };
        }
        const cached = this.cachedVariants.get(experimentId);
        if (!cached) {
            // No cached value yet. Fail closed, but kick off a background refresh.
            this.maybeRefreshInBackground(experimentId);
            return { value: null, source: "cache" };
        }
        this.maybeRefreshInBackground(experimentId);
        return { value: cached.value, source: cached.source };
    }
    /**
     * Convert an experiment assignment to a boolean gate.
     *
     * NOTE: This intentionally does not block on network calls.
     */
    isExperimentEnabled(experimentId) {
        const value = this.getExperimentValue(experimentId).value;
        // PostHog can return either boolean flags or string variants.
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            // For now, treat variant "test" as enabled for experiments with control/test variants.
            // If we add experiments with different variant semantics, add a mapping per experiment.
            return value === "test";
        }
        return false;
    }
    async refreshAll() {
        await this.ensureInitialized();
        if (!this.isRemoteEvaluationEnabled()) {
            return;
        }
        await Promise.all(Object.keys(experiments_1.EXPERIMENTS).map(async (experimentId) => {
            await this.refreshExperiment(experimentId);
        }));
    }
    async refreshExperiment(experimentId) {
        await this.ensureInitialized();
        (0, assert_1.default)(experimentId in experiments_1.EXPERIMENTS, `Unknown experimentId: ${experimentId}`);
        if (!this.isRemoteEvaluationEnabled()) {
            return;
        }
        const existing = this.refreshInFlight.get(experimentId);
        if (existing) {
            return existing;
        }
        const promise = this.refreshExperimentImpl(experimentId).finally(() => {
            this.refreshInFlight.delete(experimentId);
        });
        this.refreshInFlight.set(experimentId, promise);
        return promise;
    }
    async refreshExperimentImpl(experimentId) {
        const client = this.telemetryService.getPostHogClient();
        const distinctId = this.telemetryService.getDistinctId();
        (0, assert_1.default)(client, "PostHog client must exist when remote evaluation is enabled");
        (0, assert_1.default)(distinctId, "distinctId must exist when remote evaluation is enabled");
        const flagKey = this.getFlagKey(experimentId);
        try {
            const value = await client.getFeatureFlag(flagKey, distinctId);
            if (typeof value !== "string" && typeof value !== "boolean") {
                return;
            }
            const cached = {
                value,
                fetchedAtMs: Date.now(),
                source: "posthog",
            };
            this.cachedVariants.set(experimentId, cached);
            this.telemetryService.setFeatureFlagVariant(flagKey, value);
            await this.writeCacheToDisk();
        }
        catch (error) {
            log_1.log.debug("Failed to refresh experiment from PostHog", {
                experimentId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    maybeRefreshInBackground(experimentId) {
        const cached = this.cachedVariants.get(experimentId);
        if (!cached) {
            void this.refreshExperiment(experimentId);
            return;
        }
        if (Date.now() - cached.fetchedAtMs > this.cacheTtlMs) {
            void this.refreshExperiment(experimentId);
        }
    }
    getFlagKey(experimentId) {
        // Today, our experiment IDs are already PostHog flag keys.
        // If that ever changes, this is the single mapping point.
        return experimentId;
    }
    async ensureInitialized() {
        if (this.cacheLoaded) {
            return;
        }
        await this.initialize();
        (0, assert_1.default)(this.cacheLoaded, "ExperimentsService failed to initialize");
    }
    async loadCacheFromDisk() {
        try {
            const raw = await fs.readFile(this.cacheFilePath, "utf-8");
            const parsed = JSON.parse(raw);
            if (!isRecord(parsed)) {
                return;
            }
            const version = parsed.version;
            const experiments = parsed.experiments;
            if (version !== CACHE_FILE_VERSION || !isRecord(experiments)) {
                return;
            }
            for (const [key, value] of Object.entries(experiments)) {
                if (!(key in experiments_1.EXPERIMENTS) || !isRecord(value)) {
                    continue;
                }
                const fetchedAtMs = value.fetchedAtMs;
                const variant = value.value;
                if (typeof fetchedAtMs !== "number" || !Number.isFinite(fetchedAtMs)) {
                    continue;
                }
                if (typeof variant !== "string" && typeof variant !== "boolean") {
                    continue;
                }
                this.cachedVariants.set(key, {
                    value: variant,
                    fetchedAtMs,
                    source: "cache",
                });
            }
        }
        catch {
            // Ignore missing/corrupt cache
        }
    }
    async writeCacheToDisk() {
        try {
            const experiments = {};
            for (const [experimentId, cached] of this.cachedVariants) {
                experiments[experimentId] = {
                    value: cached.value,
                    fetchedAtMs: cached.fetchedAtMs,
                };
            }
            const payload = {
                version: CACHE_FILE_VERSION,
                experiments,
            };
            await fs.mkdir(this.unixHome, { recursive: true });
            await (0, write_file_atomic_1.default)(this.cacheFilePath, JSON.stringify(payload, null, 2), "utf-8");
        }
        catch {
            // Ignore cache persistence failures
        }
    }
}
exports.ExperimentsService = ExperimentsService;
//# sourceMappingURL=experimentsService.js.map