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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const LocalBaseRuntime_1 = require("./LocalBaseRuntime");
class TestLocalRuntime extends LocalBaseRuntime_1.LocalBaseRuntime {
    getWorkspacePath(_projectPath, _workspaceName) {
        return "/tmp/workspace";
    }
    createWorkspace(_params) {
        return Promise.resolve({ success: true, workspacePath: "/tmp/workspace" });
    }
    initWorkspace(_params) {
        return Promise.resolve({ success: true });
    }
    renameWorkspace(_projectPath, _oldName, _newName) {
        return Promise.resolve({ success: true, oldPath: "/tmp/workspace", newPath: "/tmp/workspace" });
    }
    deleteWorkspace(_projectPath, _workspaceName, _force) {
        return Promise.resolve({ success: true, deletedPath: "/tmp/workspace" });
    }
    forkWorkspace(_params) {
        return Promise.resolve({
            success: true,
            workspacePath: "/tmp/workspace",
            sourceBranch: "main",
        });
    }
}
(0, bun_test_1.describe)("LocalBaseRuntime.resolvePath", () => {
    (0, bun_test_1.it)("should expand tilde to home directory", async () => {
        const runtime = new TestLocalRuntime();
        const resolved = await runtime.resolvePath("~");
        (0, bun_test_1.expect)(resolved).toBe(os.homedir());
    });
    (0, bun_test_1.it)("should expand tilde with path", async () => {
        const runtime = new TestLocalRuntime();
        const resolved = await runtime.resolvePath("~/..");
        const expected = path.dirname(os.homedir());
        (0, bun_test_1.expect)(resolved).toBe(expected);
    });
    (0, bun_test_1.it)("should resolve absolute paths", async () => {
        const runtime = new TestLocalRuntime();
        const resolved = await runtime.resolvePath("/tmp");
        (0, bun_test_1.expect)(resolved).toBe("/tmp");
    });
    (0, bun_test_1.it)("should resolve non-existent paths without checking existence", async () => {
        const runtime = new TestLocalRuntime();
        const resolved = await runtime.resolvePath("/this/path/does/not/exist/12345");
        // Should resolve to absolute path without checking if it exists
        (0, bun_test_1.expect)(resolved).toBe("/this/path/does/not/exist/12345");
    });
    (0, bun_test_1.it)("should resolve relative paths from cwd", async () => {
        const runtime = new TestLocalRuntime();
        const resolved = await runtime.resolvePath(".");
        // Should resolve to absolute path
        (0, bun_test_1.expect)(path.isAbsolute(resolved)).toBe(true);
    });
});
//# sourceMappingURL=LocalBaseRuntime.test.js.map