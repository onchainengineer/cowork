"use strict";
/**
 * Telemetry module public API
 *
 * This module provides telemetry tracking via PostHog.
 * Events are forwarded to the backend via ORPC to avoid ad-blocker issues.
 * Backend controls whether telemetry is enabled (UNIX_DISABLE_TELEMETRY env var).
 * See payload.ts for all data structures sent to PostHog.
 *
 * USAGE:
 * - Use the track* functions for event tracking (they handle rounding internally)
 * - Use getRuntimeTypeForTelemetry to convert RuntimeConfig to telemetry-safe type
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRuntimeTypeForTelemetry = exports.trackExperimentOverridden = exports.trackErrorOccurred = exports.trackVoiceTranscription = exports.trackCommandUsed = exports.trackProviderConfigured = exports.trackStreamCompleted = exports.trackStatsTabOpened = exports.trackMessageSent = exports.trackWorkspaceSwitched = exports.trackWorkspaceCreated = exports.trackAppStarted = exports.shutdownTelemetry = exports.initTelemetry = void 0;
const client_1 = require("./client");
Object.defineProperty(exports, "initTelemetry", { enumerable: true, get: function () { return client_1.initTelemetry; } });
Object.defineProperty(exports, "shutdownTelemetry", { enumerable: true, get: function () { return client_1.shutdownTelemetry; } });
const lifecycle_1 = require("./lifecycle");
Object.defineProperty(exports, "trackAppStarted", { enumerable: true, get: function () { return lifecycle_1.trackAppStarted; } });
// Tracking functions - callers pass raw values, rounding handled internally
const tracking_1 = require("./tracking");
Object.defineProperty(exports, "trackWorkspaceCreated", { enumerable: true, get: function () { return tracking_1.trackWorkspaceCreated; } });
Object.defineProperty(exports, "trackWorkspaceSwitched", { enumerable: true, get: function () { return tracking_1.trackWorkspaceSwitched; } });
Object.defineProperty(exports, "trackMessageSent", { enumerable: true, get: function () { return tracking_1.trackMessageSent; } });
Object.defineProperty(exports, "trackStatsTabOpened", { enumerable: true, get: function () { return tracking_1.trackStatsTabOpened; } });
Object.defineProperty(exports, "trackStreamCompleted", { enumerable: true, get: function () { return tracking_1.trackStreamCompleted; } });
Object.defineProperty(exports, "trackProviderConfigured", { enumerable: true, get: function () { return tracking_1.trackProviderConfigured; } });
Object.defineProperty(exports, "trackCommandUsed", { enumerable: true, get: function () { return tracking_1.trackCommandUsed; } });
Object.defineProperty(exports, "trackVoiceTranscription", { enumerable: true, get: function () { return tracking_1.trackVoiceTranscription; } });
Object.defineProperty(exports, "trackErrorOccurred", { enumerable: true, get: function () { return tracking_1.trackErrorOccurred; } });
Object.defineProperty(exports, "trackExperimentOverridden", { enumerable: true, get: function () { return tracking_1.trackExperimentOverridden; } });
// Utility for converting RuntimeConfig to telemetry-safe runtime type
const utils_1 = require("./utils");
Object.defineProperty(exports, "getRuntimeTypeForTelemetry", { enumerable: true, get: function () { return utils_1.getRuntimeTypeForTelemetry; } });
//# sourceMappingURL=index.js.map