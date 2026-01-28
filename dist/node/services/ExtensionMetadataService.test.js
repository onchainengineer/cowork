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
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path = __importStar(require("path"));
const ExtensionMetadataService_1 = require("./ExtensionMetadataService");
const PREFIX = "unix-extension-metadata-test-";
(0, bun_test_1.describe)("ExtensionMetadataService", () => {
    let tempDir;
    let filePath;
    let service;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = await (0, promises_1.mkdtemp)(path.join((0, os_1.tmpdir)(), PREFIX));
        filePath = path.join(tempDir, "extensionMetadata.json");
        service = new ExtensionMetadataService_1.ExtensionMetadataService(filePath);
        await service.initialize();
    });
    (0, bun_test_1.afterEach)(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    (0, bun_test_1.test)("updateRecency persists timestamp and getAllSnapshots mirrors it", async () => {
        const snapshot = await service.updateRecency("workspace-1", 123);
        (0, bun_test_1.expect)(snapshot.recency).toBe(123);
        (0, bun_test_1.expect)(snapshot.streaming).toBe(false);
        (0, bun_test_1.expect)(snapshot.lastModel).toBeNull();
        (0, bun_test_1.expect)(snapshot.lastThinkingLevel).toBeNull();
        const snapshots = await service.getAllSnapshots();
        (0, bun_test_1.expect)(snapshots.get("workspace-1")).toEqual(snapshot);
    });
    (0, bun_test_1.test)("setStreaming toggles status and remembers last model", async () => {
        await service.updateRecency("workspace-2", 200);
        const streaming = await service.setStreaming("workspace-2", true, "anthropic/sonnet", "high");
        (0, bun_test_1.expect)(streaming.streaming).toBe(true);
        (0, bun_test_1.expect)(streaming.lastModel).toBe("anthropic/sonnet");
        (0, bun_test_1.expect)(streaming.lastThinkingLevel).toBe("high");
        const cleared = await service.setStreaming("workspace-2", false);
        (0, bun_test_1.expect)(cleared.streaming).toBe(false);
        (0, bun_test_1.expect)(cleared.lastModel).toBe("anthropic/sonnet");
        (0, bun_test_1.expect)(cleared.lastThinkingLevel).toBe("high");
        const snapshots = await service.getAllSnapshots();
        (0, bun_test_1.expect)(snapshots.get("workspace-2")).toEqual(cleared);
    });
});
//# sourceMappingURL=ExtensionMetadataService.test.js.map