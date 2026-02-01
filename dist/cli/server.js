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
/**
 * CLI entry point for the unix oRPC server.
 * Uses createOrpcServer from ./orpcServer.ts for the actual server logic.
 */
const config_1 = require("../node/config");
const serviceContainer_1 = require("../node/services/serviceContainer");
const serverLockfile_1 = require("../node/services/serverLockfile");
const paths_1 = require("../common/constants/paths");
const commander_1 = require("commander");
const pathUtils_1 = require("../node/utils/pathUtils");
const server_1 = require("../node/orpc/server");
const version_1 = require("../version");
const mdnsAdvertiserService_1 = require("../node/services/mdnsAdvertiserService");
const os = __importStar(require("os"));
const argv_1 = require("./argv");
const program = new commander_1.Command();
program
    .name("unix server")
    .description("HTTP/WebSocket ORPC server for unix")
    .option("-h, --host <host>", "bind to specific host", "localhost")
    .option("-p, --port <port>", "bind to specific port", "3000")
    .option("--auth-token <token>", "optional bearer token for HTTP/WS auth")
    .option("--ssh-host <host>", "SSH hostname/alias for editor deep links (e.g., devbox)")
    .option("--add-project <path>", "add and open project at the specified path (idempotent)")
    .parse(process.argv, (0, argv_1.getParseOptions)());
const options = program.opts();
const HOST = options.host;
const PORT = Number.parseInt(String(options.port), 10);
const rawAuthToken = options.authToken ?? process.env.LATTICE_SERVER_AUTH_TOKEN ?? process.env.UNIX_SERVER_AUTH_TOKEN;
const AUTH_TOKEN = rawAuthToken?.trim() ? rawAuthToken.trim() : undefined;
const ADD_PROJECT_PATH = options.addProject;
// SSH host for editor deep links (CLI flag > env var > config file, resolved later)
const CLI_SSH_HOST = options.sshHost;
// Track the launch project path for initial navigation
let launchProjectPath = null;
function isLoopbackHost(host) {
    const normalized = host.trim().toLowerCase();
    // IPv4 loopback range (RFC 1122): 127.0.0.0/8
    if (normalized.startsWith("127.")) {
        return true;
    }
    return normalized === "localhost" || normalized === "::1";
}
// Minimal BrowserWindow stub for services that expect one
const mockWindow = {
    isDestroyed: () => false,
    setTitle: () => undefined,
    webContents: {
        send: () => undefined,
        openDevTools: () => undefined,
    },
};
(async () => {
    (0, paths_1.migrateLegacyUnixHome)();
    // Check for existing server (Electron or another unix server instance)
    const lockfile = new serverLockfile_1.ServerLockfile((0, paths_1.getUnixHome)());
    const existing = await lockfile.read();
    if (existing) {
        console.error(`Error: unix API server is already running at ${existing.baseUrl}`);
        console.error(`Use 'unix api' commands to interact with the running instance.`);
        process.exit(1);
    }
    const config = new config_1.Config();
    const serviceContainer = new serviceContainer_1.ServiceContainer(config);
    await serviceContainer.initialize();
    serviceContainer.windowService.setMainWindow(mockWindow);
    if (ADD_PROJECT_PATH) {
        await initializeProjectDirect(ADD_PROJECT_PATH, serviceContainer);
    }
    // Set launch project path for clients
    serviceContainer.serverService.setLaunchProject(launchProjectPath);
    // Set SSH host for editor deep links (CLI > env > config file)
    const sshHost = CLI_SSH_HOST ?? process.env.UNIX_SSH_HOST ?? config.getServerSshHost();
    serviceContainer.serverService.setSshHost(sshHost);
    // Build oRPC context from services
    const context = {
        config: serviceContainer.config,
        aiService: serviceContainer.aiService,
        projectService: serviceContainer.projectService,
        workspaceService: serviceContainer.workspaceService,
        taskService: serviceContainer.taskService,
        providerService: serviceContainer.providerService,
        terminalService: serviceContainer.terminalService,
        editorService: serviceContainer.editorService,
        windowService: serviceContainer.windowService,
        updateService: serviceContainer.updateService,
        tokenizerService: serviceContainer.tokenizerService,
        serverService: serviceContainer.serverService,
        menuEventService: serviceContainer.menuEventService,
        workspaceMcpOverridesService: serviceContainer.workspaceMcpOverridesService,
        mcpConfigService: serviceContainer.mcpConfigService,
        featureFlagService: serviceContainer.featureFlagService,
        sessionTimingService: serviceContainer.sessionTimingService,
        mcpServerManager: serviceContainer.mcpServerManager,
        voiceService: serviceContainer.voiceService,
        telemetryService: serviceContainer.telemetryService,
        experimentsService: serviceContainer.experimentsService,
        sessionUsageService: serviceContainer.sessionUsageService,
        signingService: serviceContainer.signingService,
        latticeService: serviceContainer.latticeService,
        inferenceService: serviceContainer.inferenceService,
    };
    const mdnsAdvertiser = new mdnsAdvertiserService_1.MdnsAdvertiserService();
    const server = await (0, server_1.createOrpcServer)({
        host: HOST,
        port: PORT,
        authToken: AUTH_TOKEN,
        context,
        serveStatic: true,
    });
    // Acquire lockfile so other instances know we're running
    await lockfile.acquire(server.baseUrl, AUTH_TOKEN ?? "");
    const mdnsAdvertisementEnabled = config.getMdnsAdvertisementEnabled();
    if (mdnsAdvertisementEnabled !== false && !isLoopbackHost(HOST)) {
        const instanceName = config.getMdnsServiceName() ?? `unix-${os.hostname()}`;
        const serviceOptions = (0, mdnsAdvertiserService_1.buildUnixMdnsServiceOptions)({
            bindHost: HOST,
            port: server.port,
            instanceName,
            version: version_1.VERSION.git_describe,
            authRequired: AUTH_TOKEN?.trim().length ? true : false,
        });
        try {
            await mdnsAdvertiser.start(serviceOptions);
        }
        catch (err) {
            console.warn("Failed to advertise unix API server via mDNS:", err);
        }
    }
    else if (mdnsAdvertisementEnabled === true && isLoopbackHost(HOST)) {
        console.warn("mDNS advertisement requested, but the API server is loopback-only. " +
            "Set --host 0.0.0.0 (or a LAN IP) to enable LAN discovery.");
    }
    console.log(`Server is running on ${server.baseUrl}`);
    // Cleanup on shutdown
    let cleanupInProgress = false;
    const cleanup = async () => {
        if (cleanupInProgress)
            return;
        cleanupInProgress = true;
        console.log("Shutting down server...");
        // Force exit after timeout if cleanup hangs
        const forceExitTimer = setTimeout(() => {
            console.log("Cleanup timed out, forcing exit...");
            process.exit(1);
        }, 5000);
        try {
            // Close all PTY sessions first (these are the "sub-processes" nodemon sees)
            serviceContainer.terminalService.closeAllSessions();
            // Dispose background processes
            await serviceContainer.dispose();
            // Release lockfile and close server
            try {
                await mdnsAdvertiser.stop();
            }
            catch (err) {
                console.warn("Failed to stop mDNS advertiser:", err);
            }
            await lockfile.release();
            await server.close();
            clearTimeout(forceExitTimer);
            process.exit(0);
        }
        catch (err) {
            console.error("Cleanup error:", err);
            clearTimeout(forceExitTimer);
            process.exit(1);
        }
    };
    process.on("SIGINT", () => void cleanup());
    process.on("SIGTERM", () => void cleanup());
})().catch((error) => {
    console.error("Failed to initialize server:", error);
    process.exit(1);
});
async function initializeProjectDirect(projectPath, serviceContainer) {
    try {
        let normalizedPath = projectPath.replace(/\/+$/, "");
        const validation = await (0, pathUtils_1.validateProjectPath)(normalizedPath);
        if (!validation.valid || !validation.expandedPath) {
            console.error(`Invalid project path provided via --add-project: ${validation.error ?? "unknown error"}`);
            return;
        }
        normalizedPath = validation.expandedPath;
        const projects = serviceContainer.projectService.list();
        const alreadyExists = Array.isArray(projects)
            ? projects.some(([path]) => path === normalizedPath)
            : false;
        if (alreadyExists) {
            console.log(`Project already exists: ${normalizedPath}`);
            launchProjectPath = normalizedPath;
            return;
        }
        console.log(`Creating project via --add-project: ${normalizedPath}`);
        const result = await serviceContainer.projectService.create(normalizedPath);
        if (result.success) {
            console.log(`Project created at ${normalizedPath}`);
            launchProjectPath = normalizedPath;
        }
        else {
            const errorMsg = typeof result.error === "string"
                ? result.error
                : JSON.stringify(result.error ?? "unknown error");
            console.error(`Failed to create project at ${normalizedPath}: ${errorMsg}`);
        }
    }
    catch (error) {
        console.error(`initializeProject failed for ${projectPath}:`, error);
    }
}
//# sourceMappingURL=server.js.map