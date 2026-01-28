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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const workspaceService_1 = require("./workspaceService");
const events_1 = require("events");
const fsPromises = __importStar(require("fs/promises"));
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
// Helper to access private renamingWorkspaces set
function addToRenamingWorkspaces(service, workspaceId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    service.renamingWorkspaces.add(workspaceId);
}
async function withTempMuxRoot(fn) {
    const originalMuxRoot = process.env.UNIX_ROOT;
    const tempRoot = await fsPromises.mkdtemp(path_1.default.join((0, os_1.tmpdir)(), "unix-plan-"));
    process.env.UNIX_ROOT = tempRoot;
    try {
        return await fn(tempRoot);
    }
    finally {
        if (originalMuxRoot === undefined) {
            delete process.env.UNIX_ROOT;
        }
        else {
            process.env.UNIX_ROOT = originalMuxRoot;
        }
        await fsPromises.rm(tempRoot, { recursive: true, force: true });
    }
}
async function writePlanFile(root, projectName, workspaceName) {
    const planDir = path_1.default.join(root, "plans", projectName);
    await fsPromises.mkdir(planDir, { recursive: true });
    const planFile = path_1.default.join(planDir, `${workspaceName}.md`);
    await fsPromises.writeFile(planFile, "# Plan\n");
    return planFile;
}
// NOTE: This test file uses bun:test mocks (not Jest).
(0, bun_test_1.describe)("WorkspaceService rename lock", () => {
    let workspaceService;
    let mockAIService;
    (0, bun_test_1.beforeEach)(() => {
        // Create minimal mocks for the services
        mockAIService = {
            isStreaming: (0, bun_test_1.mock)(() => false),
            getWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve({ success: false, error: "not found" })),
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            on: (0, bun_test_1.mock)(() => { }),
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            off: (0, bun_test_1.mock)(() => { }),
        };
        const mockHistoryService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: [] })),
            appendToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const mockConfig = {
            srcDir: "/tmp/test",
            getSessionDir: (0, bun_test_1.mock)(() => "/tmp/test/sessions"),
            generateStableId: (0, bun_test_1.mock)(() => "test-id"),
            findWorkspace: (0, bun_test_1.mock)(() => null),
        };
        const mockPartialService = {
            commitToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const mockInitStateManager = {};
        const mockExtensionMetadataService = {};
        const mockBackgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
        };
        workspaceService = new workspaceService_1.WorkspaceService(mockConfig, mockHistoryService, mockPartialService, mockAIService, mockInitStateManager, mockExtensionMetadataService, mockBackgroundProcessManager);
    });
    (0, bun_test_1.test)("sendMessage returns error when workspace is being renamed", async () => {
        const workspaceId = "test-workspace";
        addToRenamingWorkspaces(workspaceService, workspaceId);
        const result = await workspaceService.sendMessage(workspaceId, "test message", {
            model: "test-model",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            const error = result.error;
            // Error is SendMessageError which has a discriminated union
            (0, bun_test_1.expect)(typeof error === "object" && error.type === "unknown").toBe(true);
            if (typeof error === "object" && error.type === "unknown") {
                (0, bun_test_1.expect)(error.raw).toContain("being renamed");
            }
        }
    });
    (0, bun_test_1.test)("resumeStream returns error when workspace is being renamed", async () => {
        const workspaceId = "test-workspace";
        addToRenamingWorkspaces(workspaceService, workspaceId);
        const result = await workspaceService.resumeStream(workspaceId, {
            model: "test-model",
            agentId: "exec",
        });
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            const error = result.error;
            // Error is SendMessageError which has a discriminated union
            (0, bun_test_1.expect)(typeof error === "object" && error.type === "unknown").toBe(true);
            if (typeof error === "object" && error.type === "unknown") {
                (0, bun_test_1.expect)(error.raw).toContain("being renamed");
            }
        }
    });
    (0, bun_test_1.test)("rename returns error when workspace is streaming", async () => {
        const workspaceId = "test-workspace";
        // Mock isStreaming to return true
        mockAIService.isStreaming.mockReturnValue(true);
        const result = await workspaceService.rename(workspaceId, "new-name");
        (0, bun_test_1.expect)(result.success).toBe(false);
        if (!result.success) {
            (0, bun_test_1.expect)(result.error).toContain("stream is active");
        }
    });
});
(0, bun_test_1.describe)("WorkspaceService post-compaction metadata refresh", () => {
    let workspaceService;
    (0, bun_test_1.beforeEach)(() => {
        const aiService = {
            isStreaming: (0, bun_test_1.mock)(() => false),
            getWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve({ success: false, error: "not found" })),
            on(_eventName, _listener) {
                return this;
            },
            off(_eventName, _listener) {
                return this;
            },
        };
        const mockHistoryService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: [] })),
            appendToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const mockConfig = {
            srcDir: "/tmp/test",
            getSessionDir: (0, bun_test_1.mock)(() => "/tmp/test/sessions"),
            generateStableId: (0, bun_test_1.mock)(() => "test-id"),
            findWorkspace: (0, bun_test_1.mock)(() => null),
        };
        const mockPartialService = {
            commitToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const mockInitStateManager = {};
        const mockExtensionMetadataService = {};
        const mockBackgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
        };
        workspaceService = new workspaceService_1.WorkspaceService(mockConfig, mockHistoryService, mockPartialService, aiService, mockInitStateManager, mockExtensionMetadataService, mockBackgroundProcessManager);
    });
    (0, bun_test_1.test)("returns expanded plan path for local runtimes", async () => {
        await withTempMuxRoot(async (muxRoot) => {
            const workspaceId = "ws-plan-path";
            const workspaceName = "plan-workspace";
            const projectName = "cmux";
            const planFile = await writePlanFile(muxRoot, projectName, workspaceName);
            const fakeMetadata = {
                id: workspaceId,
                name: workspaceName,
                projectName,
                projectPath: "/tmp/proj",
                namedWorkspacePath: "/tmp/proj/plan-workspace",
                runtimeConfig: { type: "local", srcBaseDir: "/tmp" },
            };
            const svc = workspaceService;
            svc.getInfo = (0, bun_test_1.mock)(() => Promise.resolve(fakeMetadata));
            const result = await workspaceService.getPostCompactionState(workspaceId);
            (0, bun_test_1.expect)(result.planPath).toBe(planFile);
            (0, bun_test_1.expect)(result.planPath?.startsWith("~")).toBe(false);
        });
    });
    (0, bun_test_1.test)("debounces multiple refresh requests into a single metadata emit", async () => {
        const workspaceId = "ws-post-compaction";
        const emitMetadata = (0, bun_test_1.mock)(() => undefined);
        const svc = workspaceService;
        svc.sessions.set(workspaceId, { emitMetadata });
        const fakeMetadata = {
            id: workspaceId,
            name: "ws",
            projectName: "proj",
            projectPath: "/tmp/proj",
            namedWorkspacePath: "/tmp/proj/ws",
            runtimeConfig: { type: "local", srcBaseDir: "/tmp" },
        };
        const getInfoMock = (0, bun_test_1.mock)(() => Promise.resolve(fakeMetadata));
        const postCompactionState = {
            planPath: "~/.unix/plans/cmux/plan.md",
            trackedFilePaths: ["/tmp/proj/file.ts"],
            excludedItems: [],
        };
        const getPostCompactionStateMock = (0, bun_test_1.mock)(() => Promise.resolve(postCompactionState));
        svc.getInfo = getInfoMock;
        svc.getPostCompactionState = getPostCompactionStateMock;
        svc.schedulePostCompactionMetadataRefresh(workspaceId);
        svc.schedulePostCompactionMetadataRefresh(workspaceId);
        svc.schedulePostCompactionMetadataRefresh(workspaceId);
        // Debounce is short, but use a safe buffer.
        await new Promise((resolve) => setTimeout(resolve, 150));
        (0, bun_test_1.expect)(getInfoMock).toHaveBeenCalledTimes(1);
        (0, bun_test_1.expect)(getPostCompactionStateMock).toHaveBeenCalledTimes(1);
        (0, bun_test_1.expect)(emitMetadata).toHaveBeenCalledTimes(1);
        const enriched = emitMetadata.mock.calls[0][0];
        (0, bun_test_1.expect)(enriched.postCompaction?.planPath).toBe(postCompactionState.planPath);
    });
});
(0, bun_test_1.describe)("WorkspaceService maybePersistAISettingsFromOptions", () => {
    let workspaceService;
    (0, bun_test_1.beforeEach)(() => {
        const aiService = {
            isStreaming: (0, bun_test_1.mock)(() => false),
            getWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve({ success: false, error: "nope" })),
            on(_eventName, _listener) {
                return this;
            },
            off(_eventName, _listener) {
                return this;
            },
        };
        const mockHistoryService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: [] })),
            appendToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const mockConfig = {
            srcDir: "/tmp/test",
            getSessionDir: (0, bun_test_1.mock)(() => "/tmp/test/sessions"),
            generateStableId: (0, bun_test_1.mock)(() => "test-id"),
            findWorkspace: (0, bun_test_1.mock)(() => null),
        };
        const mockPartialService = {
            commitToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const mockInitStateManager = {};
        const mockExtensionMetadataService = {};
        const mockBackgroundProcessManager = {
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
        };
        workspaceService = new workspaceService_1.WorkspaceService(mockConfig, mockHistoryService, mockPartialService, aiService, mockInitStateManager, mockExtensionMetadataService, mockBackgroundProcessManager);
    });
    (0, bun_test_1.test)("persists agent AI settings for custom agent", async () => {
        const persistSpy = (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: true }));
        const svc = workspaceService;
        svc.persistWorkspaceAISettingsForAgent = persistSpy;
        await svc.maybePersistAISettingsFromOptions("ws", {
            agentId: "reviewer",
            model: "openai:gpt-4o-mini",
            thinkingLevel: "off",
        }, "send");
        (0, bun_test_1.expect)(persistSpy).toHaveBeenCalledTimes(1);
    });
    (0, bun_test_1.test)("persists agent AI settings when agentId matches", async () => {
        const persistSpy = (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: true }));
        const svc = workspaceService;
        svc.persistWorkspaceAISettingsForAgent = persistSpy;
        await svc.maybePersistAISettingsFromOptions("ws", {
            agentId: "exec",
            model: "openai:gpt-4o-mini",
            thinkingLevel: "off",
        }, "send");
        (0, bun_test_1.expect)(persistSpy).toHaveBeenCalledTimes(1);
    });
});
(0, bun_test_1.describe)("WorkspaceService remove timing rollup", () => {
    (0, bun_test_1.test)("waits for stream-abort before rolling up session timing", async () => {
        const workspaceId = "child-ws";
        const parentWorkspaceId = "parent-ws";
        const tempRoot = await fsPromises.mkdtemp(path_1.default.join((0, os_1.tmpdir)(), "unix-remove-"));
        try {
            const sessionRoot = path_1.default.join(tempRoot, "sessions");
            await fsPromises.mkdir(path_1.default.join(sessionRoot, workspaceId), { recursive: true });
            let abortEmitted = false;
            let rollUpSawAbort = false;
            class FakeAIService extends events_1.EventEmitter {
                isStreaming = (0, bun_test_1.mock)(() => true);
                stopStream = (0, bun_test_1.mock)(() => {
                    setTimeout(() => {
                        abortEmitted = true;
                        this.emit("stream-abort", {
                            type: "stream-abort",
                            workspaceId,
                            messageId: "msg",
                            abortReason: "system",
                            metadata: { duration: 123 },
                            abandonPartial: true,
                        });
                    }, 0);
                    return Promise.resolve({ success: true, data: undefined });
                });
                getWorkspaceMetadata = (0, bun_test_1.mock)(() => Promise.resolve({
                    success: true,
                    data: {
                        id: workspaceId,
                        name: "child",
                        projectPath: "/tmp/proj",
                        runtimeConfig: { type: "local" },
                        parentWorkspaceId,
                    },
                }));
            }
            const aiService = new FakeAIService();
            const mockHistoryService = {};
            const mockPartialService = {};
            const mockInitStateManager = {};
            const mockExtensionMetadataService = {
                setStreaming: (0, bun_test_1.mock)((_workspaceId, streaming) => Promise.resolve({
                    recency: Date.now(),
                    streaming,
                    lastModel: null,
                    lastThinkingLevel: null,
                })),
                updateRecency: (0, bun_test_1.mock)((_workspaceId, timestamp) => Promise.resolve({
                    recency: timestamp ?? Date.now(),
                    streaming: false,
                    lastModel: null,
                    lastThinkingLevel: null,
                })),
            };
            const mockBackgroundProcessManager = {
                cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
            };
            const mockConfig = {
                srcDir: "/tmp/src",
                getSessionDir: (0, bun_test_1.mock)((id) => path_1.default.join(sessionRoot, id)),
                removeWorkspace: (0, bun_test_1.mock)(() => Promise.resolve()),
                findWorkspace: (0, bun_test_1.mock)(() => null),
            };
            const workspaceService = new workspaceService_1.WorkspaceService(mockConfig, mockHistoryService, mockPartialService, aiService, mockInitStateManager, mockExtensionMetadataService, mockBackgroundProcessManager);
            const timingService = {
                waitForIdle: (0, bun_test_1.mock)(() => Promise.resolve()),
                rollUpTimingIntoParent: (0, bun_test_1.mock)(() => {
                    rollUpSawAbort = abortEmitted;
                    return Promise.resolve({ didRollUp: true });
                }),
            };
            workspaceService.setSessionTimingService(timingService);
            const removeResult = await workspaceService.remove(workspaceId, true);
            (0, bun_test_1.expect)(removeResult.success).toBe(true);
            (0, bun_test_1.expect)(rollUpSawAbort).toBe(true);
        }
        finally {
            await fsPromises.rm(tempRoot, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=workspaceService.test.js.map