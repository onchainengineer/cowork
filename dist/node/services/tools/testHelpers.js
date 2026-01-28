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
exports.TestTempDir = void 0;
exports.createTestToolConfig = createTestToolConfig;
exports.getTestDeps = getTestDeps;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const LocalRuntime_1 = require("../../../node/runtime/LocalRuntime");
const initStateManager_1 = require("../../../node/services/initStateManager");
const config_1 = require("../../../node/config");
const log_1 = require("../../../node/services/log");
/**
 * Disposable test temp directory that auto-cleans when disposed
 * Use with `using` statement for automatic cleanup in tests
 */
class TestTempDir {
    path;
    constructor(prefix = "test-tool") {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.path = path.join(os.tmpdir(), `${prefix}-${id}`);
        fs.mkdirSync(this.path, { recursive: true });
    }
    [Symbol.dispose]() {
        if (fs.existsSync(this.path)) {
            try {
                fs.rmSync(this.path, { recursive: true, force: true });
            }
            catch (error) {
                log_1.log.warn(`Failed to cleanup test temp dir ${this.path}:`, error);
            }
        }
    }
}
exports.TestTempDir = TestTempDir;
// Singleton instances for test configuration (shared across all test tool configs)
let testConfig = null;
let testInitStateManager = null;
function getTestConfig() {
    testConfig ?? (testConfig = new config_1.Config());
    return testConfig;
}
function getTestInitStateManager() {
    testInitStateManager ?? (testInitStateManager = new initStateManager_1.InitStateManager(getTestConfig()));
    return testInitStateManager;
}
/**
 * Create basic tool configuration for testing.
 * Returns a config object with default values that can be overridden.
 * Uses tempDir for both cwd and sessionsDir to isolate tests.
 */
function createTestToolConfig(tempDir, options) {
    return {
        cwd: tempDir,
        workspaceSessionDir: options?.sessionsDir ?? tempDir,
        runtime: new LocalRuntime_1.LocalRuntime(tempDir),
        runtimeTempDir: tempDir,
        workspaceId: options?.workspaceId ?? "test-workspace",
    };
}
/**
 * Get shared test config and initStateManager for inline tool configs in tests.
 * Use this when creating tool configs inline in tests.
 */
function getTestDeps() {
    return {
        workspaceId: "test-workspace",
        initStateManager: getTestInitStateManager(),
    };
}
//# sourceMappingURL=testHelpers.js.map