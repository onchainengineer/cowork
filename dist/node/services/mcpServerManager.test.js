"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const mcpServerManager_1 = require("./mcpServerManager");
(0, bun_test_1.describe)("MCPServerManager", () => {
    let configService;
    let manager;
    let access;
    (0, bun_test_1.beforeEach)(() => {
        configService = {
            listServers: (0, bun_test_1.mock)(() => Promise.resolve({})),
        };
        manager = new mcpServerManager_1.MCPServerManager(configService);
        access = manager;
    });
    (0, bun_test_1.afterEach)(() => {
        manager.dispose();
    });
    (0, bun_test_1.test)("cleanupIdleServers stops idle servers when workspace is not leased", () => {
        const workspaceId = "ws-idle";
        const close = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        const instance = {
            name: "server",
            resolvedTransport: "stdio",
            autoFallbackUsed: false,
            tools: {},
            isClosed: false,
            close,
        };
        const entry = {
            configSignature: "sig",
            instances: new Map([["server", instance]]),
            stats: {
                enabledServerCount: 1,
                startedServerCount: 1,
                failedServerCount: 0,
                autoFallbackCount: 0,
                hasStdio: true,
                hasHttp: false,
                hasSse: false,
                transportMode: "stdio_only",
            },
            lastActivity: Date.now() - 11 * 60_000,
        };
        access.workspaceServers.set(workspaceId, entry);
        access.cleanupIdleServers();
        (0, bun_test_1.expect)(access.workspaceServers.has(workspaceId)).toBe(false);
        (0, bun_test_1.expect)(close).toHaveBeenCalledTimes(1);
    });
    (0, bun_test_1.test)("cleanupIdleServers does not stop idle servers when workspace is leased", () => {
        const workspaceId = "ws-leased";
        const close = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        const instance = {
            name: "server",
            resolvedTransport: "stdio",
            autoFallbackUsed: false,
            tools: {},
            isClosed: false,
            close,
        };
        const entry = {
            configSignature: "sig",
            instances: new Map([["server", instance]]),
            stats: {
                enabledServerCount: 1,
                startedServerCount: 1,
                failedServerCount: 0,
                autoFallbackCount: 0,
                hasStdio: true,
                hasHttp: false,
                hasSse: false,
                transportMode: "stdio_only",
            },
            lastActivity: Date.now() - 11 * 60_000,
        };
        access.workspaceServers.set(workspaceId, entry);
        manager.acquireLease(workspaceId);
        // Ensure the workspace still looks idle even after acquireLease() updates activity.
        entry.lastActivity = Date.now() - 11 * 60_000;
        access.cleanupIdleServers();
        (0, bun_test_1.expect)(access.workspaceServers.has(workspaceId)).toBe(true);
        (0, bun_test_1.expect)(close).toHaveBeenCalledTimes(0);
    });
    (0, bun_test_1.test)("getToolsForWorkspace defers restarts while leased and applies them on next request", async () => {
        const workspaceId = "ws-defer";
        const projectPath = "/tmp/project";
        const workspacePath = "/tmp/workspace";
        let command = "cmd-1";
        configService.listServers = (0, bun_test_1.mock)(() => Promise.resolve({
            server: { transport: "stdio", command, disabled: false },
        }));
        const close = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        const dummyTool = {
            execute: (0, bun_test_1.mock)(() => Promise.resolve({ ok: true })),
        };
        const startServersMock = (0, bun_test_1.mock)(() => Promise.resolve(new Map([
            [
                "server",
                {
                    name: "server",
                    resolvedTransport: "stdio",
                    autoFallbackUsed: false,
                    tools: { tool: dummyTool },
                    isClosed: false,
                    close,
                },
            ],
        ])));
        access.startServers = startServersMock;
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        manager.acquireLease(workspaceId);
        // Change signature while leased.
        command = "cmd-2";
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        (0, bun_test_1.expect)(startServersMock).toHaveBeenCalledTimes(1);
        manager.releaseLease(workspaceId);
        // No automatic restart on lease release (avoids closing clients out from under a
        // subsequent stream that already captured the tool objects).
        (0, bun_test_1.expect)(access.workspaceServers.has(workspaceId)).toBe(true);
        (0, bun_test_1.expect)(close).toHaveBeenCalledTimes(0);
        // Next request (no lease) applies the pending restart.
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        (0, bun_test_1.expect)(startServersMock).toHaveBeenCalledTimes(2);
        (0, bun_test_1.expect)(close).toHaveBeenCalledTimes(1);
    });
    (0, bun_test_1.test)("getToolsForWorkspace restarts when cached instances are marked closed", async () => {
        const workspaceId = "ws-closed";
        const projectPath = "/tmp/project";
        const workspacePath = "/tmp/workspace";
        configService.listServers = (0, bun_test_1.mock)(() => Promise.resolve({
            server: { transport: "stdio", command: "cmd", disabled: false },
        }));
        const close1 = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        const close2 = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        let startCount = 0;
        const startServersMock = (0, bun_test_1.mock)(() => {
            startCount += 1;
            return Promise.resolve(new Map([
                [
                    "server",
                    {
                        name: "server",
                        resolvedTransport: "stdio",
                        autoFallbackUsed: false,
                        tools: {},
                        isClosed: false,
                        close: startCount === 1 ? close1 : close2,
                    },
                ],
            ]));
        });
        access.startServers = startServersMock;
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        // Simulate an active stream lease.
        manager.acquireLease(workspaceId);
        const cached = access.workspaceServers.get(workspaceId);
        const instance = cached.instances.get("server");
        (0, bun_test_1.expect)(instance).toBeTruthy();
        if (instance) {
            instance.isClosed = true;
        }
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        (0, bun_test_1.expect)(startServersMock).toHaveBeenCalledTimes(2);
        (0, bun_test_1.expect)(close1).toHaveBeenCalledTimes(1);
    });
    (0, bun_test_1.test)("getToolsForWorkspace does not close healthy instances when restarting closed ones while leased", async () => {
        const workspaceId = "ws-closed-partial";
        const projectPath = "/tmp/project";
        const workspacePath = "/tmp/workspace";
        configService.listServers = (0, bun_test_1.mock)(() => Promise.resolve({
            serverA: { transport: "stdio", command: "cmd-a", disabled: false },
            serverB: { transport: "stdio", command: "cmd-b", disabled: false },
        }));
        const closeA1 = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        const closeA2 = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        const closeB1 = (0, bun_test_1.mock)(() => Promise.resolve(undefined));
        let startCount = 0;
        const startServersMock = (0, bun_test_1.mock)(() => {
            startCount += 1;
            if (startCount === 1) {
                return Promise.resolve(new Map([
                    [
                        "serverA",
                        {
                            name: "serverA",
                            resolvedTransport: "stdio",
                            autoFallbackUsed: false,
                            tools: {},
                            isClosed: false,
                            close: closeA1,
                        },
                    ],
                    [
                        "serverB",
                        {
                            name: "serverB",
                            resolvedTransport: "stdio",
                            autoFallbackUsed: false,
                            tools: {},
                            isClosed: false,
                            close: closeB1,
                        },
                    ],
                ]));
            }
            return Promise.resolve(new Map([
                [
                    "serverA",
                    {
                        name: "serverA",
                        resolvedTransport: "stdio",
                        autoFallbackUsed: false,
                        tools: {},
                        isClosed: false,
                        close: closeA2,
                    },
                ],
            ]));
        });
        access.startServers = startServersMock;
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        // Simulate an active stream lease.
        manager.acquireLease(workspaceId);
        const cached = access.workspaceServers.get(workspaceId);
        const instanceA = cached.instances.get("serverA");
        (0, bun_test_1.expect)(instanceA).toBeTruthy();
        if (instanceA) {
            instanceA.isClosed = true;
        }
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        // Restart should only close the dead instance.
        (0, bun_test_1.expect)(closeA1).toHaveBeenCalledTimes(1);
        (0, bun_test_1.expect)(closeB1).toHaveBeenCalledTimes(0);
    });
    (0, bun_test_1.test)("getToolsForWorkspace does not return tools from newly-disabled servers while leased", async () => {
        const workspaceId = "ws-disable-while-leased";
        const projectPath = "/tmp/project";
        const workspacePath = "/tmp/workspace";
        configService.listServers = (0, bun_test_1.mock)(() => Promise.resolve({
            serverA: { transport: "stdio", command: "cmd-a", disabled: false },
            serverB: { transport: "stdio", command: "cmd-b", disabled: false },
        }));
        const dummyToolA = { execute: (0, bun_test_1.mock)(() => Promise.resolve({ ok: true })) };
        const dummyToolB = { execute: (0, bun_test_1.mock)(() => Promise.resolve({ ok: true })) };
        const startServersMock = (0, bun_test_1.mock)(() => Promise.resolve(new Map([
            [
                "serverA",
                {
                    name: "serverA",
                    resolvedTransport: "stdio",
                    autoFallbackUsed: false,
                    tools: { tool: dummyToolA },
                    isClosed: false,
                    close: (0, bun_test_1.mock)(() => Promise.resolve(undefined)),
                },
            ],
            [
                "serverB",
                {
                    name: "serverB",
                    resolvedTransport: "stdio",
                    autoFallbackUsed: false,
                    tools: { tool: dummyToolB },
                    isClosed: false,
                    close: (0, bun_test_1.mock)(() => Promise.resolve(undefined)),
                },
            ],
        ])));
        access.startServers = startServersMock;
        await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
        });
        manager.acquireLease(workspaceId);
        const toolsResult = await manager.getToolsForWorkspace({
            workspaceId,
            projectPath,
            runtime: {},
            workspacePath,
            overrides: {
                disabledServers: ["serverB"],
            },
        });
        // Tool names are normalized to provider-safe keys (lowercase + underscore-delimited).
        (0, bun_test_1.expect)(Object.keys(toolsResult.tools)).toContain("servera_tool");
        (0, bun_test_1.expect)(Object.keys(toolsResult.tools)).not.toContain("serverb_tool");
    });
});
//# sourceMappingURL=mcpServerManager.test.js.map