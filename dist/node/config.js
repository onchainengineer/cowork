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
exports.defaultConfig = exports.Config = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const jsonc = __importStar(require("jsonc-parser"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const log_1 = require("../node/services/log");
const tasks_1 = require("../common/types/tasks");
const uiLayouts_1 = require("../common/types/uiLayouts");
const agentAiDefaults_1 = require("../common/types/agentAiDefaults");
const workspace_1 = require("../common/constants/workspace");
const runtimeCompatibility_1 = require("../common/utils/runtimeCompatibility");
const paths_1 = require("../common/constants/paths");
const paths_2 = require("../common/utils/paths");
const pathUtils_1 = require("../node/utils/pathUtils");
const DockerRuntime_1 = require("../node/runtime/DockerRuntime");
function parseOptionalNonEmptyString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
function parseOptionalEnvBoolean(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
        return true;
    }
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
        return false;
    }
    return undefined;
}
function parseOptionalBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function parseOptionalStringArray(value) {
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value.filter((item) => typeof item === "string");
}
function parseOptionalPort(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
        return undefined;
    }
    if (value < 0 || value > 65535) {
        return undefined;
    }
    return value;
}
/**
 * Config - Centralized configuration management
 *
 * Encapsulates all config paths and operations, making them dependency-injectable
 * and testable. Pass a custom rootDir for tests to avoid polluting ~/.unix
 */
class Config {
    rootDir;
    sessionsDir;
    srcDir;
    configFile;
    providersFile;
    secretsFile;
    constructor(rootDir) {
        this.rootDir = rootDir ?? (0, paths_1.getUnixHome)();
        this.sessionsDir = path.join(this.rootDir, "sessions");
        this.srcDir = path.join(this.rootDir, "src");
        this.configFile = path.join(this.rootDir, "config.json");
        this.providersFile = path.join(this.rootDir, "providers.jsonc");
        this.secretsFile = path.join(this.rootDir, "secrets.json");
    }
    loadConfigOrDefault() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, "utf-8");
                const parsed = JSON.parse(data);
                // Config is stored as array of [path, config] pairs
                if (parsed.projects && Array.isArray(parsed.projects)) {
                    const rawPairs = parsed.projects;
                    // Migrate: normalize project paths by stripping trailing slashes
                    // This fixes configs created with paths like "/home/user/project/"
                    // Also filter out any malformed entries (null/undefined paths)
                    const normalizedPairs = rawPairs
                        .filter(([projectPath]) => {
                        if (!projectPath || typeof projectPath !== "string") {
                            log_1.log.warn("Filtering out project with invalid path", { projectPath });
                            return false;
                        }
                        return true;
                    })
                        .map(([projectPath, projectConfig]) => {
                        return [(0, pathUtils_1.stripTrailingSlashes)(projectPath), projectConfig];
                    });
                    const projectsMap = new Map(normalizedPairs);
                    const taskSettings = (0, tasks_1.normalizeTaskSettings)(parsed.taskSettings);
                    const legacySubagentAiDefaults = (0, tasks_1.normalizeSubagentAiDefaults)(parsed.subagentAiDefaults);
                    const agentAiDefaults = parsed.agentAiDefaults !== undefined
                        ? (0, agentAiDefaults_1.normalizeAgentAiDefaults)(parsed.agentAiDefaults)
                        : (0, agentAiDefaults_1.normalizeAgentAiDefaults)(legacySubagentAiDefaults);
                    const layoutPresetsRaw = (0, uiLayouts_1.normalizeLayoutPresetsConfig)(parsed.layoutPresets);
                    const layoutPresets = (0, uiLayouts_1.isLayoutPresetsConfigEmpty)(layoutPresetsRaw)
                        ? undefined
                        : layoutPresetsRaw;
                    return {
                        projects: projectsMap,
                        apiServerBindHost: parseOptionalNonEmptyString(parsed.apiServerBindHost),
                        apiServerServeWebUi: parseOptionalBoolean(parsed.apiServerServeWebUi)
                            ? true
                            : undefined,
                        apiServerPort: parseOptionalPort(parsed.apiServerPort),
                        mdnsAdvertisementEnabled: parseOptionalBoolean(parsed.mdnsAdvertisementEnabled),
                        mdnsServiceName: parseOptionalNonEmptyString(parsed.mdnsServiceName),
                        serverSshHost: parsed.serverSshHost,
                        viewedSplashScreens: parsed.viewedSplashScreens,
                        layoutPresets,
                        taskSettings,
                        agentAiDefaults,
                        // Legacy fields are still parsed and returned for downgrade compatibility.
                        subagentAiDefaults: legacySubagentAiDefaults,
                        featureFlagOverrides: parsed.featureFlagOverrides,
                        useSSH2Transport: parseOptionalBoolean(parsed.useSSH2Transport),
                    };
                }
            }
        }
        catch (error) {
            log_1.log.error("Error loading config:", error);
        }
        // Return default config
        return {
            projects: new Map(),
            taskSettings: tasks_1.DEFAULT_TASK_SETTINGS,
            agentAiDefaults: {},
            subagentAiDefaults: {},
        };
    }
    async saveConfig(config) {
        try {
            if (!fs.existsSync(this.rootDir)) {
                fs.mkdirSync(this.rootDir, { recursive: true });
            }
            const data = {
                projects: Array.from(config.projects.entries()),
                taskSettings: config.taskSettings ?? tasks_1.DEFAULT_TASK_SETTINGS,
            };
            const apiServerBindHost = parseOptionalNonEmptyString(config.apiServerBindHost);
            if (apiServerBindHost) {
                data.apiServerBindHost = apiServerBindHost;
            }
            const apiServerServeWebUi = parseOptionalBoolean(config.apiServerServeWebUi);
            if (apiServerServeWebUi) {
                data.apiServerServeWebUi = true;
            }
            const apiServerPort = parseOptionalPort(config.apiServerPort);
            if (apiServerPort !== undefined) {
                data.apiServerPort = apiServerPort;
            }
            const mdnsAdvertisementEnabled = parseOptionalBoolean(config.mdnsAdvertisementEnabled);
            if (mdnsAdvertisementEnabled !== undefined) {
                data.mdnsAdvertisementEnabled = mdnsAdvertisementEnabled;
            }
            const mdnsServiceName = parseOptionalNonEmptyString(config.mdnsServiceName);
            if (mdnsServiceName) {
                data.mdnsServiceName = mdnsServiceName;
            }
            if (config.serverSshHost) {
                data.serverSshHost = config.serverSshHost;
            }
            if (config.featureFlagOverrides) {
                data.featureFlagOverrides = config.featureFlagOverrides;
            }
            if (config.layoutPresets) {
                const normalized = (0, uiLayouts_1.normalizeLayoutPresetsConfig)(config.layoutPresets);
                if (!(0, uiLayouts_1.isLayoutPresetsConfigEmpty)(normalized)) {
                    data.layoutPresets = normalized;
                }
            }
            if (config.viewedSplashScreens) {
                data.viewedSplashScreens = config.viewedSplashScreens;
            }
            if (config.agentAiDefaults && Object.keys(config.agentAiDefaults).length > 0) {
                data.agentAiDefaults = config.agentAiDefaults;
                const legacySubagent = {};
                for (const [id, entry] of Object.entries(config.agentAiDefaults)) {
                    if (id === "plan" || id === "exec" || id === "compact")
                        continue;
                    legacySubagent[id] = entry;
                }
                if (Object.keys(legacySubagent).length > 0) {
                    data.subagentAiDefaults = legacySubagent;
                }
            }
            else {
                // Legacy only.
                if (config.subagentAiDefaults && Object.keys(config.subagentAiDefaults).length > 0) {
                    data.subagentAiDefaults = config.subagentAiDefaults;
                }
            }
            if (config.useSSH2Transport !== undefined) {
                data.useSSH2Transport = config.useSSH2Transport;
            }
            await (0, write_file_atomic_1.default)(this.configFile, JSON.stringify(data, null, 2), "utf-8");
        }
        catch (error) {
            log_1.log.error("Error saving config:", error);
        }
    }
    /**
     * Edit config atomically using a transformation function
     * @param fn Function that takes current config and returns modified config
     */
    async editConfig(fn) {
        const config = this.loadConfigOrDefault();
        const newConfig = fn(config);
        await this.saveConfig(newConfig);
    }
    /**
     * Cross-client feature flag overrides (shared via ~/.unix/config.json).
     */
    getFeatureFlagOverride(flagKey) {
        const config = this.loadConfigOrDefault();
        const override = config.featureFlagOverrides?.[flagKey];
        if (override === "on" || override === "off" || override === "default") {
            return override;
        }
        return "default";
    }
    async setFeatureFlagOverride(flagKey, override) {
        await this.editConfig((config) => {
            const next = { ...(config.featureFlagOverrides ?? {}) };
            if (override === "default") {
                delete next[flagKey];
            }
            else {
                next[flagKey] = override;
            }
            config.featureFlagOverrides = Object.keys(next).length > 0 ? next : undefined;
            return config;
        });
    }
    /**
     * mDNS advertisement enablement.
     *
     * - true: attempt to advertise (will warn if the API server is loopback-only)
     * - false: never advertise
     * - undefined: "auto" (advertise only when the API server is LAN-reachable)
     */
    getMdnsAdvertisementEnabled() {
        const envOverride = parseOptionalEnvBoolean(process.env.UNIX_MDNS_ADVERTISE);
        if (envOverride !== undefined) {
            return envOverride;
        }
        const config = this.loadConfigOrDefault();
        return config.mdnsAdvertisementEnabled;
    }
    /** Optional DNS-SD service instance name override. */
    getMdnsServiceName() {
        const envName = parseOptionalNonEmptyString(process.env.UNIX_MDNS_SERVICE_NAME);
        if (envName) {
            return envName;
        }
        const config = this.loadConfigOrDefault();
        return config.mdnsServiceName;
    }
    /**
     * Get the configured SSH hostname for this server (used for editor deep links in browser mode).
     */
    getServerSshHost() {
        const config = this.loadConfigOrDefault();
        return config.serverSshHost;
    }
    getProjectName(projectPath) {
        return paths_2.PlatformPaths.getProjectName(projectPath);
    }
    /**
     * Generate a stable unique workspace ID.
     * Uses 10 random hex characters for readability while maintaining uniqueness.
     *
     * Example: "a1b2c3d4e5"
     */
    generateStableId() {
        // Generate 5 random bytes and convert to 10 hex chars
        return crypto.randomBytes(5).toString("hex");
    }
    /**
     * DEPRECATED: Generate legacy workspace ID from project and workspace paths.
     * This method is used only for legacy workspace migration to look up old workspaces.
     * New workspaces use generateStableId() which returns a random stable ID.
     *
     * DO NOT use this method or its format to construct workspace IDs anywhere in the codebase.
     * Workspace IDs are backend implementation details and must only come from backend operations.
     */
    generateLegacyId(projectPath, workspacePath) {
        const projectBasename = this.getProjectName(projectPath);
        const workspaceBasename = paths_2.PlatformPaths.basename(workspacePath);
        return `${projectBasename}-${workspaceBasename}`;
    }
    /**
     * Get the workspace directory path for a given directory name.
     * The directory name is the workspace name (branch name).
     */
    /**
     * Add paths to WorkspaceMetadata to create FrontendWorkspaceMetadata.
     * Helper to avoid duplicating path computation logic.
     */
    addPathsToMetadata(metadata, workspacePath, _projectPath) {
        const result = {
            ...metadata,
            namedWorkspacePath: workspacePath,
        };
        // Check for incompatible runtime configs (from newer unix versions)
        if ((0, runtimeCompatibility_1.isIncompatibleRuntimeConfig)(metadata.runtimeConfig)) {
            result.incompatibleRuntime =
                "This workspace was created with a newer version ofunix. " +
                    "Please upgrade unix to use this workspace.";
        }
        return result;
    }
    /**
     * Find a workspace path and project path by workspace ID
     * @returns Object with workspace and project paths, or null if not found
     */
    findWorkspace(workspaceId) {
        const config = this.loadConfigOrDefault();
        for (const [projectPath, project] of config.projects) {
            for (const workspace of project.workspaces) {
                // NEW FORMAT: Check config first (primary source of truth after migration)
                if (workspace.id === workspaceId) {
                    return { workspacePath: workspace.path, projectPath };
                }
                // LEGACY FORMAT: Fall back to metadata.json and legacy ID for unmigrated workspaces
                if (!workspace.id) {
                    // Extract workspace basename (could be stable ID or legacy name)
                    const workspaceBasename = workspace.path.split("/").pop() ?? workspace.path.split("\\").pop() ?? "unknown";
                    // Try loading metadata with basename as ID (works for old workspaces)
                    const metadataPath = path.join(this.getSessionDir(workspaceBasename), "metadata.json");
                    if (fs.existsSync(metadataPath)) {
                        try {
                            const data = fs.readFileSync(metadataPath, "utf-8");
                            const metadata = JSON.parse(data);
                            if (metadata.id === workspaceId) {
                                return { workspacePath: workspace.path, projectPath };
                            }
                        }
                        catch {
                            // Ignore parse errors, try legacy ID
                        }
                    }
                    // Try legacy ID format as last resort
                    const legacyId = this.generateLegacyId(projectPath, workspace.path);
                    if (legacyId === workspaceId) {
                        return { workspacePath: workspace.path, projectPath };
                    }
                }
            }
        }
        return null;
    }
    /**
     * Workspace Path Architecture:
     *
     * Workspace paths are computed on-demand from projectPath + workspace name using
     * config.getWorkspacePath(projectPath, directoryName). This ensures a single source of truth.
     *
     * - Worktree directory name: uses workspace.name (the branch name)
     * - Workspace ID: stable random identifier for identity and sessions (not used for directories)
     *
     * Backend: Uses getWorkspacePath(metadata.projectPath, metadata.name) for workspace directory paths
     * Frontend: Gets enriched metadata with paths via IPC (FrontendWorkspaceMetadata)
     *
     * WorkspaceMetadata.workspacePath is deprecated and will be removed. Use computed
     * paths from getWorkspacePath() or getWorkspacePaths() instead.
     */
    /**
     * Get the session directory for a specific workspace
     */
    getSessionDir(workspaceId) {
        return path.join(this.sessionsDir, workspaceId);
    }
    /**
     * Get all workspace metadata by loading config and metadata files.
     *
     * Returns FrontendWorkspaceMetadata with paths already computed.
     * This eliminates the need for separate "enrichment" - paths are computed
     * once during the loop when we already have all the necessary data.
     *
     * NEW BEHAVIOR: Config is the primary source of truth
     * - If workspace has id/name/createdAt in config, use those directly
     * - If workspace only has path, fall back to reading metadata.json
     * - Migrate old workspaces by copying metadata from files to config
     *
     * This centralizes workspace metadata in config.json and eliminates the need
     * for scattered metadata.json files (kept for backward compat with older versions).
     *
     * GUARANTEE: Every workspace returned will have a createdAt timestamp.
     * If missing from config or legacy metadata, a new timestamp is assigned and
     * saved to config for subsequent loads.
     */
    async getAllWorkspaceMetadata() {
        const config = this.loadConfigOrDefault();
        const workspaceMetadata = [];
        let configModified = false;
        for (const [projectPath, projectConfig] of config.projects) {
            // Validate project path is not empty (defensive check for corrupted config)
            if (!projectPath) {
                log_1.log.warn("Skipping project with empty path in config", {
                    workspaceCount: projectConfig.workspaces?.length ?? 0,
                });
                continue;
            }
            const projectName = this.getProjectName(projectPath);
            for (const workspace of projectConfig.workspaces) {
                // Extract workspace basename from path (could be stable ID or legacy name)
                const workspaceBasename = workspace.path.split("/").pop() ?? workspace.path.split("\\").pop() ?? "unknown";
                try {
                    // NEW FORMAT: If workspace has metadata in config, use it directly
                    if (workspace.id && workspace.name) {
                        const metadata = {
                            id: workspace.id,
                            name: workspace.name,
                            title: workspace.title,
                            projectName,
                            projectPath,
                            // GUARANTEE: All workspaces must have createdAt (assign now if missing)
                            createdAt: workspace.createdAt ?? new Date().toISOString(),
                            // GUARANTEE: All workspaces must have runtimeConfig (apply default if missing)
                            runtimeConfig: workspace.runtimeConfig ?? workspace_1.DEFAULT_RUNTIME_CONFIG,
                            aiSettings: workspace.aiSettings,
                            aiSettingsByAgent: workspace.aiSettingsByAgent ??
                                (workspace.aiSettings
                                    ? {
                                        plan: workspace.aiSettings,
                                        exec: workspace.aiSettings,
                                    }
                                    : undefined),
                            parentWorkspaceId: workspace.parentWorkspaceId,
                            agentType: workspace.agentType,
                            taskStatus: workspace.taskStatus,
                            reportedAt: workspace.reportedAt,
                            taskModelString: workspace.taskModelString,
                            taskThinkingLevel: workspace.taskThinkingLevel,
                            taskPrompt: workspace.taskPrompt,
                            taskTrunkBranch: workspace.taskTrunkBranch,
                            archivedAt: workspace.archivedAt,
                            unarchivedAt: workspace.unarchivedAt,
                            sectionId: workspace.sectionId,
                        };
                        // Migrate missing createdAt to config for next load
                        if (!workspace.createdAt) {
                            workspace.createdAt = metadata.createdAt;
                            configModified = true;
                        }
                        // Migrate missing runtimeConfig to config for next load
                        if (!workspace.aiSettingsByAgent) {
                            const derived = workspace.aiSettings
                                ? {
                                    plan: workspace.aiSettings,
                                    exec: workspace.aiSettings,
                                }
                                : undefined;
                            if (derived) {
                                workspace.aiSettingsByAgent = derived;
                                configModified = true;
                            }
                        }
                        if (!workspace.runtimeConfig) {
                            workspace.runtimeConfig = metadata.runtimeConfig;
                            configModified = true;
                        }
                        // Populate containerName for Docker workspaces (computed from project path and workspace name)
                        if (metadata.runtimeConfig?.type === "docker" &&
                            !metadata.runtimeConfig.containerName) {
                            metadata.runtimeConfig = {
                                ...metadata.runtimeConfig,
                                containerName: (0, DockerRuntime_1.getContainerName)(projectPath, metadata.name),
                            };
                        }
                        workspaceMetadata.push(this.addPathsToMetadata(metadata, workspace.path, projectPath));
                        continue; // Skip metadata file lookup
                    }
                    // LEGACY FORMAT: Fall back to reading metadata.json
                    // Try legacy ID format first (project-workspace) - used by E2E tests and old workspaces
                    const legacyId = this.generateLegacyId(projectPath, workspace.path);
                    const metadataPath = path.join(this.getSessionDir(legacyId), "metadata.json");
                    let metadataFound = false;
                    if (fs.existsSync(metadataPath)) {
                        const data = fs.readFileSync(metadataPath, "utf-8");
                        const metadata = JSON.parse(data);
                        // Ensure required fields are present
                        if (!metadata.name)
                            metadata.name = workspaceBasename;
                        if (!metadata.projectPath)
                            metadata.projectPath = projectPath;
                        if (!metadata.projectName)
                            metadata.projectName = projectName;
                        // GUARANTEE: All workspaces must have createdAt
                        metadata.createdAt ?? (metadata.createdAt = new Date().toISOString());
                        // GUARANTEE: All workspaces must have runtimeConfig
                        metadata.runtimeConfig ?? (metadata.runtimeConfig = workspace_1.DEFAULT_RUNTIME_CONFIG);
                        // Preserve any config-only fields that may not exist in legacy metadata.json
                        metadata.aiSettingsByAgent ?? (metadata.aiSettingsByAgent = workspace.aiSettingsByAgent ??
                            (workspace.aiSettings
                                ? {
                                    plan: workspace.aiSettings,
                                    exec: workspace.aiSettings,
                                }
                                : undefined));
                        metadata.aiSettings ?? (metadata.aiSettings = workspace.aiSettings);
                        // Preserve tree/task metadata when present in config (metadata.json won't have it)
                        metadata.parentWorkspaceId ?? (metadata.parentWorkspaceId = workspace.parentWorkspaceId);
                        metadata.agentType ?? (metadata.agentType = workspace.agentType);
                        metadata.taskStatus ?? (metadata.taskStatus = workspace.taskStatus);
                        metadata.reportedAt ?? (metadata.reportedAt = workspace.reportedAt);
                        metadata.taskModelString ?? (metadata.taskModelString = workspace.taskModelString);
                        metadata.taskThinkingLevel ?? (metadata.taskThinkingLevel = workspace.taskThinkingLevel);
                        metadata.taskPrompt ?? (metadata.taskPrompt = workspace.taskPrompt);
                        metadata.taskTrunkBranch ?? (metadata.taskTrunkBranch = workspace.taskTrunkBranch);
                        // Preserve archived timestamps from config
                        metadata.archivedAt ?? (metadata.archivedAt = workspace.archivedAt);
                        metadata.unarchivedAt ?? (metadata.unarchivedAt = workspace.unarchivedAt);
                        // Preserve section assignment from config
                        metadata.sectionId ?? (metadata.sectionId = workspace.sectionId);
                        if (!workspace.aiSettingsByAgent && metadata.aiSettingsByAgent) {
                            workspace.aiSettingsByAgent = metadata.aiSettingsByAgent;
                            configModified = true;
                        }
                        // Migrate to config for next load
                        workspace.id = metadata.id;
                        workspace.name = metadata.name;
                        workspace.createdAt = metadata.createdAt;
                        workspace.runtimeConfig = metadata.runtimeConfig;
                        configModified = true;
                        workspaceMetadata.push(this.addPathsToMetadata(metadata, workspace.path, projectPath));
                        metadataFound = true;
                    }
                    // No metadata found anywhere - create basic metadata
                    if (!metadataFound) {
                        const legacyId = this.generateLegacyId(projectPath, workspace.path);
                        const metadata = {
                            id: legacyId,
                            name: workspaceBasename,
                            projectName,
                            projectPath,
                            // GUARANTEE: All workspaces must have createdAt
                            createdAt: new Date().toISOString(),
                            // GUARANTEE: All workspaces must have runtimeConfig
                            runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
                            aiSettings: workspace.aiSettings,
                            aiSettingsByAgent: workspace.aiSettingsByAgent ??
                                (workspace.aiSettings
                                    ? {
                                        plan: workspace.aiSettings,
                                        exec: workspace.aiSettings,
                                    }
                                    : undefined),
                            parentWorkspaceId: workspace.parentWorkspaceId,
                            agentType: workspace.agentType,
                            taskStatus: workspace.taskStatus,
                            reportedAt: workspace.reportedAt,
                            taskModelString: workspace.taskModelString,
                            taskThinkingLevel: workspace.taskThinkingLevel,
                            taskPrompt: workspace.taskPrompt,
                            taskTrunkBranch: workspace.taskTrunkBranch,
                            archivedAt: workspace.archivedAt,
                            unarchivedAt: workspace.unarchivedAt,
                            sectionId: workspace.sectionId,
                        };
                        // Save to config for next load
                        workspace.id = metadata.id;
                        workspace.name = metadata.name;
                        workspace.createdAt = metadata.createdAt;
                        workspace.runtimeConfig = metadata.runtimeConfig;
                        configModified = true;
                        workspaceMetadata.push(this.addPathsToMetadata(metadata, workspace.path, projectPath));
                    }
                }
                catch (error) {
                    log_1.log.error(`Failed to load/migrate workspace metadata:`, error);
                    // Fallback to basic metadata if migration fails
                    const legacyId = this.generateLegacyId(projectPath, workspace.path);
                    const metadata = {
                        id: legacyId,
                        name: workspaceBasename,
                        projectName,
                        projectPath,
                        // GUARANTEE: All workspaces must have createdAt (even in error cases)
                        createdAt: new Date().toISOString(),
                        // GUARANTEE: All workspaces must have runtimeConfig (even in error cases)
                        runtimeConfig: workspace_1.DEFAULT_RUNTIME_CONFIG,
                        aiSettings: workspace.aiSettings,
                        aiSettingsByAgent: workspace.aiSettingsByAgent ??
                            (workspace.aiSettings
                                ? {
                                    plan: workspace.aiSettings,
                                    exec: workspace.aiSettings,
                                }
                                : undefined),
                        parentWorkspaceId: workspace.parentWorkspaceId,
                        agentType: workspace.agentType,
                        taskStatus: workspace.taskStatus,
                        reportedAt: workspace.reportedAt,
                        taskModelString: workspace.taskModelString,
                        taskThinkingLevel: workspace.taskThinkingLevel,
                        taskPrompt: workspace.taskPrompt,
                        taskTrunkBranch: workspace.taskTrunkBranch,
                        sectionId: workspace.sectionId,
                    };
                    workspaceMetadata.push(this.addPathsToMetadata(metadata, workspace.path, projectPath));
                }
            }
        }
        // Save config if we migrated any workspaces
        if (configModified) {
            await this.saveConfig(config);
        }
        return workspaceMetadata;
    }
    /**
     * Add a workspace to config.json (single source of truth for workspace metadata).
     * Creates project entry if it doesn't exist.
     *
     * @param projectPath Absolute path to the project
     * @param metadata Workspace metadata to save
     */
    async addWorkspace(projectPath, metadata) {
        await this.editConfig((config) => {
            let project = config.projects.get(projectPath);
            if (!project) {
                project = { workspaces: [] };
                config.projects.set(projectPath, project);
            }
            // Check if workspace already exists (by ID)
            const existingIndex = project.workspaces.findIndex((w) => w.id === metadata.id);
            // Use provided namedWorkspacePath if available (runtime-aware),
            // otherwise fall back to worktree-style path for legacy compatibility
            const projectName = this.getProjectName(projectPath);
            const workspacePath = metadata.namedWorkspacePath ?? path.join(this.srcDir, projectName, metadata.name);
            const workspaceEntry = {
                path: workspacePath,
                id: metadata.id,
                name: metadata.name,
                createdAt: metadata.createdAt,
                runtimeConfig: metadata.runtimeConfig,
            };
            if (existingIndex >= 0) {
                // Update existing workspace
                project.workspaces[existingIndex] = workspaceEntry;
            }
            else {
                // Add new workspace
                project.workspaces.push(workspaceEntry);
            }
            return config;
        });
    }
    /**
     * Remove a workspace from config.json
     *
     * @param workspaceId ID of the workspace to remove
     */
    async removeWorkspace(workspaceId) {
        await this.editConfig((config) => {
            let workspaceFound = false;
            for (const [_projectPath, project] of config.projects) {
                const index = project.workspaces.findIndex((w) => w.id === workspaceId);
                if (index !== -1) {
                    project.workspaces.splice(index, 1);
                    workspaceFound = true;
                    // We don't break here in case duplicates exist (though they shouldn't)
                }
            }
            if (!workspaceFound) {
                log_1.log.warn(`Workspace ${workspaceId} not found in config during removal`);
            }
            return config;
        });
    }
    /**
     * Update workspace metadata fields (e.g., regenerate missing title/branch)
     * Used to fix incomplete metadata after errors or restarts
     */
    async updateWorkspaceMetadata(workspaceId, updates) {
        await this.editConfig((config) => {
            for (const [_projectPath, projectConfig] of config.projects) {
                const workspace = projectConfig.workspaces.find((w) => w.id === workspaceId);
                if (workspace) {
                    if (updates.name !== undefined)
                        workspace.name = updates.name;
                    if (updates.runtimeConfig !== undefined)
                        workspace.runtimeConfig = updates.runtimeConfig;
                    return config;
                }
            }
            throw new Error(`Workspace ${workspaceId} not found in config`);
        });
    }
    /**
     * Load providers configuration from JSONC file
     * Supports comments in JSONC format
     */
    loadProvidersConfig() {
        try {
            if (fs.existsSync(this.providersFile)) {
                const data = fs.readFileSync(this.providersFile, "utf-8");
                return jsonc.parse(data);
            }
        }
        catch (error) {
            log_1.log.error("Error loading providers config:", error);
        }
        return null;
    }
    /**
     * Save providers configuration to JSONC file
     * @param config The providers configuration to save
     */
    saveProvidersConfig(config) {
        try {
            if (!fs.existsSync(this.rootDir)) {
                fs.mkdirSync(this.rootDir, { recursive: true });
            }
            // Format with 2-space indentation for readability
            const jsonString = JSON.stringify(config, null, 2);
            // Add a comment header to the file
            const contentWithComments = `// Providers configuration for unix
// Configure your AI providers here
// Example:
// {
//   "anthropic": {
//     "apiKey": "sk-ant-..."
//   },
//   "openai": {
//     "apiKey": "sk-..."
//   },
//   "xai": {
//     "apiKey": "sk-xai-..."
//   },
//   "ollama": {
//     "baseUrl": "http://localhost:11434/api"  // Optional - only needed for remote/custom URL
//   }
// }
${jsonString}`;
            fs.writeFileSync(this.providersFile, contentWithComments);
        }
        catch (error) {
            log_1.log.error("Error saving providers config:", error);
            throw error; // Re-throw to let caller handle
        }
    }
    /**
     * Load secrets configuration from JSON file
     * Returns empty config if file doesn't exist
     */
    loadSecretsConfig() {
        try {
            if (fs.existsSync(this.secretsFile)) {
                const data = fs.readFileSync(this.secretsFile, "utf-8");
                return JSON.parse(data);
            }
        }
        catch (error) {
            log_1.log.error("Error loading secrets config:", error);
        }
        return {};
    }
    /**
     * Save secrets configuration to JSON file
     * @param config The secrets configuration to save
     */
    async saveSecretsConfig(config) {
        try {
            if (!fs.existsSync(this.rootDir)) {
                fs.mkdirSync(this.rootDir, { recursive: true });
            }
            await (0, write_file_atomic_1.default)(this.secretsFile, JSON.stringify(config, null, 2), "utf-8");
        }
        catch (error) {
            log_1.log.error("Error saving secrets config:", error);
            throw error;
        }
    }
    /**
     * Get secrets for a specific project
     * @param projectPath The path to the project
     * @returns Array of secrets for the project, or empty array if none
     */
    getProjectSecrets(projectPath) {
        const config = this.loadSecretsConfig();
        return config[projectPath] ?? [];
    }
    /**
     * Update secrets for a specific project
     * @param projectPath The path to the project
     * @param secrets The secrets to save for the project
     */
    async updateProjectSecrets(projectPath, secrets) {
        const config = this.loadSecretsConfig();
        config[projectPath] = secrets;
        await this.saveSecretsConfig(config);
    }
}
exports.Config = Config;
// Default instance for application use
exports.defaultConfig = new Config();
//# sourceMappingURL=config.js.map