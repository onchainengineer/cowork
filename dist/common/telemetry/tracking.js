"use strict";
/**
 * Telemetry tracking functions
 *
 * These functions provide a clean API for tracking telemetry events.
 * Callers pass raw values; rounding and formatting happen internally.
 * This ensures consistent privacy-preserving transformations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackWorkspaceCreated = trackWorkspaceCreated;
exports.trackWorkspaceSwitched = trackWorkspaceSwitched;
exports.trackMessageSent = trackMessageSent;
exports.trackStatsTabOpened = trackStatsTabOpened;
exports.trackStreamCompleted = trackStreamCompleted;
exports.trackProviderConfigured = trackProviderConfigured;
exports.trackCommandUsed = trackCommandUsed;
exports.trackVoiceTranscription = trackVoiceTranscription;
exports.trackErrorOccurred = trackErrorOccurred;
exports.trackExperimentOverridden = trackExperimentOverridden;
const client_1 = require("./client");
const utils_1 = require("./utils");
/**
 * Get frontend platform information for telemetry.
 * Uses browser APIs (navigator) which are safe to send and widely shared.
 */
function getFrontendPlatform() {
    if (typeof navigator === "undefined") {
        return { userAgent: "unknown", platform: "unknown" };
    }
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
    };
}
// =============================================================================
// Tracking Functions
// =============================================================================
/**
 * Track workspace creation
 */
function trackWorkspaceCreated(workspaceId, runtimeType) {
    (0, client_1.trackEvent)({
        event: "workspace_created",
        properties: {
            workspaceId,
            runtimeType,
            frontendPlatform: getFrontendPlatform(),
        },
    });
}
/**
 * Track workspace switch
 */
function trackWorkspaceSwitched(fromWorkspaceId, toWorkspaceId) {
    (0, client_1.trackEvent)({
        event: "workspace_switched",
        properties: { fromWorkspaceId, toWorkspaceId },
    });
}
/**
 * Track message sent
 * @param messageLength - Raw character count (will be rounded to base-2)
 */
function trackMessageSent(workspaceId, model, agentId, messageLength, runtimeType, thinkingLevel) {
    (0, client_1.trackEvent)({
        event: "message_sent",
        properties: {
            workspaceId,
            model,
            agentId,
            message_length_b2: (0, utils_1.roundToBase2)(messageLength),
            runtimeType,
            frontendPlatform: getFrontendPlatform(),
            thinkingLevel,
        },
    });
}
/**
 * Track stats tab opening.
 */
function trackStatsTabOpened(viewMode, showModeBreakdown) {
    (0, client_1.trackEvent)({
        event: "stats_tab_opened",
        properties: { viewMode, showModeBreakdown },
    });
}
/**
 * Track stream completion
 * @param durationSecs - Raw duration in seconds (will be rounded to base-2)
 * @param outputTokens - Raw token count (will be rounded to base-2)
 */
function trackStreamCompleted(model, wasInterrupted, durationSecs, outputTokens) {
    (0, client_1.trackEvent)({
        event: "stream_completed",
        properties: {
            model,
            wasInterrupted,
            duration_b2: (0, utils_1.roundToBase2)(durationSecs),
            output_tokens_b2: (0, utils_1.roundToBase2)(outputTokens),
        },
    });
}
/**
 * Track provider configuration (not the key value, just that it was configured)
 */
function trackProviderConfigured(provider, keyType) {
    (0, client_1.trackEvent)({
        event: "provider_configured",
        properties: { provider, keyType },
    });
}
/**
 * Track slash command usage
 */
function trackCommandUsed(command) {
    (0, client_1.trackEvent)({
        event: "command_used",
        properties: { command },
    });
}
/**
 * Track voice transcription
 * @param audioDurationSecs - Raw duration in seconds (will be rounded to base-2)
 */
function trackVoiceTranscription(audioDurationSecs, success) {
    (0, client_1.trackEvent)({
        event: "voice_transcription",
        properties: {
            audio_duration_b2: (0, utils_1.roundToBase2)(audioDurationSecs),
            success,
        },
    });
}
/**
 * Track error occurrence
 */
function trackErrorOccurred(errorType, context) {
    (0, client_1.trackEvent)({
        event: "error_occurred",
        properties: { errorType, context },
    });
}
/**
 * Track experiment override - when a user manually toggles an experiment
 * @param experimentId - The experiment identifier
 * @param assignedVariant - What PostHog assigned (null if not remote-controlled)
 * @param userChoice - What the user chose (true = enabled, false = disabled)
 */
function trackExperimentOverridden(experimentId, assignedVariant, userChoice) {
    (0, client_1.trackEvent)({
        event: "experiment_overridden",
        properties: { experimentId, assignedVariant, userChoice },
    });
}
//# sourceMappingURL=tracking.js.map