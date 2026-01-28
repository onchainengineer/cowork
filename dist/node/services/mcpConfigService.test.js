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
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const mcpConfigService_1 = require("./mcpConfigService");
const mcpServerManager_1 = require("./mcpServerManager");
(0, bun_test_1.describe)("MCP server disable filtering", () => {
    let tempDir;
    let configService;
    let serverManager;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-test-"));
        configService = new mcpConfigService_1.MCPConfigService();
        serverManager = new mcpServerManager_1.MCPServerManager(configService);
    });
    (0, bun_test_1.afterEach)(async () => {
        serverManager.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("disabled servers are filtered from manager.listServers", async () => {
        // Add two servers
        await configService.addServer(tempDir, "enabled-server", {
            transport: "stdio",
            command: "cmd1",
        });
        await configService.addServer(tempDir, "disabled-server", {
            transport: "stdio",
            command: "cmd2",
        });
        // Disable one
        await configService.setServerEnabled(tempDir, "disabled-server", false);
        // Config service returns both (with disabled flag)
        const allServers = await configService.listServers(tempDir);
        (0, bun_test_1.expect)(allServers).toEqual({
            "enabled-server": { transport: "stdio", command: "cmd1", disabled: false },
            "disabled-server": { transport: "stdio", command: "cmd2", disabled: true },
        });
        // Server manager filters to enabled only
        const enabledServers = await serverManager.listServers(tempDir);
        (0, bun_test_1.expect)(enabledServers).toEqual({
            "enabled-server": { transport: "stdio", command: "cmd1", disabled: false },
        });
    });
});
(0, bun_test_1.describe)("Workspace MCP overrides filtering", () => {
    let tempDir;
    let configService;
    let serverManager;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-test-"));
        configService = new mcpConfigService_1.MCPConfigService();
        serverManager = new mcpServerManager_1.MCPServerManager(configService);
        // Set up multiple servers for testing
        await configService.addServer(tempDir, "server-a", { transport: "stdio", command: "cmd-a" });
        await configService.addServer(tempDir, "server-b", { transport: "stdio", command: "cmd-b" });
        await configService.addServer(tempDir, "server-c", { transport: "stdio", command: "cmd-c" });
    });
    (0, bun_test_1.afterEach)(async () => {
        serverManager.dispose();
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("listServers with no overrides returns all enabled servers", async () => {
        const servers = await serverManager.listServers(tempDir);
        (0, bun_test_1.expect)(servers).toEqual({
            "server-a": { transport: "stdio", command: "cmd-a", disabled: false },
            "server-b": { transport: "stdio", command: "cmd-b", disabled: false },
            "server-c": { transport: "stdio", command: "cmd-c", disabled: false },
        });
    });
    (0, bun_test_1.test)("listServers with empty overrides returns all enabled servers", async () => {
        const overrides = {};
        const servers = await serverManager.listServers(tempDir, overrides);
        (0, bun_test_1.expect)(servers).toEqual({
            "server-a": { transport: "stdio", command: "cmd-a", disabled: false },
            "server-b": { transport: "stdio", command: "cmd-b", disabled: false },
            "server-c": { transport: "stdio", command: "cmd-c", disabled: false },
        });
    });
    (0, bun_test_1.test)("listServers with disabledServers filters out disabled servers", async () => {
        const overrides = {
            disabledServers: ["server-a", "server-c"],
        };
        const servers = await serverManager.listServers(tempDir, overrides);
        (0, bun_test_1.expect)(servers).toEqual({
            "server-b": { transport: "stdio", command: "cmd-b", disabled: false },
        });
    });
    (0, bun_test_1.test)("listServers with disabledServers removes servers not in config (no error)", async () => {
        const overrides = {
            disabledServers: ["non-existent-server"],
        };
        const servers = await serverManager.listServers(tempDir, overrides);
        (0, bun_test_1.expect)(servers).toEqual({
            "server-a": { transport: "stdio", command: "cmd-a", disabled: false },
            "server-b": { transport: "stdio", command: "cmd-b", disabled: false },
            "server-c": { transport: "stdio", command: "cmd-c", disabled: false },
        });
    });
    (0, bun_test_1.test)("enabledServers overrides project-level disabled", async () => {
        // Disable server-a at project level
        await configService.setServerEnabled(tempDir, "server-a", false);
        // Without override, server-a should be disabled
        const serversWithoutOverride = await serverManager.listServers(tempDir);
        (0, bun_test_1.expect)(serversWithoutOverride).toEqual({
            "server-b": { transport: "stdio", command: "cmd-b", disabled: false },
            "server-c": { transport: "stdio", command: "cmd-c", disabled: false },
        });
        // With enabledServers override, server-a should be re-enabled
        const overrides = {
            enabledServers: ["server-a"],
        };
        const serversWithOverride = await serverManager.listServers(tempDir, overrides);
        (0, bun_test_1.expect)(serversWithOverride).toEqual({
            "server-a": { transport: "stdio", command: "cmd-a", disabled: false },
            "server-b": { transport: "stdio", command: "cmd-b", disabled: false },
            "server-c": { transport: "stdio", command: "cmd-c", disabled: false },
        });
    });
    (0, bun_test_1.test)("project-disabled and workspace-disabled work together", async () => {
        // Disable server-a at project level
        await configService.setServerEnabled(tempDir, "server-a", false);
        // Disable server-b at workspace level
        const overrides = {
            disabledServers: ["server-b"],
        };
        const servers = await serverManager.listServers(tempDir, overrides);
        // Only server-c should remain
        (0, bun_test_1.expect)(servers).toEqual({
            "server-c": { transport: "stdio", command: "cmd-c", disabled: false },
        });
    });
});
//# sourceMappingURL=mcpConfigService.test.js.map