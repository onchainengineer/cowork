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
exports.UpdateService = void 0;
const log_1 = require("../../node/services/log");
const env_1 = require("../../common/utils/env");
class UpdateService {
    impl = null;
    currentStatus = { type: "idle" };
    subscribers = new Set();
    constructor() {
        this.initialize().catch((err) => {
            log_1.log.error("Failed to initialize UpdateService:", err);
        });
    }
    async initialize() {
        // Check if running in Electron Main process
        if (process.versions.electron) {
            try {
                // Dynamic import to avoid loading electron-updater in CLI
                // eslint-disable-next-line no-restricted-syntax
                const { UpdaterService: DesktopUpdater } = await Promise.resolve().then(() => __importStar(require("../../desktop/updater")));
                this.impl = new DesktopUpdater();
                // Forward updates
                this.impl.subscribe((status) => {
                    this.currentStatus = status;
                    this.notifySubscribers();
                });
                // Sync initial status
                this.currentStatus = this.impl.getStatus();
            }
            catch (err) {
                log_1.log.debug("UpdateService: Failed to load desktop updater (likely CLI mode or missing dep):", err);
            }
        }
    }
    async check() {
        if (this.impl) {
            if (process.versions.electron) {
                try {
                    // eslint-disable-next-line no-restricted-syntax
                    const { app } = await Promise.resolve().then(() => __importStar(require("electron")));
                    const debugConfig = (0, env_1.parseDebugUpdater)(process.env.DEBUG_UPDATER);
                    if (!app.isPackaged && !debugConfig.enabled) {
                        log_1.log.debug("UpdateService: Updates disabled in dev mode");
                        // Ensure status is idle so frontend doesn't show spinner.
                        // Always notify so frontend clears isCheckingOnHover state.
                        this.currentStatus = { type: "idle" };
                        this.notifySubscribers();
                        return;
                    }
                }
                catch (err) {
                    // Ignore errors (e.g. if modules not found), proceed to check
                    log_1.log.debug("UpdateService: Error checking env:", err);
                }
            }
            this.impl.checkForUpdates();
        }
        else {
            log_1.log.debug("UpdateService: check() called but no implementation (CLI mode)");
        }
    }
    async download() {
        if (this.impl) {
            await this.impl.downloadUpdate();
        }
    }
    install() {
        if (this.impl) {
            this.impl.installUpdate();
        }
    }
    onStatus(callback) {
        // Send current status immediately
        callback(this.currentStatus);
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }
    notifySubscribers() {
        for (const sub of this.subscribers) {
            try {
                sub(this.currentStatus);
            }
            catch (err) {
                log_1.log.error("Error in UpdateService subscriber:", err);
            }
        }
    }
}
exports.UpdateService = UpdateService;
//# sourceMappingURL=updateService.js.map