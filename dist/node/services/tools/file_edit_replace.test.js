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
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const file_edit_replace_string_1 = require("./file_edit_replace_string");
const file_edit_replace_lines_1 = require("./file_edit_replace_lines");
const runtimeFactory_1 = require("../../../node/runtime/runtimeFactory");
const testHelpers_1 = require("./testHelpers");
// Mock ToolCallOptions for testing
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
// Test helpers
const setupFile = async (filePath, content) => {
    await fs.writeFile(filePath, content);
};
const readFile = async (filePath) => {
    return await fs.readFile(filePath, "utf-8");
};
const executeStringReplace = async (tool, args) => {
    return (await tool.execute(args, mockToolCallOptions));
};
const executeLinesReplace = async (tool, args) => {
    return (await tool.execute(args, mockToolCallOptions));
};
(0, bun_test_1.describe)("file_edit_replace_string tool", () => {
    let testDir;
    let testFilePath;
    (0, bun_test_1.beforeEach)(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "fileEditReplace-test-"));
        testFilePath = path.join(testDir, "test.txt");
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("should apply a single edit successfully", async () => {
        await setupFile(testFilePath, "Hello world\nThis is a test\nGoodbye world");
        const tool = (0, file_edit_replace_string_1.createFileEditReplaceStringTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
            runtimeTempDir: "/tmp",
        });
        const payload = {
            file_path: "test.txt", // Use relative path
            old_string: "Hello world",
            new_string: "Hello universe",
        };
        const result = await executeStringReplace(tool, payload);
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.edits_applied).toBe(1);
        }
        (0, bun_test_1.expect)(await readFile(testFilePath)).toBe("Hello universe\nThis is a test\nGoodbye world");
    });
    (0, bun_test_1.it)("matches LF args against a CRLF file and preserves CRLF", async () => {
        await setupFile(testFilePath, "Hello world\r\nThis is a test\r\nGoodbye world\r\n");
        const tool = (0, file_edit_replace_string_1.createFileEditReplaceStringTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
            runtimeTempDir: "/tmp",
        });
        const payload = {
            file_path: "test.txt",
            old_string: "Hello world\nThis is a test\n",
            new_string: "Hello universe\nThis is a CRLF test\n",
        };
        const result = await executeStringReplace(tool, payload);
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(await readFile(testFilePath)).toBe("Hello universe\r\nThis is a CRLF test\r\nGoodbye world\r\n");
    });
    (0, bun_test_1.it)("does not modify the file when old_string is missing", async () => {
        const original = "Hello world\n";
        await setupFile(testFilePath, original);
        const tool = (0, file_edit_replace_string_1.createFileEditReplaceStringTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
            runtimeTempDir: "/tmp",
        });
        const payload = {
            file_path: "test.txt",
            old_string: "Goodbye world\n",
            new_string: "replaced\n",
        };
        const result = await executeStringReplace(tool, payload);
        (0, bun_test_1.expect)(result.success).toBe(false);
        (0, bun_test_1.expect)(await readFile(testFilePath)).toBe(original);
    });
    (0, bun_test_1.it)("does not modify the file when old_string is ambiguous", async () => {
        const original = "repeat\nrepeat\n";
        await setupFile(testFilePath, original);
        const tool = (0, file_edit_replace_string_1.createFileEditReplaceStringTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
            runtimeTempDir: "/tmp",
        });
        const payload = {
            file_path: "test.txt",
            old_string: "repeat",
            new_string: "REPLACED",
        };
        const result = await executeStringReplace(tool, payload);
        (0, bun_test_1.expect)(result.success).toBe(false);
        (0, bun_test_1.expect)(await readFile(testFilePath)).toBe(original);
    });
});
(0, bun_test_1.describe)("file_edit_replace_lines tool", () => {
    let testDir;
    let testFilePath;
    (0, bun_test_1.beforeEach)(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "fileEditReplace-test-"));
        testFilePath = path.join(testDir, "test.txt");
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("should replace a line range successfully", async () => {
        await setupFile(testFilePath, "line1\nline2\nline3\nline4");
        const tool = (0, file_edit_replace_lines_1.createFileEditReplaceLinesTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
            runtimeTempDir: "/tmp",
        });
        const payload = {
            file_path: "test.txt", // Use relative path
            start_line: 2,
            end_line: 3,
            new_lines: ["LINE2", "LINE3"],
        };
        const result = await executeLinesReplace(tool, payload);
        (0, bun_test_1.expect)(result.success).toBe(true);
        if (result.success) {
            (0, bun_test_1.expect)(result.lines_replaced).toBe(2);
            (0, bun_test_1.expect)(result.line_delta).toBe(0);
        }
        (0, bun_test_1.expect)(await readFile(testFilePath)).toBe("line1\nLINE2\nLINE3\nline4");
    });
    (0, bun_test_1.it)("preserves CRLF when replacing lines in a CRLF file", async () => {
        await setupFile(testFilePath, "line1\r\nline2\r\nline3\r\nline4");
        const tool = (0, file_edit_replace_lines_1.createFileEditReplaceLinesTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: "/tmp" }),
            runtimeTempDir: "/tmp",
        });
        const payload = {
            file_path: "test.txt",
            start_line: 2,
            end_line: 3,
            new_lines: ["LINE2", "LINE3"],
        };
        const result = await executeLinesReplace(tool, payload);
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(await readFile(testFilePath)).toBe("line1\r\nLINE2\r\nLINE3\r\nline4");
    });
});
//# sourceMappingURL=file_edit_replace.test.js.map