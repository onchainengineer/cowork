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
const net = __importStar(require("net"));
const serverService_1 = require("./serverService");
const config_1 = require("../../node/config");
const serverLockfile_1 = require("./serverLockfile");
(0, bun_test_1.describe)("ServerService", () => {
    (0, bun_test_1.test)("initializes with null path", async () => {
        const service = new serverService_1.ServerService();
        (0, bun_test_1.expect)(await service.getLaunchProject()).toBeNull();
    });
    (0, bun_test_1.test)("sets and gets project path", async () => {
        const service = new serverService_1.ServerService();
        service.setLaunchProject("/test/path");
        (0, bun_test_1.expect)(await service.getLaunchProject()).toBe("/test/path");
    });
    (0, bun_test_1.test)("updates project path", async () => {
        const service = new serverService_1.ServerService();
        service.setLaunchProject("/path/1");
        (0, bun_test_1.expect)(await service.getLaunchProject()).toBe("/path/1");
        service.setLaunchProject("/path/2");
        (0, bun_test_1.expect)(await service.getLaunchProject()).toBe("/path/2");
    });
    (0, bun_test_1.test)("clears project path", async () => {
        const service = new serverService_1.ServerService();
        service.setLaunchProject("/test/path");
        (0, bun_test_1.expect)(await service.getLaunchProject()).toBe("/test/path");
        service.setLaunchProject(null);
        (0, bun_test_1.expect)(await service.getLaunchProject()).toBeNull();
    });
});
(0, bun_test_1.describe)("ServerService.startServer", () => {
    let tempDir;
    let stubContext;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-server-test-"));
        const config = new config_1.Config(tempDir);
        stubContext = { config };
    });
    (0, bun_test_1.afterEach)(async () => {
        // Restore permissions before cleanup
        try {
            await fs.chmod(tempDir, 0o755);
        }
        catch {
            // ignore
        }
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    /** Check if a port is in use by attempting to connect to it */
    async function isPortListening(port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(100);
            socket.on("connect", () => {
                socket.destroy();
                resolve(true);
            });
            socket.on("timeout", () => {
                socket.destroy();
                resolve(false);
            });
            socket.on("error", () => {
                resolve(false);
            });
            socket.connect(port, "127.0.0.1");
        });
    }
    (0, bun_test_1.test)("cleans up server when lockfile acquisition fails", async () => {
        const service = new serverService_1.ServerService();
        // Make unixHome a *file* (not a directory) so lockfile.acquire() fails reliably,
        // even when tests run as root (chmod-based tests don't fail for root).
        const unixHomeFile = path.join(tempDir, "unixHome-not-a-dir");
        await fs.writeFile(unixHomeFile, "not a directory");
        let thrownError = null;
        try {
            // Start server - this should fail when trying to write lockfile
            await service.startServer({
                unixHome: unixHomeFile,
                context: stubContext,
                authToken: "test-token",
                port: 0, // random port
            });
        }
        catch (err) {
            thrownError = err;
        }
        // Verify that an error was thrown
        (0, bun_test_1.expect)(thrownError).not.toBeNull();
        (0, bun_test_1.expect)(thrownError).toBeInstanceOf(Error);
        (0, bun_test_1.expect)(thrownError.message).toMatch(/EACCES|permission denied|ENOTDIR|not a directory/i);
        // Verify the server is NOT left running
        (0, bun_test_1.expect)(service.isServerRunning()).toBe(false);
        (0, bun_test_1.expect)(service.getServerInfo()).toBeNull();
    });
    (0, bun_test_1.test)("does not delete another process's lockfile when start fails", async () => {
        const service = new serverService_1.ServerService();
        // Create a lockfile simulating another running server (use our own PID so it appears "alive")
        const lockPath = path.join(tempDir, "server.lock");
        const existingLockData = {
            pid: process.pid,
            baseUrl: "http://127.0.0.1:9999",
            token: "other-server-token",
            startedAt: new Date().toISOString(),
        };
        await fs.writeFile(lockPath, JSON.stringify(existingLockData, null, 2));
        // Try to start - should fail due to existing server
        let thrownError = null;
        try {
            await service.startServer({
                unixHome: tempDir,
                context: stubContext,
                authToken: "test-token",
                port: 0,
            });
        }
        catch (err) {
            thrownError = err;
        }
        (0, bun_test_1.expect)(thrownError).not.toBeNull();
        (0, bun_test_1.expect)(thrownError.message).toMatch(/already running/i);
        // Critical: call stopServer (simulating cleanup in finally block)
        await service.stopServer();
        // Verify the OTHER process's lockfile was NOT deleted
        const lockContent = await fs.readFile(lockPath, "utf-8");
        const lockData = serverLockfile_1.ServerLockDataSchema.parse(JSON.parse(lockContent));
        (0, bun_test_1.expect)(lockData.baseUrl).toBe("http://127.0.0.1:9999");
        (0, bun_test_1.expect)(lockData.token).toBe("other-server-token");
    });
    (0, bun_test_1.test)("successful start creates lockfile and server", async () => {
        const service = new serverService_1.ServerService();
        const info = await service.startServer({
            unixHome: tempDir,
            context: stubContext,
            authToken: "test-token",
            port: 0,
        });
        try {
            (0, bun_test_1.expect)(info.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
            (0, bun_test_1.expect)(info.token).toBe("test-token");
            (0, bun_test_1.expect)(service.isServerRunning()).toBe(true);
            // Verify lockfile was created
            const lockPath = path.join(tempDir, "server.lock");
            const lockContent = await fs.readFile(lockPath, "utf-8");
            const lockData = serverLockfile_1.ServerLockDataSchema.parse(JSON.parse(lockContent));
            (0, bun_test_1.expect)(lockData.baseUrl).toBe(info.baseUrl);
            (0, bun_test_1.expect)(lockData.token).toBe("test-token");
            // Verify server is actually listening
            const port = parseInt(info.baseUrl.split(":")[2], 10);
            (0, bun_test_1.expect)(await isPortListening(port)).toBe(true);
        }
        finally {
            await service.stopServer();
        }
    });
});
(0, bun_test_1.describe)("computeNetworkBaseUrls", () => {
    (0, bun_test_1.test)("returns empty for loopback binds", () => {
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({ bindHost: "127.0.0.1", port: 3000 })).toEqual([]);
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({ bindHost: "127.0.0.2", port: 3000 })).toEqual([]);
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({ bindHost: "localhost", port: 3000 })).toEqual([]);
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({ bindHost: "::1", port: 3000 })).toEqual([]);
    });
    (0, bun_test_1.test)("expands 0.0.0.0 to all non-internal IPv4 interfaces", () => {
        const networkInterfaces = {
            lo0: [
                {
                    address: "127.0.0.1",
                    netmask: "255.0.0.0",
                    family: "IPv4",
                    mac: "00:00:00:00:00:00",
                    internal: true,
                    cidr: "127.0.0.1/8",
                },
            ],
            en0: [
                {
                    address: "192.168.1.10",
                    netmask: "255.255.255.0",
                    family: "IPv4",
                    mac: "aa:bb:cc:dd:ee:ff",
                    internal: false,
                    cidr: "192.168.1.10/24",
                },
            ],
            tailscale0: [
                {
                    address: "100.64.0.2",
                    netmask: "255.192.0.0",
                    family: "IPv4",
                    mac: "aa:bb:cc:dd:ee:01",
                    internal: false,
                    cidr: "100.64.0.2/10",
                },
            ],
            docker0: [
                {
                    address: "169.254.1.2",
                    netmask: "255.255.0.0",
                    family: "IPv4",
                    mac: "aa:bb:cc:dd:ee:02",
                    internal: false,
                    cidr: "169.254.1.2/16",
                },
            ],
        };
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({
            bindHost: "0.0.0.0",
            port: 3000,
            networkInterfaces,
        })).toEqual(["http://100.64.0.2:3000", "http://192.168.1.10:3000"]);
    });
    (0, bun_test_1.test)("formats IPv6 URLs with brackets", () => {
        const networkInterfaces = {
            en0: [
                {
                    address: "fd7a:115c:a1e0::1",
                    netmask: "ffff:ffff:ffff:ffff::",
                    family: "IPv6",
                    mac: "aa:bb:cc:dd:ee:ff",
                    internal: false,
                    cidr: "fd7a:115c:a1e0::1/64",
                    scopeid: 0,
                },
                {
                    address: "fe80::1",
                    netmask: "ffff:ffff:ffff:ffff::",
                    family: "IPv6",
                    mac: "aa:bb:cc:dd:ee:ff",
                    internal: false,
                    cidr: "fe80::1/64",
                    scopeid: 0,
                },
            ],
        };
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({
            bindHost: "::",
            port: 3000,
            networkInterfaces,
        })).toEqual(["http://[fd7a:115c:a1e0::1]:3000"]);
        (0, bun_test_1.expect)((0, serverService_1.computeNetworkBaseUrls)({ bindHost: "2001:db8::1", port: 3000 })).toEqual([
            "http://[2001:db8::1]:3000",
        ]);
    });
});
//# sourceMappingURL=serverService.test.js.map