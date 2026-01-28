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
const serverLockfile_1 = require("./serverLockfile");
(0, bun_test_1.describe)("ServerLockfile", () => {
    let tempDir;
    let lockfile;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-lock-test-"));
        lockfile = new serverLockfile_1.ServerLockfile(tempDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("acquire creates lockfile with correct data", async () => {
        await lockfile.acquire("http://localhost:12345", "test-token");
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.baseUrl).toBe("http://localhost:12345");
        (0, bun_test_1.expect)(data.token).toBe("test-token");
        (0, bun_test_1.expect)(data.pid).toBe(process.pid);
        (0, bun_test_1.expect)(data.startedAt).toBeDefined();
    });
    (0, bun_test_1.test)("acquire persists optional network metadata", async () => {
        await lockfile.acquire("http://localhost:12345", "test-token", {
            bindHost: "0.0.0.0",
            port: 12345,
            networkBaseUrls: ["http://192.168.1.10:12345"],
        });
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.bindHost).toBe("0.0.0.0");
        (0, bun_test_1.expect)(data.port).toBe(12345);
        (0, bun_test_1.expect)(data.networkBaseUrls).toEqual(["http://192.168.1.10:12345"]);
    });
    (0, bun_test_1.test)("read returns null for non-existent lockfile", async () => {
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).toBeNull();
    });
    (0, bun_test_1.test)("read returns null for stale lockfile (dead PID)", async () => {
        const lockPath = lockfile.getLockPath();
        // Write lockfile with fake dead PID
        await fs.writeFile(lockPath, JSON.stringify({
            pid: 999999999, // Very unlikely to be a real PID
            baseUrl: "http://localhost:12345",
            token: "test-token",
            startedAt: new Date().toISOString(),
        }));
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).toBeNull();
        // Stale lockfile should be cleaned up
        let exists = true;
        try {
            await fs.access(lockPath);
        }
        catch {
            exists = false;
        }
        (0, bun_test_1.expect)(exists).toBe(false);
    });
    (0, bun_test_1.test)("read returns data for lockfile with current PID", async () => {
        await lockfile.acquire("http://127.0.0.1:54321", "valid-token");
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.baseUrl).toBe("http://127.0.0.1:54321");
        (0, bun_test_1.expect)(data.token).toBe("valid-token");
    });
    (0, bun_test_1.test)("release removes lockfile", async () => {
        await lockfile.acquire("http://localhost:12345", "test-token");
        const lockPath = lockfile.getLockPath();
        let exists = true;
        try {
            await fs.access(lockPath);
        }
        catch {
            exists = false;
        }
        (0, bun_test_1.expect)(exists).toBe(true);
        await lockfile.release();
        try {
            await fs.access(lockPath);
            exists = true;
        }
        catch {
            exists = false;
        }
        (0, bun_test_1.expect)(exists).toBe(false);
    });
    (0, bun_test_1.test)("release is idempotent (no error if file doesn't exist)", async () => {
        // Should not throw
        await lockfile.release();
        await lockfile.release();
    });
    (0, bun_test_1.test)("lockfile has restrictive permissions on unix", async () => {
        // Skip on Windows where file permissions work differently
        if (process.platform === "win32") {
            return;
        }
        await lockfile.acquire("http://localhost:12345", "test-token");
        const lockPath = lockfile.getLockPath();
        const stats = await fs.stat(lockPath);
        // 0o600 = owner read/write only
        (0, bun_test_1.expect)(stats.mode & 0o777).toBe(0o600);
    });
    (0, bun_test_1.test)("acquire overwrites existing lockfile", async () => {
        await lockfile.acquire("http://localhost:11111", "first-token");
        await lockfile.acquire("https://my.machine.local/unix", "second-token");
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.baseUrl).toBe("https://my.machine.local/unix");
        (0, bun_test_1.expect)(data.token).toBe("second-token");
    });
    (0, bun_test_1.test)("read handles corrupted lockfile gracefully", async () => {
        const lockPath = lockfile.getLockPath();
        await fs.writeFile(lockPath, "not valid json");
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).toBeNull();
    });
    (0, bun_test_1.test)("acquire creates parent directory if it doesn't exist", async () => {
        const nestedDir = path.join(tempDir, "nested", "dir");
        const nestedLockfile = new serverLockfile_1.ServerLockfile(nestedDir);
        await nestedLockfile.acquire("http://localhost:12345", "test-token");
        const data = await nestedLockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.baseUrl).toBe("http://localhost:12345");
    });
    (0, bun_test_1.test)("getLockPath returns correct path", () => {
        const expectedPath = path.join(tempDir, "server.lock");
        (0, bun_test_1.expect)(lockfile.getLockPath()).toBe(expectedPath);
    });
    (0, bun_test_1.test)("supports HTTPS URLs", async () => {
        await lockfile.acquire("https://secure.example.com:8443/api", "secure-token");
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.baseUrl).toBe("https://secure.example.com:8443/api");
    });
    (0, bun_test_1.test)("supports URLs with path prefixes", async () => {
        await lockfile.acquire("https://my.machine.local/unix/", "path-token");
        const data = await lockfile.read();
        (0, bun_test_1.expect)(data).not.toBeNull();
        (0, bun_test_1.expect)(data.baseUrl).toBe("https://my.machine.local/unix/");
    });
});
//# sourceMappingURL=serverLockfile.test.js.map