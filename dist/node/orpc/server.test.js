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
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const server_1 = require("./server");
function getErrorCode(error) {
    if (typeof error !== "object" || error === null) {
        return null;
    }
    if (!("code" in error)) {
        return null;
    }
    const code = error.code;
    return typeof code === "string" ? code : null;
}
(0, bun_test_1.describe)("createOrpcServer", () => {
    (0, bun_test_1.test)("serveStatic fallback does not swallow /api routes", async () => {
        // Minimal context stub - router won't be exercised by this test.
        const stubContext = {};
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unix-static-"));
        const indexHtml = "<!doctype html><html><head><title>unix</title></head><body><div>ok</div></body></html>";
        let server = null;
        try {
            await fs.writeFile(path.join(tempDir, "index.html"), indexHtml, "utf-8");
            server = await (0, server_1.createOrpcServer)({
                host: "127.0.0.1",
                port: 0,
                context: stubContext,
                authToken: "test-token",
                serveStatic: true,
                staticDir: tempDir,
            });
            const uiRes = await fetch(`${server.baseUrl}/some/spa/route`);
            (0, bun_test_1.expect)(uiRes.status).toBe(200);
            const uiText = await uiRes.text();
            (0, bun_test_1.expect)(uiText).toContain("unix");
            (0, bun_test_1.expect)(uiText).toContain('<base href="/"');
            const apiRes = await fetch(`${server.baseUrl}/api/not-a-real-route`);
            (0, bun_test_1.expect)(apiRes.status).toBe(404);
        }
        finally {
            await server?.close();
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });
    (0, bun_test_1.test)("brackets IPv6 hosts in returned URLs", async () => {
        // Minimal context stub - router won't be exercised by this test.
        const stubContext = {};
        let server = null;
        try {
            server = await (0, server_1.createOrpcServer)({
                host: "::1",
                port: 0,
                context: stubContext,
                authToken: "test-token",
            });
        }
        catch (error) {
            const code = getErrorCode(error);
            // Some CI environments may not have IPv6 enabled.
            if (code === "EAFNOSUPPORT" || code === "EADDRNOTAVAIL") {
                return;
            }
            throw error;
        }
        try {
            (0, bun_test_1.expect)(server.baseUrl).toMatch(/^http:\/\/\[::1\]:\d+$/);
            (0, bun_test_1.expect)(server.wsUrl).toMatch(/^ws:\/\/\[::1\]:\d+\/orpc\/ws$/);
            (0, bun_test_1.expect)(server.specUrl).toMatch(/^http:\/\/\[::1\]:\d+\/api\/spec\.json$/);
            (0, bun_test_1.expect)(server.docsUrl).toMatch(/^http:\/\/\[::1\]:\d+\/api\/docs$/);
        }
        finally {
            await server.close();
        }
    });
});
//# sourceMappingURL=server.test.js.map