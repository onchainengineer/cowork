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
exports.DisposableTempDir = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const log_1 = require("../../node/services/log");
/**
 * Disposable temporary directory that auto-cleans when disposed
 * Use with `using` statement for automatic cleanup
 */
class DisposableTempDir {
    path;
    constructor(prefix = "unix-temp") {
        // Create unique temp directory
        const id = Math.random().toString(16).substring(2, 10);
        this.path = path.join(os.tmpdir(), `${prefix}-${id}`);
        fs.mkdirSync(this.path, { recursive: true, mode: 0o700 });
    }
    [Symbol.dispose]() {
        // Clean up temp directory
        if (fs.existsSync(this.path)) {
            try {
                fs.rmSync(this.path, { recursive: true, force: true });
            }
            catch (error) {
                log_1.log.warn(`Failed to cleanup temp dir ${this.path}:`, error);
                // Don't throw - cleanup is best-effort
            }
        }
    }
}
exports.DisposableTempDir = DisposableTempDir;
//# sourceMappingURL=tempDir.js.map