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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const config_1 = require("../../node/config");
const providerService_1 = require("./providerService");
(0, bun_test_1.describe)("ProviderService.getConfig", () => {
    (0, bun_test_1.it)("surfaces valid OpenAI serviceTier", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unix-provider-service-"));
        try {
            const config = new config_1.Config(tmpDir);
            config.saveProvidersConfig({
                openai: {
                    apiKey: "sk-test",
                    serviceTier: "flex",
                },
            });
            const service = new providerService_1.ProviderService(config);
            const cfg = service.getConfig();
            (0, bun_test_1.expect)(cfg.openai.apiKeySet).toBe(true);
            (0, bun_test_1.expect)(cfg.openai.serviceTier).toBe("flex");
            (0, bun_test_1.expect)(Object.prototype.hasOwnProperty.call(cfg.openai, "serviceTier")).toBe(true);
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.it)("omits invalid OpenAI serviceTier", () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unix-provider-service-"));
        try {
            const config = new config_1.Config(tmpDir);
            config.saveProvidersConfig({
                openai: {
                    apiKey: "sk-test",
                    // Intentionally invalid
                    serviceTier: "fast",
                },
            });
            const service = new providerService_1.ProviderService(config);
            const cfg = service.getConfig();
            (0, bun_test_1.expect)(cfg.openai.apiKeySet).toBe(true);
            (0, bun_test_1.expect)(cfg.openai.serviceTier).toBeUndefined();
            (0, bun_test_1.expect)(Object.prototype.hasOwnProperty.call(cfg.openai, "serviceTier")).toBe(false);
        }
        finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=providerService.test.js.map