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
const file_edit_insert_1 = require("./file_edit_insert");
const runtimeFactory_1 = require("../../../node/runtime/runtimeFactory");
const testHelpers_1 = require("./testHelpers");
const mockToolCallOptions = {
    toolCallId: "test-call-id",
    messages: [],
};
function createTestTool(cwd) {
    return (0, file_edit_insert_1.createFileEditInsertTool)({
        ...(0, testHelpers_1.getTestDeps)(),
        cwd,
        runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: cwd }),
        runtimeTempDir: cwd,
    });
}
(0, bun_test_1.describe)("file_edit_insert tool", () => {
    let testDir;
    let testFilePath;
    (0, bun_test_1.beforeEach)(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "file-edit-insert-"));
        testFilePath = path.join(testDir, "test.txt");
        await fs.writeFile(testFilePath, "Line 1\nLine 3");
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("inserts content using before guard", async () => {
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "Line 2\n",
            before: "Line 1\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        const updated = await fs.readFile(testFilePath, "utf-8");
        (0, bun_test_1.expect)(updated).toBe("Line 1\nLine 2\nLine 3");
    });
    (0, bun_test_1.it)("inserts content using before guard when file uses CRLF", async () => {
        await fs.writeFile(testFilePath, "Line 1\r\nLine 3\r\n");
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "Line 2\n",
            before: "Line 1\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        const updated = await fs.readFile(testFilePath, "utf-8");
        (0, bun_test_1.expect)(updated).toBe("Line 1\r\nLine 2\r\nLine 3\r\n");
    });
    (0, bun_test_1.it)("inserts content using after guard", async () => {
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "Header\n",
            after: "Line 1",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(await fs.readFile(testFilePath, "utf-8")).toBe("Header\nLine 1\nLine 3");
    });
    (0, bun_test_1.it)("fails when guard matches multiple times", async () => {
        await fs.writeFile(testFilePath, "repeat\nrepeat\nrepeat\n");
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "middle\n",
            before: "repeat\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("multiple times");
        }
    });
    (0, bun_test_1.it)("fails when guard is not found and does not modify the file", async () => {
        const original = await fs.readFile(testFilePath, "utf-8");
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "Line 2\n",
            before: "does not exist\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        (0, bun_test_1.expect)(await fs.readFile(testFilePath, "utf-8")).toBe(original);
    });
    (0, bun_test_1.it)("fails when both before and after are provided", async () => {
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "oops",
            before: "Line 1",
            after: "Line 3",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("only one of before or after");
        }
    });
    (0, bun_test_1.it)("creates a new file without requiring create flag or guards", async () => {
        const newFile = path.join(testDir, "new.txt");
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, newFile),
            content: "Hello world!\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(await fs.readFile(newFile, "utf-8")).toBe("Hello world!\n");
    });
    (0, bun_test_1.it)("fails when no guards are provided", async () => {
        const tool = createTestTool(testDir);
        const args = {
            file_path: path.relative(testDir, testFilePath),
            content: "noop",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Provide either a before or after guard");
        }
    });
});
(0, bun_test_1.describe)("file_edit_insert plan mode enforcement", () => {
    let testDir;
    (0, bun_test_1.beforeEach)(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-mode-insert-"));
    });
    (0, bun_test_1.afterEach)(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });
    (0, bun_test_1.it)("blocks creating non-plan files when in plan mode", async () => {
        const planFilePath = path.join(testDir, "sessions", "workspace", "plan.md");
        const otherFilePath = path.join(testDir, "workspace", "main.ts");
        const workspaceCwd = path.join(testDir, "workspace");
        // Create workspace directory
        await fs.mkdir(workspaceCwd, { recursive: true });
        const tool = (0, file_edit_insert_1.createFileEditInsertTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: workspaceCwd,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: workspaceCwd }),
            runtimeTempDir: testDir,
            planFileOnly: true,
            planFilePath: planFilePath,
        });
        const args = {
            file_path: otherFilePath,
            content: "console.log('test');",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("In the plan agent, only the plan file can be edited");
        }
    });
    (0, bun_test_1.it)("allows creating plan file when in plan mode", async () => {
        const planFilePath = path.join(testDir, "plan.md");
        const workspaceCwd = path.join(testDir, "workspace");
        // Create workspace directory
        await fs.mkdir(workspaceCwd, { recursive: true });
        const tool = (0, file_edit_insert_1.createFileEditInsertTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: workspaceCwd,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: workspaceCwd }),
            runtimeTempDir: testDir,
            planFileOnly: true,
            planFilePath: planFilePath,
        });
        const args = {
            file_path: planFilePath,
            content: "# My Plan\n\n- Step 1\n- Step 2\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(await fs.readFile(planFilePath, "utf-8")).toBe("# My Plan\n\n- Step 1\n- Step 2\n");
    });
    (0, bun_test_1.it)("allows editing any file in exec mode", async () => {
        const testFilePath = path.join(testDir, "main.ts");
        await fs.writeFile(testFilePath, "const x = 1;");
        const tool = (0, file_edit_insert_1.createFileEditInsertTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: testDir,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: testDir }),
            runtimeTempDir: testDir,
        });
        const args = {
            file_path: testFilePath,
            content: "// header\n",
            after: "const x = 1;",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(true);
        (0, bun_test_1.expect)(await fs.readFile(testFilePath, "utf-8")).toBe("// header\nconst x = 1;");
    });
    (0, bun_test_1.it)("blocks creating .unix/plan.md (wrong path) when real plan file is elsewhere", async () => {
        // This test simulates the bug where an agent tries to create ".unix/plan.md"
        // in the workspace instead of using the actual plan file at ~/.unix/plans/project/workspace.md
        const workspaceCwd = path.join(testDir, "workspace");
        const wrongPlanPath = path.join(workspaceCwd, ".unix", "plan.md");
        const realPlanPath = path.join(testDir, "plans", "project", "workspace.md");
        // Create workspace directory (simulate a real project workspace)
        await fs.mkdir(workspaceCwd, { recursive: true });
        // Create the plans directory structure
        await fs.mkdir(path.dirname(realPlanPath), { recursive: true });
        const tool = (0, file_edit_insert_1.createFileEditInsertTool)({
            ...(0, testHelpers_1.getTestDeps)(),
            cwd: workspaceCwd,
            runtime: (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: workspaceCwd }),
            runtimeTempDir: testDir,
            planFileOnly: true,
            planFilePath: realPlanPath, // The REAL plan file path
        });
        // Agent mistakenly tries to create ".unix/plan.md" in workspace
        const args = {
            file_path: ".unix/plan.md", // Wrong path - relative to cwd
            content: "# My Plan\n\n- Step 1\n",
        };
        const result = (await tool.execute(args, mockToolCallOptions));
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("In the plan agent, only the plan file can be edited");
            (0, bun_test_1.expect)(result.error).toContain("exact plan file path");
            (0, bun_test_1.expect)(result.error).toContain(realPlanPath);
            (0, bun_test_1.expect)(result.error).toContain(".unix/plan.md");
        }
        // Ensure the wrong file was NOT created
        const wrongFileExists = await fs
            .stat(wrongPlanPath)
            .then(() => true)
            .catch(() => false);
        (0, bun_test_1.expect)(wrongFileExists).toBe(false);
    });
});
//# sourceMappingURL=file_edit_insert.test.js.map