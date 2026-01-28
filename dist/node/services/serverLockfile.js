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
exports.ServerLockfile = exports.ServerLockDataSchema = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
exports.ServerLockDataSchema = zod_1.z.object({
    pid: zod_1.z.number(),
    /** Base URL for HTTP API (e.g., "http://localhost:3000" or "https://my.box.com/unix") */
    baseUrl: zod_1.z.url(),
    token: zod_1.z.string(),
    startedAt: zod_1.z.string(),
    /** Bind host/interface the server is listening on (e.g. "127.0.0.1" or "0.0.0.0") */
    bindHost: zod_1.z.string().optional(),
    /** The port the server is listening on */
    port: zod_1.z.number().int().min(0).max(65535).optional(),
    /** Additional base URLs that are reachable from other devices (LAN/VPN) */
    networkBaseUrls: zod_1.z.array(zod_1.z.url()).optional(),
});
/**
 * Manages the server lockfile at ~/.unix/server.lock
 *
 * The lockfile enables CLI tools to discover a running unix server
 * (either Electron app or standalone unix server) and connect to it.
 */
class ServerLockfile {
    lockPath;
    constructor(unixHome) {
        this.lockPath = path.join(unixHome, "server.lock");
    }
    /**
     * Acquire the lockfile with the given baseUrl and token.
     * Writes atomically with 0600 permissions (owner read/write only).
     */
    async acquire(baseUrl, token, extra) {
        const bindHost = extra?.bindHost?.trim() ? extra.bindHost.trim() : undefined;
        const port = typeof extra?.port === "number" &&
            Number.isInteger(extra.port) &&
            extra.port >= 0 &&
            extra.port <= 65535
            ? extra.port
            : undefined;
        const data = {
            pid: process.pid,
            baseUrl,
            token,
            startedAt: new Date().toISOString(),
            bindHost,
            port,
            networkBaseUrls: extra?.networkBaseUrls?.length ? extra.networkBaseUrls : undefined,
        };
        // Ensure directory exists
        const dir = path.dirname(this.lockPath);
        try {
            await fs.access(dir);
        }
        catch {
            await fs.mkdir(dir, { recursive: true });
        }
        // Write atomically by writing to temp file then renaming
        const tempPath = `${this.lockPath}.${process.pid}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), {
            mode: 0o600, // Owner read/write only
        });
        await fs.rename(tempPath, this.lockPath);
    }
    /**
     * Read the lockfile and validate it.
     * Returns null if the lockfile doesn't exist or is stale (dead PID).
     */
    async read() {
        try {
            await fs.access(this.lockPath);
            const content = await fs.readFile(this.lockPath, "utf-8");
            const data = exports.ServerLockDataSchema.parse(JSON.parse(content));
            // Validate PID is still alive
            if (!this.isProcessAlive(data.pid)) {
                // Clean up stale lockfile
                await this.release();
                return null;
            }
            return data;
        }
        catch {
            return null;
        }
    }
    /**
     * Release the lockfile by deleting it.
     */
    async release() {
        try {
            await fs.unlink(this.lockPath);
        }
        catch {
            // Ignore cleanup errors (file may not exist)
        }
    }
    /**
     * Check if a process with the given PID is still running.
     * Uses signal 0 which tests existence without actually sending a signal.
     */
    isProcessAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get the path to the lockfile (for testing/debugging).
     */
    getLockPath() {
        return this.lockPath;
    }
}
exports.ServerLockfile = ServerLockfile;
//# sourceMappingURL=serverLockfile.js.map