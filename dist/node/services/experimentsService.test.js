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
const experimentsService_1 = require("./experimentsService");
const experiments_1 = require("../../common/constants/experiments");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
(0, bun_test_1.describe)("ExperimentsService", () => {
    let tempDir;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-experiments-test-"));
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("loads cached experiment values from disk and exposes them", async () => {
        const cacheFilePath = path.join(tempDir, "feature_flags.json");
        await fs.writeFile(cacheFilePath, JSON.stringify({
            version: 1,
            experiments: {
                [experiments_1.EXPERIMENT_IDS.SYSTEM_1]: {
                    value: "test",
                    fetchedAtMs: Date.now(),
                },
            },
        }, null, 2), "utf-8");
        const setFeatureFlagVariant = (0, bun_test_1.mock)(() => undefined);
        const fakePostHog = {
            getFeatureFlag: (0, bun_test_1.mock)(() => Promise.resolve("test")),
        };
        const telemetryService = {
            getPostHogClient: (0, bun_test_1.mock)(() => fakePostHog),
            getDistinctId: (0, bun_test_1.mock)(() => "distinct-id"),
            setFeatureFlagVariant,
        };
        const service = new experimentsService_1.ExperimentsService({
            telemetryService,
            unixHome: tempDir,
            cacheTtlMs: 60 * 60 * 1000,
        });
        await service.initialize();
        const values = service.getAll();
        (0, bun_test_1.expect)(values[experiments_1.EXPERIMENT_IDS.SYSTEM_1]).toEqual({
            value: "test",
            source: "cache",
        });
        (0, bun_test_1.expect)(setFeatureFlagVariant).toHaveBeenCalledWith(experiments_1.EXPERIMENT_IDS.SYSTEM_1, "test");
    });
    (0, bun_test_1.test)("refreshExperiment updates cache and writes it to disk", async () => {
        const setFeatureFlagVariant = (0, bun_test_1.mock)(() => undefined);
        const fakePostHog = {
            getFeatureFlag: (0, bun_test_1.mock)(() => Promise.resolve("test")),
        };
        const telemetryService = {
            getPostHogClient: (0, bun_test_1.mock)(() => fakePostHog),
            getDistinctId: (0, bun_test_1.mock)(() => "distinct-id"),
            setFeatureFlagVariant,
        };
        const service = new experimentsService_1.ExperimentsService({
            telemetryService,
            unixHome: tempDir,
            cacheTtlMs: 0,
        });
        await service.initialize();
        await service.refreshExperiment(experiments_1.EXPERIMENT_IDS.SYSTEM_1);
        const value = service.getExperimentValue(experiments_1.EXPERIMENT_IDS.SYSTEM_1);
        (0, bun_test_1.expect)(value.value).toBe("test");
        (0, bun_test_1.expect)(value.source).toBe("posthog");
        const cacheFilePath = path.join(tempDir, "feature_flags.json");
        const disk = JSON.parse(await fs.readFile(cacheFilePath, "utf-8"));
        (0, bun_test_1.expect)(typeof disk).toBe("object");
        (0, bun_test_1.expect)(disk.version).toBe(1);
        (0, bun_test_1.expect)(disk.experiments).toHaveProperty(experiments_1.EXPERIMENT_IDS.SYSTEM_1);
        (0, bun_test_1.expect)(setFeatureFlagVariant).toHaveBeenCalledWith(experiments_1.EXPERIMENT_IDS.SYSTEM_1, "test");
    });
    (0, bun_test_1.test)("returns disabled when telemetry is disabled", async () => {
        const telemetryService = {
            getPostHogClient: (0, bun_test_1.mock)(() => null),
            getDistinctId: (0, bun_test_1.mock)(() => null),
            setFeatureFlagVariant: (0, bun_test_1.mock)(() => undefined),
        };
        const service = new experimentsService_1.ExperimentsService({ telemetryService, unixHome: tempDir });
        await service.initialize();
        const values = service.getAll();
        (0, bun_test_1.expect)(values[experiments_1.EXPERIMENT_IDS.SYSTEM_1]).toEqual({
            value: null,
            source: "disabled",
        });
        (0, bun_test_1.expect)(service.isExperimentEnabled(experiments_1.EXPERIMENT_IDS.SYSTEM_1)).toBe(false);
    });
});
//# sourceMappingURL=experimentsService.test.js.map