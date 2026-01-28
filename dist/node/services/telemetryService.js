"use strict";
/**
 * Backend Telemetry Service
 *
 * Sends telemetry events to PostHog from the main process (Node.js).
 * This avoids ad-blocker issues that affect browser-side telemetry.
 *
 * Telemetry is enabled by default, including in development mode.
 * It is automatically disabled in CI, test environments, and automation contexts
 * (NODE_ENV=test, CI, UNIX_E2E=1, JEST_WORKER_ID, etc.).
 * Users can manually disable telemetry by setting UNIX_DISABLE_TELEMETRY=1.
 *
 * Uses posthog-node which batches events and flushes asynchronously.
 */
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
exports.TelemetryService = void 0;
exports.shouldEnableTelemetry = shouldEnableTelemetry;
const assert_1 = __importDefault(require("../../common/utils/assert"));
const posthog_node_1 = require("posthog-node");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const paths_1 = require("../../common/constants/paths");
const version_1 = require("../../version");
// Telemetry disabled — no data is sent to any external service.
// To re-enable, set your own PostHog key and host below.
const DEFAULT_POSTHOG_KEY = "";
const DEFAULT_POSTHOG_HOST = "";
// File to persist anonymous distinct ID across sessions
const TELEMETRY_ID_FILE = "telemetry_id";
/**
 * Check if running in a CI/automation environment.
 * Covers major CI providers: GitHub Actions, GitLab CI, Jenkins, CircleCI,
 * Travis, Azure Pipelines, Bitbucket, TeamCity, Buildkite, etc.
 */
function isCIEnvironment(env) {
    return (
    // Generic CI indicator (set by most CI systems)
    env.CI === "true" ||
        env.CI === "1" ||
        // GitHub Actions
        env.GITHUB_ACTIONS === "true" ||
        // GitLab CI
        env.GITLAB_CI === "true" ||
        // Jenkins
        env.JENKINS_URL !== undefined ||
        // CircleCI
        env.CIRCLECI === "true" ||
        // Travis CI
        env.TRAVIS === "true" ||
        // Azure Pipelines
        env.TF_BUILD === "True" ||
        // Bitbucket Pipelines
        env.BITBUCKET_BUILD_NUMBER !== undefined ||
        // TeamCity
        env.TEAMCITY_VERSION !== undefined ||
        // Buildkite
        env.BUILDKITE === "true" ||
        // AWS CodeBuild
        env.CODEBUILD_BUILD_ID !== undefined ||
        // Drone CI
        env.DRONE === "true" ||
        // AppVeyor
        env.APPVEYOR === "True" ||
        // Vercel / Netlify (build environments)
        env.VERCEL === "1" ||
        env.NETLIFY === "true");
}
/**
 * Check if telemetry is disabled via environment variable or automation context
 */
function isTelemetryDisabledByEnv(env) {
    return (env.UNIX_DISABLE_TELEMETRY === "1" ||
        env.UNIX_E2E === "1" ||
        env.NODE_ENV === "test" ||
        env.JEST_WORKER_ID !== undefined ||
        env.VITEST !== undefined ||
        env.TEST_INTEGRATION === "1" ||
        isCIEnvironment(env));
}
function shouldEnableTelemetry(_context) {
    // Telemetry is permanently disabled in this build.
    return false;
}
async function getElectronIsPackaged(isElectron) {
    if (!isElectron) {
        return null;
    }
    try {
        // eslint-disable-next-line no-restricted-syntax -- Electron is unavailable in `unix server`; avoid top-level import
        const { app } = await Promise.resolve().then(() => __importStar(require("electron")));
        return app.isPackaged;
    }
    catch {
        // If we can't determine packaging status, fail closed.
        return null;
    }
}
/**
 * Get the version string for telemetry
 */
function getVersionString() {
    if (typeof version_1.VERSION === "object" &&
        version_1.VERSION !== null &&
        typeof version_1.VERSION.git_describe === "string") {
        return version_1.VERSION.git_describe;
    }
    return "unknown";
}
class TelemetryService {
    client = null;
    distinctId = null;
    featureFlagVariants = {};
    unixHome;
    getPostHogClient() {
        return this.client;
    }
    getDistinctId() {
        return this.distinctId;
    }
    /**
     * Check if telemetry is enabled.
     * Returns true only after initialize() completes and telemetry was not disabled.
     */
    isEnabled() {
        return this.client !== null;
    }
    /**
     * Check if telemetry was explicitly disabled by the user via UNIX_DISABLE_TELEMETRY=1.
     * This is different from isEnabled() which also returns false in dev mode.
     * Used to gate features like link sharing that should only be hidden when
     * the user explicitly opts out of unix services.
     */
    isExplicitlyDisabled() {
        return process.env.UNIX_DISABLE_TELEMETRY === "1";
    }
    /**
     * Set the current PostHog feature flag/experiment assignment.
     *
     * This is used to attach `$feature/<flagKey>` properties to all telemetry events so
     * PostHog can break down metrics by experiment variant (required for server-side capture).
     */
    setFeatureFlagVariant(flagKey, variant) {
        (0, assert_1.default)(typeof flagKey === "string", "flagKey must be a string");
        const trimmed = flagKey.trim();
        (0, assert_1.default)(trimmed.length > 0, "flagKey must not be empty");
        const key = `$feature/${trimmed}`;
        if (variant === null) {
            // Removing the property avoids emitting null values which can pollute breakdowns.
            // Note: This is safe even if telemetry is disabled.
            delete this.featureFlagVariants[key];
            return;
        }
        (0, assert_1.default)(typeof variant === "string" || typeof variant === "boolean", "variant must be a string | boolean | null");
        this.featureFlagVariants[key] = variant;
    }
    constructor(unixHome) {
        this.unixHome = unixHome ?? (0, paths_1.getUnixHome)();
    }
    /**
     * Initialize the PostHog client.
     * Should be called once on app startup.
     */
    async initialize() {
        if (this.client) {
            return;
        }
        const env = process.env;
        // Fast path: avoid Electron imports when telemetry is obviously disabled.
        if (isTelemetryDisabledByEnv(env)) {
            return;
        }
        const isElectron = typeof process.versions.electron === "string";
        const isPackaged = await getElectronIsPackaged(isElectron);
        if (!shouldEnableTelemetry({ env, isElectron, isPackaged })) {
            return;
        }
        // Load or generate distinct ID
        this.distinctId = await this.loadOrCreateDistinctId();
        this.client = new posthog_node_1.PostHog(DEFAULT_POSTHOG_KEY, {
            host: DEFAULT_POSTHOG_HOST,
            // Avoid geo-IP enrichment (we don't need coarse location for unix telemetry)
            disableGeoip: true,
        });
        console.debug("[TelemetryService] Initialized", { host: DEFAULT_POSTHOG_HOST });
    }
    /**
     * Load existing distinct ID or create a new one.
     * Persisted in ~/.unix/telemetry_id for cross-session identity.
     */
    async loadOrCreateDistinctId() {
        const idPath = path.join(this.unixHome, TELEMETRY_ID_FILE);
        try {
            // Try to read existing ID
            const id = (await fs.readFile(idPath, "utf-8")).trim();
            if (id) {
                return id;
            }
        }
        catch {
            // File doesn't exist or read error, will create new ID
        }
        // Generate new ID
        const newId = (0, crypto_1.randomUUID)();
        try {
            // Ensure directory exists
            await fs.mkdir(this.unixHome, { recursive: true });
            await fs.writeFile(idPath, newId, "utf-8");
        }
        catch {
            // Silently ignore persistence failures
        }
        return newId;
    }
    /**
     * Get base properties included with all events
     */
    getBaseProperties() {
        return {
            version: getVersionString(),
            backend_platform: process.platform,
            electronVersion: process.versions.electron ?? "unknown",
            nodeVersion: process.versions.node ?? "unknown",
            bunVersion: process.versions.bun ?? "unknown",
            ...this.featureFlagVariants,
        };
    }
    /**
     * Track a telemetry event.
     * Events are silently ignored when disabled.
     */
    async getFeatureFlag(key) {
        if (isTelemetryDisabledByEnv(process.env) || !this.client || !this.distinctId) {
            return undefined;
        }
        try {
            // `getFeatureFlag` will automatically emit $feature_flag_called.
            return await this.client.getFeatureFlag(key, this.distinctId, { disableGeoip: true });
        }
        catch {
            return undefined;
        }
    }
    capture(payload) {
        if (isTelemetryDisabledByEnv(process.env) || !this.client || !this.distinctId) {
            return;
        }
        // Merge base properties with event-specific properties
        const properties = {
            ...this.getBaseProperties(),
            ...payload.properties,
        };
        this.client.capture({
            distinctId: this.distinctId,
            event: payload.event,
            properties,
        });
    }
    /**
     * Shutdown telemetry and flush any pending events.
     * Should be called on app close.
     */
    async shutdown() {
        if (!this.client) {
            return;
        }
        try {
            await this.client.shutdown();
        }
        catch {
            // Silently ignore shutdown errors
        }
        this.client = null;
    }
}
exports.TelemetryService = TelemetryService;
//# sourceMappingURL=telemetryService.js.map