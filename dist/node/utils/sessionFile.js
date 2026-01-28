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
exports.SessionFileManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const result_1 = require("../../common/types/result");
const workspaceFileLocks_1 = require("../../node/utils/concurrency/workspaceFileLocks");
const log_1 = require("../../node/services/log");
/**
 * Shared utility for managing JSON files in workspace session directories.
 * Provides consistent file locking, error handling, and path resolution.
 *
 * Used by PartialService, InitStateManager, and other services that need
 * to persist state to ~/.unix/sessions/{workspaceId}/.
 */
class SessionFileManager {
    config;
    fileName;
    fileLocks = workspaceFileLocks_1.workspaceFileLocks;
    constructor(config, fileName) {
        this.config = config;
        this.fileName = fileName;
    }
    getFilePath(workspaceId) {
        return path.join(this.config.getSessionDir(workspaceId), this.fileName);
    }
    /**
     * Read JSON file from workspace session directory.
     * Returns null if file doesn't exist (not an error).
     */
    async read(workspaceId) {
        try {
            const filePath = this.getFilePath(workspaceId);
            const data = await fs.readFile(filePath, "utf-8");
            return JSON.parse(data);
        }
        catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                return null; // File doesn't exist
            }
            // Log other errors but don't fail
            log_1.log.error(`Error reading ${this.fileName}:`, error);
            return null;
        }
    }
    /**
     * Write JSON file to workspace session directory with file locking.
     * Creates session directory if it doesn't exist.
     */
    async write(workspaceId, data) {
        return this.fileLocks.withLock(workspaceId, async () => {
            try {
                const sessionDir = this.config.getSessionDir(workspaceId);
                await fs.mkdir(sessionDir, { recursive: true });
                const filePath = this.getFilePath(workspaceId);
                // Atomic write prevents corruption if app crashes mid-write
                await (0, write_file_atomic_1.default)(filePath, JSON.stringify(data, null, 2));
                return (0, result_1.Ok)(undefined);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return (0, result_1.Err)(`Failed to write ${this.fileName}: ${message}`);
            }
        });
    }
    /**
     * Delete JSON file from workspace session directory with file locking.
     * Idempotent - no error if file doesn't exist.
     */
    async delete(workspaceId) {
        return this.fileLocks.withLock(workspaceId, async () => {
            try {
                const filePath = this.getFilePath(workspaceId);
                await fs.unlink(filePath);
                return (0, result_1.Ok)(undefined);
            }
            catch (error) {
                if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                    return (0, result_1.Ok)(undefined); // Already deleted
                }
                const message = error instanceof Error ? error.message : String(error);
                return (0, result_1.Err)(`Failed to delete ${this.fileName}: ${message}`);
            }
        });
    }
}
exports.SessionFileManager = SessionFileManager;
//# sourceMappingURL=sessionFile.js.map