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
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const config_1 = require("../../node/config");
const runtimeFactory_1 = require("../../node/runtime/runtimeFactory");
const helpers_1 = require("../../node/utils/runtime/helpers");
const workspaceMcpOverridesService_1 = require("./workspaceMcpOverridesService");
function getWorkspacePath(args) {
    return path.join(args.srcDir, args.projectName, args.workspaceName);
}
async function pathExists(filePath) {
    try {
        await fs.stat(filePath);
        return true;
    }
    catch {
        return false;
    }
}
(0, bun_test_1.describe)("WorkspaceMcpOverridesService", () => {
    let tempDir;
    let config;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-mcp-overrides-test-"));
        config = new config_1.Config(tempDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("returns empty overrides when no file and no legacy config", async () => {
        const projectPath = "/fake/project";
        const workspaceId = "ws-id";
        const workspaceName = "branch";
        const workspacePath = getWorkspacePath({
            srcDir: config.srcDir,
            projectName: "project",
            workspaceName,
        });
        await fs.mkdir(workspacePath, { recursive: true });
        await config.editConfig((cfg) => {
            cfg.projects.set(projectPath, {
                workspaces: [
                    {
                        path: workspacePath,
                        id: workspaceId,
                        name: workspaceName,
                        runtimeConfig: { type: "worktree", srcBaseDir: config.srcDir },
                    },
                ],
            });
            return cfg;
        });
        const service = new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        const overrides = await service.getOverridesForWorkspace(workspaceId);
        (0, bun_test_1.expect)(overrides).toEqual({});
        (0, bun_test_1.expect)(await pathExists(path.join(workspacePath, ".unix", "mcp.local.jsonc"))).toBe(false);
    });
    (0, bun_test_1.it)("adds .unix/mcp.local.jsonc to git exclude when writing overrides", async () => {
        const projectPath = "/fake/project";
        const workspaceId = "ws-id";
        const workspaceName = "branch";
        const workspacePath = getWorkspacePath({
            srcDir: config.srcDir,
            projectName: "project",
            workspaceName,
        });
        await fs.mkdir(workspacePath, { recursive: true });
        const runtime = (0, runtimeFactory_1.createRuntime)({ type: "local" }, { projectPath: workspacePath });
        const gitInitResult = await (0, helpers_1.execBuffered)(runtime, "git init", {
            cwd: workspacePath,
            timeout: 10,
        });
        (0, bun_test_1.expect)(gitInitResult.exitCode).toBe(0);
        await config.editConfig((cfg) => {
            cfg.projects.set(projectPath, {
                workspaces: [
                    {
                        path: workspacePath,
                        id: workspaceId,
                        name: workspaceName,
                        runtimeConfig: { type: "worktree", srcBaseDir: config.srcDir },
                    },
                ],
            });
            return cfg;
        });
        const service = new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        const excludePathResult = await (0, helpers_1.execBuffered)(runtime, "git rev-parse --git-path info/exclude", {
            cwd: workspacePath,
            timeout: 10,
        });
        (0, bun_test_1.expect)(excludePathResult.exitCode).toBe(0);
        const excludePathRaw = excludePathResult.stdout.trim();
        (0, bun_test_1.expect)(excludePathRaw.length).toBeGreaterThan(0);
        const excludePath = path.isAbsolute(excludePathRaw)
            ? excludePathRaw
            : path.join(workspacePath, excludePathRaw);
        const before = (await pathExists(excludePath)) ? await fs.readFile(excludePath, "utf-8") : "";
        (0, bun_test_1.expect)(before).not.toContain(".unix/mcp.local.jsonc");
        await service.setOverridesForWorkspace(workspaceId, {
            disabledServers: ["server-a"],
        });
        const after = await fs.readFile(excludePath, "utf-8");
        (0, bun_test_1.expect)(after).toContain(".unix/mcp.local.jsonc");
    });
    (0, bun_test_1.it)("persists overrides to .unix/mcp.local.jsonc and reads them back", async () => {
        const projectPath = "/fake/project";
        const workspaceId = "ws-id";
        const workspaceName = "branch";
        const workspacePath = getWorkspacePath({
            srcDir: config.srcDir,
            projectName: "project",
            workspaceName,
        });
        await fs.mkdir(workspacePath, { recursive: true });
        await config.editConfig((cfg) => {
            cfg.projects.set(projectPath, {
                workspaces: [
                    {
                        path: workspacePath,
                        id: workspaceId,
                        name: workspaceName,
                        runtimeConfig: { type: "worktree", srcBaseDir: config.srcDir },
                    },
                ],
            });
            return cfg;
        });
        const service = new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        await service.setOverridesForWorkspace(workspaceId, {
            disabledServers: ["server-a", "server-a"],
            toolAllowlist: { "server-b": ["tool1", "tool1", ""] },
        });
        const filePath = path.join(workspacePath, ".unix", "mcp.local.jsonc");
        (0, bun_test_1.expect)(await pathExists(filePath)).toBe(true);
        const roundTrip = await service.getOverridesForWorkspace(workspaceId);
        (0, bun_test_1.expect)(roundTrip).toEqual({
            disabledServers: ["server-a"],
            toolAllowlist: { "server-b": ["tool1"] },
        });
    });
    (0, bun_test_1.it)("removes workspace-local file when overrides are set to empty", async () => {
        const projectPath = "/fake/project";
        const workspaceId = "ws-id";
        const workspaceName = "branch";
        const workspacePath = getWorkspacePath({
            srcDir: config.srcDir,
            projectName: "project",
            workspaceName,
        });
        await fs.mkdir(workspacePath, { recursive: true });
        await config.editConfig((cfg) => {
            cfg.projects.set(projectPath, {
                workspaces: [
                    {
                        path: workspacePath,
                        id: workspaceId,
                        name: workspaceName,
                        runtimeConfig: { type: "worktree", srcBaseDir: config.srcDir },
                    },
                ],
            });
            return cfg;
        });
        const service = new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        await service.setOverridesForWorkspace(workspaceId, {
            disabledServers: ["server-a"],
        });
        const filePath = path.join(workspacePath, ".unix", "mcp.local.jsonc");
        (0, bun_test_1.expect)(await pathExists(filePath)).toBe(true);
        await service.setOverridesForWorkspace(workspaceId, {});
        (0, bun_test_1.expect)(await pathExists(filePath)).toBe(false);
    });
    (0, bun_test_1.it)("migrates legacy config.json overrides into workspace-local file", async () => {
        const projectPath = "/fake/project";
        const workspaceId = "ws-id";
        const workspaceName = "branch";
        const workspacePath = getWorkspacePath({
            srcDir: config.srcDir,
            projectName: "project",
            workspaceName,
        });
        await fs.mkdir(workspacePath, { recursive: true });
        await config.editConfig((cfg) => {
            cfg.projects.set(projectPath, {
                workspaces: [
                    {
                        path: workspacePath,
                        id: workspaceId,
                        name: workspaceName,
                        runtimeConfig: { type: "worktree", srcBaseDir: config.srcDir },
                        mcp: {
                            disabledServers: ["server-a"],
                            toolAllowlist: { "server-b": ["tool1"] },
                        },
                    },
                ],
            });
            return cfg;
        });
        const service = new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        const overrides = await service.getOverridesForWorkspace(workspaceId);
        (0, bun_test_1.expect)(overrides).toEqual({
            disabledServers: ["server-a"],
            toolAllowlist: { "server-b": ["tool1"] },
        });
        // File written
        const filePath = path.join(workspacePath, ".unix", "mcp.local.jsonc");
        (0, bun_test_1.expect)(await pathExists(filePath)).toBe(true);
        // Legacy config cleared
        const loaded = config.loadConfigOrDefault();
        const projectConfig = loaded.projects.get(projectPath);
        (0, bun_test_1.expect)(projectConfig).toBeDefined();
        (0, bun_test_1.expect)(projectConfig.workspaces[0].mcp).toBeUndefined();
    });
});
//# sourceMappingURL=workspaceMcpOverridesService.test.js.map