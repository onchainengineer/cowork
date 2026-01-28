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
// Enable source map support for better error stack traces in production
require("source-map-support/register");
// Fix PATH on macOS when launched from Finder (not terminal).
// GUI apps inherit minimal PATH from launchd, missing Homebrew tools like git-lfs.
// Must run before any child process spawns. Failures are silently ignored.
if (process.platform === "darwin") {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("fix-path").default();
    }
    catch (e) {
        // App works with existing PATH; debug log for troubleshooting
        console.debug("[fix-path] Failed to enrich PATH:", e);
    }
}
const crypto_1 = require("crypto");
const message_port_1 = require("@orpc/server/message-port");
const server_1 = require("@orpc/server");
const router_1 = require("../node/orpc/router");
const formatOrpcError_1 = require("../node/orpc/formatOrpcError");
const serverLockfile_1 = require("../node/services/serverLockfile");
require("disposablestack/auto");
const electron_1 = require("electron");
// Increase renderer V8 heap limit from default ~4GB to 8GB.
// At ~3.9GB usage, the default limit causes frequent Mark-Compact GC cycles
// with low mutator utilization (~39%), degrading UI responsiveness.
// Must be called before app.whenReady().
electron_1.app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const version_1 = require("../version");
const paths_1 = require("../common/constants/paths");
const assert_1 = __importDefault(require("../common/utils/assert"));
const tokenizer_1 = require("../node/utils/main/tokenizer");
const electron_window_state_1 = __importDefault(require("electron-window-state"));
const titleBarOptions_1 = require("../desktop/titleBarOptions");
// React DevTools for development profiling
// Using dynamic import() to avoid loading electron-devtools-installer at module init time
// IMPORTANT: Lazy-load heavy dependencies to maintain fast startup time
//
// To keep startup time under 4s, avoid importing AI SDK packages at the top level.
// These files MUST use dynamic import():
//   - main.ts, config.ts, preload.ts (startup-critical)
//
// ✅ GOOD: const { createAnthropic } = await import("@ai-sdk/anthropic");
// ❌ BAD:  import { createAnthropic } from "@ai-sdk/anthropic";
//
// Enforcement: scripts/check_eager_imports.sh validates this in CI
//
// Lazy-load Config and ServiceContainer to avoid loading heavy AI SDK dependencies at startup
// These will be loaded on-demand when createWindow() is called
let config = null;
let services = null;
const isE2ETest = process.env.UNIX_E2E === "1";
const forceDistLoad = process.env.UNIX_E2E_LOAD_DIST === "1";
if (isE2ETest) {
    // For e2e tests, use a test-specific userData directory
    // Note: getUnixHome() already respects UNIX_ROOT for test isolation
    const e2eUserData = path.join((0, paths_1.getUnixHome)(), "user-data");
    try {
        fs.mkdirSync(e2eUserData, { recursive: true });
        electron_1.app.setPath("userData", e2eUserData);
        console.log("Using test userData directory:", e2eUserData);
    }
    catch (error) {
        console.warn("Failed to prepare test userData directory:", error);
    }
}
const devServerPort = process.env.UNIX_DEVSERVER_PORT ?? "5173";
console.log(`Unix starting - version: ${version_1.VERSION.git ?? "(dev)"} (built: ${version_1.VERSION.buildTime ?? "dev-mode"})`);
console.log("Main process starting...");
// Debug: abort immediately if UNIX_DEBUG_START_TIME is set
// This is used to measure baseline startup time without full initialization
if (process.env.UNIX_DEBUG_START_TIME === "1") {
    console.log("UNIX_DEBUG_START_TIME is set - aborting immediately");
    process.exit(0);
}
// Global error handlers for better error reporting
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Stack:", stack);
    // Show error dialog in production
    if (electron_1.app.isPackaged) {
        electron_1.dialog.showErrorBox("Application Error", `An unexpected error occurred:\n\n${message}\n\nStack trace:\n${stack ?? "No stack trace available"}`);
    }
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise);
    console.error("Reason:", reason);
    if (electron_1.app.isPackaged) {
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;
        electron_1.dialog.showErrorBox("Unhandled Promise Rejection", `An unhandled promise rejection occurred:\n\n${message}\n\nStack trace:\n${stack ?? "No stack trace available"}`);
    }
});
// Single instance lock (can be disabled for development with CUNIX_ALLOW_MULTIPLE_INSTANCES=1)
const allowMultipleInstances = process.env.CUNIX_ALLOW_MULTIPLE_INSTANCES === "1";
const gotTheLock = allowMultipleInstances || electron_1.app.requestSingleInstanceLock();
console.log("Single instance lock acquired:", gotTheLock);
if (!gotTheLock) {
    // Another instance is already running, quit this one
    console.log("Another instance is already running, quitting...");
    electron_1.app.quit();
}
else {
    // This is the primary instance
    console.log("This is the primary instance");
    electron_1.app.on("second-instance", () => {
        // Someone tried to run a second instance, focus our window instead
        console.log("Second instance attempted to start");
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
let mainWindow = null;
let splashWindow = null;
/**
 * Format timestamp as HH:MM:SS.mmm for readable logging
 */
function timestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${ms}`;
}
function createMenu() {
    const template = [
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" },
            ],
        },
        {
            label: "View",
            submenu: [
                // Reload without Ctrl+R shortcut (reserved for Code Review refresh)
                {
                    label: "Reload",
                    click: (_item, focusedWindow) => {
                        if (focusedWindow && "reload" in focusedWindow) {
                            focusedWindow.reload();
                        }
                    },
                },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                {
                    role: "togglefullscreen",
                    accelerator: process.platform === "darwin" ? "Ctrl+Command+F" : "F11",
                },
            ],
        },
        {
            label: "Window",
            submenu: [{ role: "minimize" }, { role: "close" }],
        },
    ];
    if (process.platform === "darwin") {
        template.unshift({
            label: electron_1.app.getName(),
            submenu: [
                { role: "about" },
                { type: "separator" },
                {
                    label: "Settings...",
                    accelerator: "Cmd+,",
                    click: () => {
                        services?.menuEventService.emitOpenSettings();
                    },
                },
                { type: "separator" },
                { role: "services", submenu: [] },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        });
    }
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
}
/**
 * Create and show splash screen - instant visual feedback (<100ms)
 *
 * Shows a lightweight native window with static HTML while services load.
 * No IPC, no React, no heavy dependencies - just immediate user feedback.
 */
async function showSplashScreen() {
    const startTime = Date.now();
    console.log(`[${timestamp()}] Showing splash screen...`);
    splashWindow = new electron_1.BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: false,
        backgroundColor: "#1f1f1f", // Match splash HTML background (hsl(0 0% 12%)) - prevents white flash
        alwaysOnTop: true,
        center: true,
        resizable: false,
        show: false, // Don't show until HTML is loaded
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Wait for splash HTML to load
    await splashWindow.loadFile(path.join(__dirname, "../splash.html"));
    // Wait for the window to actually be shown and rendered before continuing
    // This ensures the splash is visible before we block the event loop with heavy work
    await new Promise((resolve) => {
        splashWindow.once("show", () => {
            const loadTime = Date.now() - startTime;
            console.log(`[${timestamp()}] Splash screen shown (${loadTime}ms)`);
            // Give one more event loop tick for the window to actually paint
            setImmediate(resolve);
        });
        splashWindow.show();
    });
    splashWindow.on("closed", () => {
        console.log(`[${timestamp()}] Splash screen closed event`);
        splashWindow = null;
    });
}
/**
 * Close splash screen
 */
function closeSplashScreen() {
    if (splashWindow) {
        console.log(`[${timestamp()}] Closing splash screen...`);
        splashWindow.close();
        splashWindow = null;
    }
}
/**
 * Load backend services (Config, ServiceContainer, AI SDK, tokenizer)
 *
 * Heavy initialization (~100ms) happens here while splash is visible.
 * Note: Spinner may freeze briefly during this phase. This is acceptable since
 * the splash still provides visual feedback that the app is loading.
 */
async function loadServices() {
    if (config && services)
        return; // Already loaded
    const startTime = Date.now();
    console.log(`[${timestamp()}] Loading services...`);
    /* eslint-disable no-restricted-syntax */
    // Dynamic imports are justified here for performance:
    // - ServiceContainer transitively imports the entire AI SDK (ai, @ai-sdk/anthropic, etc.)
    // - These are large modules (~100ms load time) that would block splash from appearing
    // - Loading happens once, then cached
    const [{ Config: ConfigClass }, { ServiceContainer: ServiceContainerClass }, { TerminalWindowManager: TerminalWindowManagerClass },] = await Promise.all([
        Promise.resolve().then(() => __importStar(require("../node/config"))),
        Promise.resolve().then(() => __importStar(require("../node/services/serviceContainer"))),
        Promise.resolve().then(() => __importStar(require("../desktop/terminalWindowManager"))),
    ]);
    /* eslint-enable no-restricted-syntax */
    config = new ConfigClass();
    services = new ServiceContainerClass(config);
    await services.initialize();
    // Generate auth token (use env var or random per-session)
    const authToken = process.env.UNIX_SERVER_AUTH_TOKEN ?? (0, crypto_1.randomBytes)(32).toString("hex");
    // Store auth token so the API server can be restarted via Settings.
    services.serverService.setApiAuthToken(authToken);
    // Single router instance with auth middleware - used for both MessagePort and HTTP/WS
    const orpcRouter = (0, router_1.router)(authToken);
    const orpcHandler = new message_port_1.RPCHandler(orpcRouter, {
        interceptors: [
            (0, server_1.onError)((error, options) => {
                const formatted = (0, formatOrpcError_1.formatOrpcError)(error, options);
                console.error(formatted.message);
            }),
        ],
    });
    // Build the oRPC context with all services
    const orpcContext = {
        config: services.config,
        aiService: services.aiService,
        projectService: services.projectService,
        workspaceService: services.workspaceService,
        taskService: services.taskService,
        providerService: services.providerService,
        terminalService: services.terminalService,
        editorService: services.editorService,
        windowService: services.windowService,
        updateService: services.updateService,
        tokenizerService: services.tokenizerService,
        serverService: services.serverService,
        featureFlagService: services.featureFlagService,
        sessionTimingService: services.sessionTimingService,
        workspaceMcpOverridesService: services.workspaceMcpOverridesService,
        mcpConfigService: services.mcpConfigService,
        mcpServerManager: services.mcpServerManager,
        menuEventService: services.menuEventService,
        voiceService: services.voiceService,
        telemetryService: services.telemetryService,
        experimentsService: services.experimentsService,
        sessionUsageService: services.sessionUsageService,
        signingService: services.signingService,
        latticeService: services.latticeService,
    };
    electron_1.ipcMain.handle("unix:get-is-rosetta", async () => {
        if (process.platform !== "darwin") {
            return false;
        }
        try {
            // Intentionally lazy import to keep startup fast and avoid bundling concerns.
            // eslint-disable-next-line no-restricted-syntax -- main-process-only builtin
            const { execSync } = await Promise.resolve().then(() => __importStar(require("node:child_process")));
            const result = execSync("sysctl -n sysctl.proc_translated", { encoding: "utf8" }).trim();
            return result === "1";
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.handle("unix:get-is-windows-wsl-shell", async () => {
        if (process.platform !== "win32")
            return false;
        const normalize = (p) => p.replace(/\//g, "\\").toLowerCase();
        const isWslLauncher = (p) => {
            const base = path.win32.basename(p);
            return (p === "wsl" ||
                base === "wsl.exe" ||
                p === "bash" ||
                p === "bash.exe" ||
                p.endsWith("\\windows\\system32\\bash.exe"));
        };
        const envShell = process.env.SHELL?.trim();
        if (envShell && isWslLauncher(normalize(envShell))) {
            return true;
        }
        try {
            // Intentionally lazy import to keep startup fast and avoid bundling concerns.
            // eslint-disable-next-line no-restricted-syntax -- main-process-only builtin
            const { execSync } = await Promise.resolve().then(() => __importStar(require("node:child_process")));
            const result = execSync("where bash", {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "ignore"],
                windowsHide: true,
            });
            const firstPath = result
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find((line) => line.length > 0);
            return firstPath ? isWslLauncher(normalize(firstPath)) : false;
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.on("start-orpc-server", (event) => {
        const [serverPort] = event.ports;
        orpcHandler.upgrade(serverPort, {
            context: {
                ...orpcContext,
                // Inject synthetic auth header so auth middleware passes
                headers: { authorization: `Bearer ${authToken}` },
            },
        });
        serverPort.start();
    });
    // Start HTTP/WS API server for CLI access (unless explicitly disabled)
    if (process.env.UNIX_NO_API_SERVER !== "1") {
        const lockfile = new serverLockfile_1.ServerLockfile(config.rootDir);
        const existing = await lockfile.read();
        if (existing) {
            console.log(`[${timestamp()}] API server already running at ${existing.baseUrl}, skipping`);
        }
        else {
            try {
                const loadedConfig = config.loadConfigOrDefault();
                const configuredBindHost = typeof loadedConfig.apiServerBindHost === "string" &&
                    loadedConfig.apiServerBindHost.trim()
                    ? loadedConfig.apiServerBindHost.trim()
                    : undefined;
                const serveStatic = loadedConfig.apiServerServeWebUi === true;
                const configuredPort = loadedConfig.apiServerPort;
                const envPortRaw = process.env.UNIX_SERVER_PORT
                    ? Number.parseInt(process.env.UNIX_SERVER_PORT, 10)
                    : undefined;
                const envPort = envPortRaw !== undefined && Number.isFinite(envPortRaw) ? envPortRaw : undefined;
                const port = envPort ?? configuredPort ?? 0;
                const host = configuredBindHost ?? "127.0.0.1";
                const serverInfo = await services.serverService.startServer({
                    unixHome: config.rootDir,
                    context: orpcContext,
                    router: orpcRouter,
                    authToken,
                    host,
                    serveStatic,
                    port,
                });
                console.log(`[${timestamp()}] API server started at ${serverInfo.baseUrl}`);
            }
            catch (error) {
                console.error(`[${timestamp()}] Failed to start API server:`, error);
                // Non-fatal - continue without API server
            }
        }
    }
    // Set TerminalWindowManager for desktop mode (pop-out terminal windows)
    const terminalWindowManager = new TerminalWindowManagerClass(config);
    services.setProjectDirectoryPicker(async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return null;
        const res = await electron_1.dialog.showOpenDialog(win, {
            properties: ["openDirectory", "createDirectory", "showHiddenFiles"],
            title: "Select Project Directory",
            buttonLabel: "Select Project",
        });
        return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
    });
    services.setTerminalWindowManager(terminalWindowManager);
    (0, tokenizer_1.loadTokenizerModules)().catch((error) => {
        console.error("Failed to preload tokenizer modules:", error);
    });
    // Initialize updater service in packaged builds or when DEBUG_UPDATER is set
    // Moved to UpdateService (services.updateService)
    const loadTime = Date.now() - startTime;
    console.log(`[${timestamp()}] Services loaded in ${loadTime}ms`);
}
function createWindow() {
    (0, assert_1.default)(services, "Services must be loaded before creating window");
    // Calculate default window size (80% of screen)
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
    // Load saved window state with fallback to defaults
    const windowState = (0, electron_window_state_1.default)({
        defaultWidth: Math.max(1200, Math.floor(screenWidth * 0.8)),
        defaultHeight: Math.max(800, Math.floor(screenHeight * 0.8)),
    });
    console.log(`[${timestamp()}] [window] Creating BrowserWindow...`);
    mainWindow = new electron_1.BrowserWindow({
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "../preload.js"),
        },
        title: "DEV OS",
        // Hide menu bar on Linux by default (like VS Code)
        // User can press Alt to toggle it
        autoHideMenuBar: process.platform === "linux",
        show: false, // Don't show until ready-to-show event
        // VSCode-like integrated titlebar (hidden native titlebar with native window controls)
        ...(0, titleBarOptions_1.getTitleBarOptions)(),
    });
    // Track window state (handles resize, move, maximize, fullscreen)
    windowState.manage(mainWindow);
    // Register window service with the main window
    console.log(`[${timestamp()}] [window] Registering window service...`);
    services.windowService.setMainWindow(mainWindow);
    // Show window once it's ready and close splash
    console.time("main window startup");
    mainWindow.once("ready-to-show", () => {
        console.log(`[${timestamp()}] Main window ready to show`);
        mainWindow?.show();
        closeSplashScreen();
        console.timeEnd("main window startup");
    });
    // Open all external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
        const currentOrigin = new URL(mainWindow.webContents.getURL()).origin;
        const targetOrigin = new URL(url).origin;
        // Prevent navigation away from app origin, open externally instead
        if (targetOrigin !== currentOrigin) {
            event.preventDefault();
            void electron_1.shell.openExternal(url);
        }
    });
    // Load from dev server in development, built files in production
    // app.isPackaged is true when running from a built .app/.exe, false in development
    console.log(`[${timestamp()}] [window] Loading content...`);
    console.time("[window] Content load");
    if ((isE2ETest && !forceDistLoad) || (!electron_1.app.isPackaged && !forceDistLoad)) {
        // Development mode: load from vite dev server
        const devHost = process.env.UNIX_DEVSERVER_HOST ?? "127.0.0.1";
        const url = `http://${devHost}:${devServerPort}`;
        console.log(`[${timestamp()}] [window] Loading from dev server: ${url}`);
        void mainWindow.loadURL(url);
        if (!isE2ETest) {
            mainWindow.webContents.once("did-finish-load", () => {
                mainWindow?.webContents.openDevTools();
            });
        }
    }
    else {
        // Production mode: load built files
        const htmlPath = path.join(__dirname, "../index.html");
        console.log(`[${timestamp()}] [window] Loading from file: ${htmlPath}`);
        void mainWindow.loadFile(htmlPath);
    }
    // Track when content finishes loading
    mainWindow.webContents.once("did-finish-load", () => {
        console.timeEnd("[window] Content load");
        console.log(`[${timestamp()}] [window] Content finished loading`);
        // NOTE: Tokenizer modules are NOT loaded at startup anymore!
        // The Proxy in tokenizer.ts loads them on-demand when first accessed.
        // This reduces startup time from ~8s to <1s.
        // First token count will use approximation, accurate count caches in background.
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// Only setup app handlers if we got the lock
if (gotTheLock) {
    void electron_1.app.whenReady().then(async () => {
        try {
            console.log("App ready, creating window...");
            // Migrate from .cmux to .unix directory structure if needed
            (0, paths_1.migrateLegacyUnixHome)();
            // Install React DevTools in development
            if (!electron_1.app.isPackaged) {
                try {
                    const { default: installExtension, REACT_DEVELOPER_TOOLS } = 
                    // eslint-disable-next-line no-restricted-syntax -- dev-only dependency, intentionally lazy-loaded
                    await Promise.resolve().then(() => __importStar(require("electron-devtools-installer")));
                    const extension = await installExtension(REACT_DEVELOPER_TOOLS, {
                        loadExtensionOptions: { allowFileAccess: true },
                    });
                    console.log(`✅ React DevTools installed: ${extension.name} (id: ${extension.id})`);
                }
                catch (err) {
                    console.log("❌ Error installing React DevTools:", err);
                }
            }
            createMenu();
            // Three-phase startup:
            // 1. Show splash immediately (<100ms) and wait for it to load
            // 2. Load services while splash visible (fast - ~100ms)
            // 3. Create window and start loading content (splash stays visible)
            // 4. When window ready-to-show: close splash, show main window
            //
            // Skip splash in E2E tests to avoid app.firstWindow() grabbing the wrong window
            if (!isE2ETest) {
                await showSplashScreen(); // Wait for splash to actually load
            }
            await loadServices();
            createWindow();
            // Note: splash closes in ready-to-show event handler
            // Tokenizer modules load in background after did-finish-load event (see createWindow())
        }
        catch (error) {
            console.error(`[${timestamp()}] Startup failed:`, error);
            closeSplashScreen();
            // Show error dialog to user
            const errorMessage = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
            electron_1.dialog.showErrorBox("Startup Failed", `The application failed to start:\n\n${errorMessage}\n\nPlease check the console for details.`);
            // Quit after showing error
            electron_1.app.quit();
        }
    });
    // Track if we're in the middle of disposing to prevent re-entry
    let isDisposing = false;
    electron_1.app.on("before-quit", (event) => {
        // Skip if already disposing or no services to clean up
        if (isDisposing || !services) {
            return;
        }
        // Prevent quit, clean up, then quit again
        event.preventDefault();
        isDisposing = true;
        // Race dispose against timeout to ensure app quits even if disposal hangs
        const disposePromise = services.dispose().catch((err) => {
            console.error("Error during ServiceContainer dispose:", err);
        });
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));
        void Promise.race([disposePromise, timeoutPromise]).finally(() => {
            electron_1.app.quit();
        });
    });
    electron_1.app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            electron_1.app.quit();
        }
    });
    electron_1.app.on("before-quit", () => {
        console.log(`[${timestamp()}] App before-quit - cleaning up...`);
        if (services) {
            void services.serverService.stopServer();
            void services.shutdown();
        }
    });
    electron_1.app.on("activate", () => {
        // Skip splash on reactivation - services already loaded, window creation is fast
        // Guard: services must be loaded (prevents race if activate fires during startup)
        if (electron_1.app.isReady() && mainWindow === null && services) {
            createWindow();
        }
    });
}
//# sourceMappingURL=main.js.map