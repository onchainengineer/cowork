"use strict";
/**
 * Environment variable parsing utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBoolEnv = parseBoolEnv;
exports.parseDebugUpdater = parseDebugUpdater;
/**
 * Parse environment variable as boolean
 * Accepts: "1", "true", "TRUE", "yes", "YES" as true
 * Everything else (including undefined, "0", "false", "FALSE") as false
 */
function parseBoolEnv(value) {
    if (!value)
        return false;
    const normalized = value.toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
}
/**
 * Parse DEBUG_UPDATER environment variable
 * Returns: { enabled: boolean, fakeVersion?: string }
 *
 * Examples:
 * - DEBUG_UPDATER=1 → { enabled: true }
 * - DEBUG_UPDATER=true → { enabled: true }
 * - DEBUG_UPDATER=1.2.3 → { enabled: true, fakeVersion: "1.2.3" }
 * - undefined → { enabled: false }
 */
function parseDebugUpdater(value) {
    if (!value)
        return { enabled: false };
    const normalized = value.toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
        return { enabled: true };
    }
    // Not a bool, treat as version string
    return { enabled: true, fakeVersion: value };
}
//# sourceMappingURL=env.js.map