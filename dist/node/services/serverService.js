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
exports.ServerService = void 0;
exports.computeNetworkBaseUrls = computeNetworkBaseUrls;
const server_1 = require("../../node/orpc/server");
const serverLockfile_1 = require("./serverLockfile");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const log_1 = require("./log");
const os = __importStar(require("os"));
const version_1 = require("../../version");
const mdnsAdvertiserService_1 = require("./mdnsAdvertiserService");
function isLoopbackHost(host) {
    const normalized = host.trim().toLowerCase();
    // IPv4 loopback range (RFC 1122): 127.0.0.0/8
    if (normalized.startsWith("127.")) {
        return true;
    }
    return normalized === "localhost" || normalized === "::1";
}
function formatHostForUrl(host) {
    const trimmed = host.trim();
    // IPv6 URLs must be bracketed: http://[::1]:1234
    if (trimmed.includes(":")) {
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            return trimmed;
        }
        return `[${trimmed}]`;
    }
    return trimmed;
}
function buildHttpBaseUrl(host, port) {
    return `http://${formatHostForUrl(host)}:${port}`;
}
function getNonInternalInterfaceAddresses(networkInterfaces, family) {
    const addresses = [];
    const emptyInfos = [];
    for (const name of Object.keys(networkInterfaces)) {
        const infos = networkInterfaces[name] ?? emptyInfos;
        for (const info of infos) {
            const infoFamily = info.family;
            if (infoFamily !== family) {
                continue;
            }
            if (info.internal) {
                continue;
            }
            const address = info.address;
            // Filter out link-local addresses (they are rarely what users want to copy/paste).
            if (family === "IPv4" && address.startsWith("169.254.")) {
                continue;
            }
            if (family === "IPv6" && address.toLowerCase().startsWith("fe80:")) {
                continue;
            }
            addresses.push(address);
        }
    }
    return Array.from(new Set(addresses)).sort();
}
/**
 * Compute base URLs that are reachable from other devices (LAN/VPN).
 *
 * NOTE: This is for UI/display and should not be used for lockfile discovery,
 * since lockfiles are local-machine concerns.
 */
function computeNetworkBaseUrls(options) {
    const bindHost = options.bindHost.trim();
    if (!bindHost) {
        return [];
    }
    if (isLoopbackHost(bindHost)) {
        return [];
    }
    const networkInterfaces = options.networkInterfaces ?? os.networkInterfaces();
    if (bindHost === "0.0.0.0") {
        return getNonInternalInterfaceAddresses(networkInterfaces, "IPv4").map((address) => buildHttpBaseUrl(address, options.port));
    }
    if (bindHost === "::") {
        return getNonInternalInterfaceAddresses(networkInterfaces, "IPv6").map((address) => buildHttpBaseUrl(address, options.port));
    }
    return [buildHttpBaseUrl(bindHost, options.port)];
}
class ServerService {
    launchProjectPath = null;
    server = null;
    lockfile = null;
    apiAuthToken = null;
    serverInfo = null;
    mdnsAdvertiser = new mdnsAdvertiserService_1.MdnsAdvertiserService();
    sshHost = undefined;
    /**
     * Set the launch project path
     */
    setLaunchProject(path) {
        this.launchProjectPath = path;
    }
    /**
     * Get the launch project path
     */
    getLaunchProject() {
        return Promise.resolve(this.launchProjectPath);
    }
    /**
     * Set the SSH hostname for editor deep links (browser mode)
     */
    setSshHost(host) {
        this.sshHost = host;
    }
    /**
     * Get the SSH hostname for editor deep links (browser mode)
     */
    getSshHost() {
        return this.sshHost;
    }
    /**
     * Set the auth token used for the HTTP/WS API server.
     *
     * This is injected by the desktop app on startup so the server can be restarted
     * without needing to plumb the token through every callsite.
     */
    setApiAuthToken(token) {
        this.apiAuthToken = token;
    }
    /** Get the auth token used for the HTTP/WS API server (if initialized). */
    getApiAuthToken() {
        return this.apiAuthToken;
    }
    /**
     * Start the HTTP/WS API server.
     *
     * @throws Error if a server is already running (check lockfile first)
     */
    async startServer(options) {
        if (this.server) {
            throw new Error("Server already running in this process");
        }
        // Create lockfile instance for checking - don't store yet
        const lockfile = new serverLockfile_1.ServerLockfile(options.unixHome);
        // Check for existing server (another process)
        const existing = await lockfile.read();
        if (existing) {
            throw new Error(`Another unix server is already running at ${existing.baseUrl} (PID: ${existing.pid})`);
        }
        const bindHost = typeof options.host === "string" && options.host.trim() ? options.host.trim() : "127.0.0.1";
        this.apiAuthToken = options.authToken;
        const staticDir = path.join(__dirname, "../..");
        let serveStatic = options.serveStatic ?? false;
        if (serveStatic) {
            const indexPath = path.join(staticDir, "index.html");
            try {
                await fs.access(indexPath);
            }
            catch {
                log_1.log.warn(`API server static UI requested, but ${indexPath} is missing. Disabling.`);
                serveStatic = false;
            }
        }
        const serverOptions = {
            host: bindHost,
            port: options.port ?? 0,
            context: options.context,
            authToken: options.authToken,
            router: options.router,
            serveStatic,
            staticDir,
        };
        const server = await (0, server_1.createOrpcServer)(serverOptions);
        const networkBaseUrls = computeNetworkBaseUrls({ bindHost, port: server.port });
        // Acquire the lockfile - clean up server if this fails
        try {
            await lockfile.acquire(server.baseUrl, options.authToken, {
                bindHost,
                port: server.port,
                networkBaseUrls,
            });
        }
        catch (err) {
            await server.close();
            throw err;
        }
        // Only store references after successful acquisition - ensures stopServer
        // won't delete another process's lockfile if we failed before acquiring
        this.lockfile = lockfile;
        this.server = server;
        this.serverInfo = {
            baseUrl: server.baseUrl,
            token: options.authToken,
            bindHost,
            port: server.port,
            networkBaseUrls,
        };
        const mdnsAdvertisementEnabled = options.context.config.getMdnsAdvertisementEnabled();
        // "auto" mode: only advertise when the bind host is reachable from other devices.
        if (mdnsAdvertisementEnabled !== false && !isLoopbackHost(bindHost)) {
            const instanceName = options.context.config.getMdnsServiceName() ?? `unix-${os.hostname()}`;
            const serviceOptions = (0, mdnsAdvertiserService_1.buildUnixMdnsServiceOptions)({
                bindHost,
                port: server.port,
                instanceName,
                version: version_1.VERSION.git_describe,
                authRequired: options.authToken.trim().length > 0,
            });
            try {
                await this.mdnsAdvertiser.start(serviceOptions);
            }
            catch (err) {
                log_1.log.warn("Failed to advertise unix API server via mDNS:", err);
            }
        }
        else if (mdnsAdvertisementEnabled === true && isLoopbackHost(bindHost)) {
            log_1.log.warn("mDNS advertisement requested, but the API server is loopback-only. " +
                "Set apiServerBindHost to 0.0.0.0 (or a LAN IP) to enable LAN discovery.");
        }
        return this.serverInfo;
    }
    /**
     * Stop the HTTP/WS API server and release the lockfile.
     */
    async stopServer() {
        try {
            await this.mdnsAdvertiser.stop();
        }
        catch (err) {
            log_1.log.warn("Failed to stop mDNS advertiser:", err);
        }
        if (this.lockfile) {
            await this.lockfile.release();
            this.lockfile = null;
        }
        if (this.server) {
            await this.server.close();
            this.server = null;
        }
        this.serverInfo = null;
    }
    /**
     * Get information about the running server.
     * Returns null if no server is running in this process.
     */
    getServerInfo() {
        return this.serverInfo;
    }
    /**
     * Check if a server is running in this process.
     */
    isServerRunning() {
        return this.server !== null;
    }
}
exports.ServerService = ServerService;
//# sourceMappingURL=serverService.js.map