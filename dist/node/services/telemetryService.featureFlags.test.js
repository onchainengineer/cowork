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
const telemetryService_1 = require("./telemetryService");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
(0, bun_test_1.describe)("TelemetryService feature flag properties", () => {
    let tempDir;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-telemetry-test-"));
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("capture includes $feature/<flagKey> properties when set", () => {
        // The capture method checks isTelemetryDisabledByEnv which checks NODE_ENV=test,
        // JEST_WORKER_ID, VITEST, CI, etc. We need to temporarily clear these for the test.
        const savedEnv = {
            NODE_ENV: process.env.NODE_ENV,
            JEST_WORKER_ID: process.env.JEST_WORKER_ID,
            VITEST: process.env.VITEST,
            CI: process.env.CI,
            GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
            UNIX_DISABLE_TELEMETRY: process.env.UNIX_DISABLE_TELEMETRY,
            UNIX_E2E: process.env.UNIX_E2E,
            TEST_INTEGRATION: process.env.TEST_INTEGRATION,
        };
        // Clear all telemetry-disabling env vars
        process.env.NODE_ENV = "production";
        delete process.env.JEST_WORKER_ID;
        delete process.env.VITEST;
        delete process.env.CI;
        delete process.env.GITHUB_ACTIONS;
        delete process.env.UNIX_DISABLE_TELEMETRY;
        delete process.env.UNIX_E2E;
        delete process.env.TEST_INTEGRATION;
        try {
            const telemetry = new telemetryService_1.TelemetryService(tempDir);
            const capture = (0, bun_test_1.mock)((_args) => undefined);
            // NOTE: TelemetryService only checks that client + distinctId are set.
            // We set them directly to avoid any real network calls.
            // @ts-expect-error - Accessing private property for test
            telemetry.client = { capture };
            // @ts-expect-error - Accessing private property for test
            telemetry.distinctId = "distinct-id";
            telemetry.setFeatureFlagVariant("system-1", "test");
            const payload = {
                event: "message_sent",
                properties: {
                    workspaceId: "workspace-id",
                    model: "test-model",
                    agentId: "exec",
                    message_length_b2: 128,
                    runtimeType: "local",
                    frontendPlatform: {
                        userAgent: "ua",
                        platform: "platform",
                    },
                    thinkingLevel: "off",
                },
            };
            telemetry.capture(payload);
            (0, bun_test_1.expect)(capture).toHaveBeenCalled();
            const call = capture.mock.calls[0]?.[0];
            (0, bun_test_1.expect)(call?.properties).toBeDefined();
            (0, bun_test_1.expect)(call?.properties?.["$feature/system-1"]).toBe("test");
        }
        finally {
            // Restore all env vars
            for (const [key, value] of Object.entries(savedEnv)) {
                if (value === undefined) {
                    delete process.env[key];
                }
                else {
                    process.env[key] = value;
                }
            }
        }
    });
});
//# sourceMappingURL=telemetryService.featureFlags.test.js.map