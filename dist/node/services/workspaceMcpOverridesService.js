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
exports.WorkspaceMcpOverridesService = void 0;
const path = __importStar(require("path"));
const jsonc = __importStar(require("jsonc-parser"));
const assert_1 = __importDefault(require("../../common/utils/assert"));
const runtimeHelpers_1 = require("../../node/runtime/runtimeHelpers");
const helpers_1 = require("../../node/utils/runtime/helpers");
const log_1 = require("../../node/services/log");
const MCP_OVERRIDES_DIR = ".unix";
const MCP_OVERRIDES_JSONC = "mcp.local.jsonc";
const MCP_OVERRIDES_JSON = "mcp.local.json";
const MCP_OVERRIDES_GITIGNORE_PATTERNS = [
    `${MCP_OVERRIDES_DIR}/${MCP_OVERRIDES_JSONC}`,
    `${MCP_OVERRIDES_DIR}/${MCP_OVERRIDES_JSON}`,
];
function joinForRuntime(runtimeConfig, ...parts) {
    (0, assert_1.default)(parts.length > 0, "joinForRuntime requires at least one path segment");
    // Remote runtimes run inside a POSIX shell (SSH host, Docker container), even if the user is
    // running unix on Windows. Use POSIX joins so we don't accidentally introduce backslashes.
    const usePosix = runtimeConfig?.type === "ssh" || runtimeConfig?.type === "docker";
    return usePosix ? path.posix.join(...parts) : path.join(...parts);
}
function isAbsoluteForRuntime(runtimeConfig, filePath) {
    const usePosix = runtimeConfig?.type === "ssh" || runtimeConfig?.type === "docker";
    return usePosix ? path.posix.isAbsolute(filePath) : path.isAbsolute(filePath);
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((v) => typeof v === "string");
}
function normalizeWorkspaceMcpOverrides(raw) {
    if (!raw || typeof raw !== "object") {
        return {};
    }
    const obj = raw;
    const disabledServers = isStringArray(obj.disabledServers)
        ? [...new Set(obj.disabledServers.map((s) => s.trim()).filter(Boolean))]
        : undefined;
    const enabledServers = isStringArray(obj.enabledServers)
        ? [...new Set(obj.enabledServers.map((s) => s.trim()).filter(Boolean))]
        : undefined;
    let toolAllowlist;
    if (obj.toolAllowlist &&
        typeof obj.toolAllowlist === "object" &&
        !Array.isArray(obj.toolAllowlist)) {
        const next = {};
        for (const [serverName, value] of Object.entries(obj.toolAllowlist)) {
            if (!serverName || typeof serverName !== "string")
                continue;
            if (!isStringArray(value))
                continue;
            // Empty array is meaningful ("expose no tools"), so keep it.
            next[serverName] = [...new Set(value.map((t) => t.trim()).filter((t) => t.length > 0))];
        }
        if (Object.keys(next).length > 0) {
            toolAllowlist = next;
        }
    }
    const normalized = {
        disabledServers: disabledServers && disabledServers.length > 0 ? disabledServers : undefined,
        enabledServers: enabledServers && enabledServers.length > 0 ? enabledServers : undefined,
        toolAllowlist,
    };
    // Drop empty object to keep persistence clean.
    if (!normalized.disabledServers && !normalized.enabledServers && !normalized.toolAllowlist) {
        return {};
    }
    return normalized;
}
function isEmptyOverrides(overrides) {
    return ((!overrides.disabledServers || overrides.disabledServers.length === 0) &&
        (!overrides.enabledServers || overrides.enabledServers.length === 0) &&
        (!overrides.toolAllowlist || Object.keys(overrides.toolAllowlist).length === 0));
}
async function statIsFile(runtime, filePath) {
    try {
        const stat = await runtime.stat(filePath);
        return !stat.isDirectory;
    }
    catch {
        return false;
    }
}
class WorkspaceMcpOverridesService {
    config;
    constructor(config) {
        this.config = config;
        (0, assert_1.default)(config, "WorkspaceMcpOverridesService requires a Config instance");
    }
    async getWorkspaceMetadata(workspaceId) {
        (0, assert_1.default)(typeof workspaceId === "string", "workspaceId must be a string");
        const trimmed = workspaceId.trim();
        (0, assert_1.default)(trimmed.length > 0, "workspaceId must not be empty");
        const all = await this.config.getAllWorkspaceMetadata();
        const metadata = all.find((m) => m.id === trimmed);
        if (!metadata) {
            throw new Error(`Workspace metadata not found for ${trimmed}`);
        }
        return metadata;
    }
    getLegacyOverridesFromConfig(workspaceId) {
        const config = this.config.loadConfigOrDefault();
        for (const [_projectPath, projectConfig] of config.projects) {
            const workspace = projectConfig.workspaces.find((w) => w.id === workspaceId);
            if (workspace) {
                // NOTE: Legacy storage (PR #1180) wrote overrides into ~/.unix/config.json.
                // We keep reading it here only to migrate into the workspace-local file.
                return workspace.mcp;
            }
        }
        return undefined;
    }
    async clearLegacyOverridesInConfig(workspaceId) {
        await this.config.editConfig((config) => {
            for (const [_projectPath, projectConfig] of config.projects) {
                const workspace = projectConfig.workspaces.find((w) => w.id === workspaceId);
                if (workspace) {
                    delete workspace.mcp;
                    return config;
                }
            }
            return config;
        });
    }
    async getRuntimeAndWorkspacePath(workspaceId) {
        const metadata = await this.getWorkspaceMetadata(workspaceId);
        const runtime = (0, runtimeHelpers_1.createRuntimeForWorkspace)(metadata);
        // In-place workspaces (CLI/benchmarks) store the workspace path directly by setting
        // metadata.projectPath === metadata.name.
        const isInPlace = metadata.projectPath === metadata.name;
        const workspacePath = isInPlace
            ? metadata.projectPath
            : runtime.getWorkspacePath(metadata.projectPath, metadata.name);
        (0, assert_1.default)(typeof workspacePath === "string" && workspacePath.length > 0, "workspacePath is required");
        return { metadata, runtime, workspacePath };
    }
    getOverridesFilePaths(workspacePath, runtimeConfig) {
        (0, assert_1.default)(typeof workspacePath === "string", "workspacePath must be a string");
        return {
            jsoncPath: joinForRuntime(runtimeConfig, workspacePath, MCP_OVERRIDES_DIR, MCP_OVERRIDES_JSONC),
            jsonPath: joinForRuntime(runtimeConfig, workspacePath, MCP_OVERRIDES_DIR, MCP_OVERRIDES_JSON),
        };
    }
    async readOverridesFile(runtime, filePath) {
        try {
            const raw = await (0, helpers_1.readFileString)(runtime, filePath);
            const errors = [];
            const parsed = jsonc.parse(raw, errors);
            if (errors.length > 0) {
                log_1.log.warn("[MCP] Failed to parse workspace MCP overrides (JSONC parse errors)", {
                    filePath,
                    errorCount: errors.length,
                });
                return {};
            }
            return parsed;
        }
        catch (error) {
            // Treat any read failure as "no overrides".
            log_1.log.debug("[MCP] Failed to read workspace MCP overrides file", { filePath, error });
            return {};
        }
    }
    async ensureOverridesDir(runtime, workspacePath, runtimeConfig) {
        const overridesDirPath = joinForRuntime(runtimeConfig, workspacePath, MCP_OVERRIDES_DIR);
        try {
            await runtime.ensureDir(overridesDirPath);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to create ${MCP_OVERRIDES_DIR} directory: ${msg}`);
        }
    }
    async ensureOverridesGitignored(runtime, workspacePath, runtimeConfig) {
        try {
            const isInsideGitResult = await (0, helpers_1.execBuffered)(runtime, "git rev-parse --is-inside-work-tree", {
                cwd: workspacePath,
                timeout: 10,
            });
            if (isInsideGitResult.exitCode !== 0 || isInsideGitResult.stdout.trim() !== "true") {
                return;
            }
            const excludePathResult = await (0, helpers_1.execBuffered)(runtime, "git rev-parse --git-path info/exclude", {
                cwd: workspacePath,
                timeout: 10,
            });
            if (excludePathResult.exitCode !== 0) {
                return;
            }
            const excludeFilePathRaw = excludePathResult.stdout.trim();
            if (excludeFilePathRaw.length === 0) {
                return;
            }
            const excludeFilePath = isAbsoluteForRuntime(runtimeConfig, excludeFilePathRaw)
                ? excludeFilePathRaw
                : joinForRuntime(runtimeConfig, workspacePath, excludeFilePathRaw);
            let existing = "";
            try {
                existing = await (0, helpers_1.readFileString)(runtime, excludeFilePath);
            }
            catch {
                // Missing exclude file is OK.
            }
            const existingPatterns = new Set(existing
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0));
            const missingPatterns = MCP_OVERRIDES_GITIGNORE_PATTERNS.filter((pattern) => !existingPatterns.has(pattern));
            if (missingPatterns.length === 0) {
                return;
            }
            const needsNewline = existing.length > 0 && !existing.endsWith("\n");
            const updated = existing + (needsNewline ? "\n" : "") + missingPatterns.join("\n") + "\n";
            await (0, helpers_1.writeFileString)(runtime, excludeFilePath, updated);
        }
        catch (error) {
            // Best-effort only; never fail a workspace operation because git ignore couldn't be updated.
            log_1.log.debug("[MCP] Failed to add workspace MCP overrides file to git exclude", {
                workspacePath,
                error,
            });
        }
    }
    async removeOverridesFile(runtime, workspacePath) {
        // Best-effort: remove both file names so we never leave conflicting sources behind.
        await (0, helpers_1.execBuffered)(runtime, `rm -f "${MCP_OVERRIDES_DIR}/${MCP_OVERRIDES_JSONC}" "${MCP_OVERRIDES_DIR}/${MCP_OVERRIDES_JSON}"`, {
            cwd: workspacePath,
            timeout: 10,
        });
    }
    /**
     * Read workspace MCP overrides from <workspace>/.unix/mcp.local.jsonc.
     *
     * If the file doesn't exist, we fall back to legacy overrides stored in ~/.unix/config.json
     * and migrate them into the workspace-local file.
     */
    async getOverridesForWorkspace(workspaceId) {
        const { metadata, runtime, workspacePath } = await this.getRuntimeAndWorkspacePath(workspaceId);
        const { jsoncPath, jsonPath } = this.getOverridesFilePaths(workspacePath, metadata.runtimeConfig);
        // Prefer JSONC, then JSON.
        const jsoncExists = await statIsFile(runtime, jsoncPath);
        if (jsoncExists) {
            const parsed = await this.readOverridesFile(runtime, jsoncPath);
            return normalizeWorkspaceMcpOverrides(parsed);
        }
        const jsonExists = await statIsFile(runtime, jsonPath);
        if (jsonExists) {
            const parsed = await this.readOverridesFile(runtime, jsonPath);
            return normalizeWorkspaceMcpOverrides(parsed);
        }
        // No workspace-local file => try migrating legacy config.json storage.
        const legacy = this.getLegacyOverridesFromConfig(workspaceId);
        if (!legacy || isEmptyOverrides(legacy)) {
            return {};
        }
        const normalizedLegacy = normalizeWorkspaceMcpOverrides(legacy);
        if (isEmptyOverrides(normalizedLegacy)) {
            return {};
        }
        try {
            await this.ensureOverridesDir(runtime, workspacePath, metadata.runtimeConfig);
            await (0, helpers_1.writeFileString)(runtime, jsoncPath, JSON.stringify(normalizedLegacy, null, 2) + "\n");
            await this.ensureOverridesGitignored(runtime, workspacePath, metadata.runtimeConfig);
            await this.clearLegacyOverridesInConfig(workspaceId);
            log_1.log.info("[MCP] Migrated workspace MCP overrides from config.json", {
                workspaceId,
                filePath: jsoncPath,
            });
        }
        catch (error) {
            // Migration is best-effort; if it fails, still honor legacy overrides.
            log_1.log.warn("[MCP] Failed to migrate workspace MCP overrides; using legacy config.json values", {
                workspaceId,
                error,
            });
        }
        return normalizedLegacy;
    }
    /**
     * Persist workspace MCP overrides to <workspace>/.unix/mcp.local.jsonc.
     *
     * Empty overrides remove the workspace-local file.
     */
    async setOverridesForWorkspace(workspaceId, overrides) {
        (0, assert_1.default)(overrides && typeof overrides === "object", "overrides must be an object");
        const { metadata, runtime, workspacePath } = await this.getRuntimeAndWorkspacePath(workspaceId);
        const { jsoncPath } = this.getOverridesFilePaths(workspacePath, metadata.runtimeConfig);
        const normalized = normalizeWorkspaceMcpOverrides(overrides);
        // Always clear any legacy storage so we converge on the workspace-local file.
        await this.clearLegacyOverridesInConfig(workspaceId);
        if (isEmptyOverrides(normalized)) {
            await this.removeOverridesFile(runtime, workspacePath);
            return;
        }
        await this.ensureOverridesDir(runtime, workspacePath, metadata.runtimeConfig);
        await (0, helpers_1.writeFileString)(runtime, jsoncPath, JSON.stringify(normalized, null, 2) + "\n");
        await this.ensureOverridesGitignored(runtime, workspacePath, metadata.runtimeConfig);
    }
}
exports.WorkspaceMcpOverridesService = WorkspaceMcpOverridesService;
//# sourceMappingURL=workspaceMcpOverridesService.js.map