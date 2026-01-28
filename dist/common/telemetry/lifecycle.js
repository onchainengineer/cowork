"use strict";
/**
 * Telemetry lifecycle tracking
 *
 * Handles app startup events
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackAppStarted = trackAppStarted;
const client_1 = require("./client");
const storage_1 = require("../../common/constants/storage");
// Storage key for first launch tracking
const FIRST_LAUNCH_KEY = "mux_first_launch_complete";
/**
 * Check if this is the first app launch
 * Uses localStorage to persist flag across sessions
 */
function checkFirstLaunch() {
    const hasLaunchedBefore = localStorage.getItem(FIRST_LAUNCH_KEY);
    if (hasLaunchedBefore) {
        return false;
    }
    // First launch - set the flag
    localStorage.setItem(FIRST_LAUNCH_KEY, "true");
    return true;
}
/**
 * Check if vim mode is enabled
 */
function checkVimModeEnabled() {
    return localStorage.getItem(storage_1.VIM_ENABLED_KEY) === "true";
}
/**
 * Track app startup
 * Should be called once when the app initializes
 */
function trackAppStarted() {
    const isFirstLaunch = checkFirstLaunch();
    const vimModeEnabled = checkVimModeEnabled();
    console.debug("[Telemetry] trackAppStarted", { isFirstLaunch, vimModeEnabled });
    (0, client_1.trackEvent)({
        event: "app_started",
        properties: {
            isFirstLaunch,
            vimModeEnabled,
        },
    });
}
//# sourceMappingURL=lifecycle.js.map