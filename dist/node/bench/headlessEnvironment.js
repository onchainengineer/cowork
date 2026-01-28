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
exports.createHeadlessEnvironment = createHeadlessEnvironment;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const electron_mock_ipc_1 = __importDefault(require("electron-mock-ipc"));
const config_1 = require("../../node/config");
const serviceContainer_1 = require("../../node/services/serviceContainer");
function createMockBrowserWindow() {
    const sentEvents = [];
    const mockWindow = {
        webContents: {
            send: (channel, data) => {
                sentEvents.push({ channel, data });
            },
            openDevTools: () => {
                throw new Error("openDevTools is not supported in headless mode");
            },
        },
        isMinimized: () => false,
        restore: () => undefined,
        focus: () => undefined,
        loadURL: () => {
            throw new Error("loadURL should not be called in headless mode");
        },
        on: () => undefined,
        setTitle: () => undefined,
    };
    return { window: mockWindow, sentEvents };
}
async function establishRootDir(providedRootDir) {
    if (providedRootDir) {
        return {
            rootDir: providedRootDir,
            dispose: async () => {
                // Caller owns the directory; nothing to clean up.
            },
        };
    }
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "unix-headless-"));
    return {
        rootDir: tempRoot,
        dispose: async () => {
            await fs.rm(tempRoot, { recursive: true, force: true });
        },
    };
}
function assertMockedElectron(mocked) {
    if (!mocked || typeof mocked !== "object") {
        throw new Error("Failed to initialize electron-mock-ipc");
    }
    if (!("ipcMain" in mocked) || !mocked.ipcMain) {
        throw new Error("electron-mock-ipc returned an invalid ipcMain");
    }
    if (!("ipcRenderer" in mocked) || !mocked.ipcRenderer) {
        throw new Error("electron-mock-ipc returned an invalid ipcRenderer");
    }
}
async function createHeadlessEnvironment(options = {}) {
    const { rootDir, dispose: disposeRootDir } = await establishRootDir(options.rootDir);
    const config = new config_1.Config(rootDir);
    const { window: mockWindow, sentEvents } = createMockBrowserWindow();
    const mockedElectron = (0, electron_mock_ipc_1.default)();
    assertMockedElectron(mockedElectron);
    const mockIpcMainModule = mockedElectron.ipcMain;
    const mockIpcRendererModule = mockedElectron.ipcRenderer;
    const services = new serviceContainer_1.ServiceContainer(config);
    await services.initialize();
    services.windowService.setMainWindow(mockWindow);
    const dispose = async () => {
        sentEvents.length = 0;
        await disposeRootDir();
    };
    return {
        config,
        services,
        mockIpcMain: mockIpcMainModule,
        mockIpcRenderer: mockIpcRendererModule,
        mockWindow,
        sentEvents,
        rootDir,
        dispose,
    };
}
//# sourceMappingURL=headlessEnvironment.js.map