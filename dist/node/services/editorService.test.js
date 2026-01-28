"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const editorService_1 = require("./editorService");
(0, bun_test_1.describe)("EditorService", () => {
    (0, bun_test_1.test)("rejects non-custom editors (renderer must use deep links)", async () => {
        const editorService = new editorService_1.EditorService({});
        const result = await editorService.openInEditor("ws1", "/tmp", {
            editor: "vscode",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("deep links");
        }
    });
    (0, bun_test_1.test)("validates custom editor executable exists before spawning", async () => {
        const workspace = {
            id: "ws1",
            name: "ws1",
            projectName: "proj",
            projectPath: "/tmp/proj",
            createdAt: "2025-01-01T00:00:00.000Z",
            runtimeConfig: { type: "worktree", srcBaseDir: "/tmp/src" },
            namedWorkspacePath: "/tmp/src/proj/ws1",
        };
        const mockConfig = {
            getAllWorkspaceMetadata: () => Promise.resolve([workspace]),
        };
        const editorService = new editorService_1.EditorService(mockConfig);
        const result = await editorService.openInEditor("ws1", "/tmp", {
            editor: "custom",
            customCommand: "definitely-not-a-command",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Editor command not found");
        }
    });
    (0, bun_test_1.test)("errors on invalid custom editor command quoting", async () => {
        const workspace = {
            id: "ws1",
            name: "ws1",
            projectName: "proj",
            projectPath: "/tmp/proj",
            createdAt: "2025-01-01T00:00:00.000Z",
            runtimeConfig: { type: "worktree", srcBaseDir: "/tmp/src" },
            namedWorkspacePath: "/tmp/src/proj/ws1",
        };
        const mockConfig = {
            getAllWorkspaceMetadata: () => Promise.resolve([workspace]),
        };
        const editorService = new editorService_1.EditorService(mockConfig);
        const result = await editorService.openInEditor("ws1", "/tmp", {
            editor: "custom",
            customCommand: '"unterminated',
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("Invalid custom editor command");
        }
    });
});
//# sourceMappingURL=editorService.test.js.map