"use strict";
/**
 * Experiments System
 *
 * Global feature flags for experimental features.
 * State is persisted in localStorage as `experiment:${experimentId}`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPERIMENTS = exports.EXPERIMENT_IDS = void 0;
exports.getExperimentKey = getExperimentKey;
exports.getExperimentList = getExperimentList;
exports.EXPERIMENT_IDS = {
    PROGRAMMATIC_TOOL_CALLING: "programmatic-tool-calling",
    PROGRAMMATIC_TOOL_CALLING_EXCLUSIVE: "programmatic-tool-calling-exclusive",
    CONFIGURABLE_BIND_URL: "configurable-bind-url",
    SYSTEM_1: "system-1",
};
/**
 * Registry of all experiments.
 * Use Record<ExperimentId, ExperimentDefinition> to ensure exhaustive coverage.
 */
exports.EXPERIMENTS = {
    [exports.EXPERIMENT_IDS.PROGRAMMATIC_TOOL_CALLING]: {
        id: exports.EXPERIMENT_IDS.PROGRAMMATIC_TOOL_CALLING,
        name: "Programmatic Tool Calling",
        description: "Enable code_execution tool for multi-tool workflows in a sandboxed JS runtime",
        enabledByDefault: false,
        userOverridable: true,
        showInSettings: true,
    },
    [exports.EXPERIMENT_IDS.PROGRAMMATIC_TOOL_CALLING_EXCLUSIVE]: {
        id: exports.EXPERIMENT_IDS.PROGRAMMATIC_TOOL_CALLING_EXCLUSIVE,
        name: "PTC Exclusive Mode",
        description: "Replace all tools with code_execution (forces PTC usage)",
        enabledByDefault: false,
        userOverridable: true,
        showInSettings: true,
    },
    [exports.EXPERIMENT_IDS.CONFIGURABLE_BIND_URL]: {
        id: exports.EXPERIMENT_IDS.CONFIGURABLE_BIND_URL,
        name: "Expose API server on LAN/VPN",
        description: "Allow unix to listen on a non-localhost address so other devices on your LAN/VPN can connect. Anyone on your network with the auth token can access your unix API. HTTP only; use only on trusted networks (Tailscale recommended).",
        enabledByDefault: false,
        userOverridable: true,
        showInSettings: true,
    },
    [exports.EXPERIMENT_IDS.SYSTEM_1]: {
        id: exports.EXPERIMENT_IDS.SYSTEM_1,
        name: "System 1",
        description: "Context optimization helpers inspired by Thinking, Fast and Slow (Kahneman)",
        enabledByDefault: false,
        userOverridable: true,
        showInSettings: true,
    },
};
/**
 * Get localStorage key for an experiment.
 * Format: "experiment:{experimentId}"
 */
function getExperimentKey(experimentId) {
    return `experiment:${experimentId}`;
}
/**
 * Get all experiment definitions as an array for iteration.
 */
function getExperimentList() {
    return Object.values(exports.EXPERIMENTS);
}
//# sourceMappingURL=experiments.js.map