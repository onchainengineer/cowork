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
const tildeExpansion_1 = require("./tildeExpansion");
(0, bun_test_1.describe)("expandTilde", () => {
    (0, bun_test_1.it)("should expand ~ to home directory", () => {
        const result = (0, tildeExpansion_1.expandTilde)("~");
        (0, bun_test_1.expect)(result).toBe(os.homedir());
    });
    (0, bun_test_1.it)("should expand ~/path to home directory + path", () => {
        const result = (0, tildeExpansion_1.expandTilde)("~/workspace");
        (0, bun_test_1.expect)(result).toBe(path.join(os.homedir(), "workspace"));
    });
    (0, bun_test_1.it)("should leave absolute paths unchanged", () => {
        const absolutePath = "/abs/path/to/dir";
        const result = (0, tildeExpansion_1.expandTilde)(absolutePath);
        (0, bun_test_1.expect)(result).toBe(absolutePath);
    });
    (0, bun_test_1.it)("should leave relative paths unchanged", () => {
        const relativePath = "relative/path";
        const result = (0, tildeExpansion_1.expandTilde)(relativePath);
        (0, bun_test_1.expect)(result).toBe(relativePath);
    });
    (0, bun_test_1.it)("should handle nested paths correctly", () => {
        const result = (0, tildeExpansion_1.expandTilde)("~/workspace/project/subdir");
        (0, bun_test_1.expect)(result).toBe(path.join(os.homedir(), "workspace/project/subdir"));
    });
});
//# sourceMappingURL=tildeExpansion.test.js.map