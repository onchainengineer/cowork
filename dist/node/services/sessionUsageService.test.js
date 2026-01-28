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
const sessionUsageService_1 = require("./sessionUsageService");
const config_1 = require("../../node/config");
const message_1 = require("../../common/types/message");
const result_1 = require("../../common/types/result");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function createMockHistoryService(messages = []) {
    return {
        getHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(messages))),
        appendToHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined))),
        updateHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined))),
        truncateAfterMessage: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)(undefined))),
        clearHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)([]))),
    };
}
function createUsage(input, output) {
    return {
        input: { tokens: input },
        output: { tokens: output },
        cached: { tokens: 0 },
        cacheCreate: { tokens: 0 },
        reasoning: { tokens: 0 },
    };
}
(0, bun_test_1.describe)("SessionUsageService", () => {
    let service;
    let config;
    let tempDir;
    let mockHistoryService;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = path.join(os.tmpdir(), `unix-session-usage-test-${Date.now()}-${Math.random()}`);
        await fs.mkdir(tempDir, { recursive: true });
        config = new config_1.Config(tempDir);
        mockHistoryService = createMockHistoryService();
        service = new sessionUsageService_1.SessionUsageService(config, mockHistoryService);
    });
    (0, bun_test_1.afterEach)(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    (0, bun_test_1.describe)("rollUpUsageIntoParent", () => {
        (0, bun_test_1.it)("should roll up child usage into parent without changing parent's lastRequest", async () => {
            const projectPath = "/tmp/unix-session-usage-test-project";
            const model = "claude-sonnet-4-20250514";
            const parentWorkspaceId = "parent-workspace";
            const childWorkspaceId = "child-workspace";
            await config.addWorkspace(projectPath, {
                id: parentWorkspaceId,
                name: "parent-branch",
                projectName: "test-project",
                projectPath,
                runtimeConfig: { type: "local" },
            });
            await config.addWorkspace(projectPath, {
                id: childWorkspaceId,
                name: "child-branch",
                projectName: "test-project",
                projectPath,
                runtimeConfig: { type: "local" },
                parentWorkspaceId: parentWorkspaceId,
            });
            const parentUsage = createUsage(100, 50);
            await service.recordUsage(parentWorkspaceId, model, parentUsage);
            const before = await service.getSessionUsage(parentWorkspaceId);
            (0, bun_test_1.expect)(before?.lastRequest).toBeDefined();
            const beforeLastRequest = before.lastRequest;
            const childUsageByModel = { [model]: createUsage(7, 3) };
            const rollupResult = await service.rollUpUsageIntoParent(parentWorkspaceId, childWorkspaceId, childUsageByModel);
            (0, bun_test_1.expect)(rollupResult.didRollUp).toBe(true);
            const after = await service.getSessionUsage(parentWorkspaceId);
            (0, bun_test_1.expect)(after).toBeDefined();
            (0, bun_test_1.expect)(after.byModel[model].input.tokens).toBe(107);
            (0, bun_test_1.expect)(after.byModel[model].output.tokens).toBe(53);
            // lastRequest is preserved
            (0, bun_test_1.expect)(after.lastRequest).toEqual(beforeLastRequest);
        });
        (0, bun_test_1.it)("should be idempotent for the same child workspace", async () => {
            const projectPath = "/tmp/unix-session-usage-test-project";
            const model = "claude-sonnet-4-20250514";
            const parentWorkspaceId = "parent-workspace";
            const childWorkspaceId = "child-workspace";
            await config.addWorkspace(projectPath, {
                id: parentWorkspaceId,
                name: "parent-branch",
                projectName: "test-project",
                projectPath,
                runtimeConfig: { type: "local" },
            });
            const childUsageByModel = { [model]: createUsage(10, 5) };
            const first = await service.rollUpUsageIntoParent(parentWorkspaceId, childWorkspaceId, childUsageByModel);
            (0, bun_test_1.expect)(first.didRollUp).toBe(true);
            const second = await service.rollUpUsageIntoParent(parentWorkspaceId, childWorkspaceId, childUsageByModel);
            (0, bun_test_1.expect)(second.didRollUp).toBe(false);
            const result = await service.getSessionUsage(parentWorkspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.byModel[model].input.tokens).toBe(10);
            (0, bun_test_1.expect)(result.byModel[model].output.tokens).toBe(5);
            (0, bun_test_1.expect)(result.rolledUpFrom?.[childWorkspaceId]).toBe(true);
        });
    });
    (0, bun_test_1.describe)("recordUsage", () => {
        (0, bun_test_1.it)("should accumulate usage for same model (not overwrite)", async () => {
            const workspaceId = "test-workspace";
            const model = "claude-sonnet-4-20250514";
            const usage1 = createUsage(100, 50);
            const usage2 = createUsage(200, 75);
            await service.recordUsage(workspaceId, model, usage1);
            await service.recordUsage(workspaceId, model, usage2);
            const result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.byModel[model].input.tokens).toBe(300); // 100 + 200
            (0, bun_test_1.expect)(result.byModel[model].output.tokens).toBe(125); // 50 + 75
        });
        (0, bun_test_1.it)("should track separate usage per model", async () => {
            const workspaceId = "test-workspace";
            const sonnet = createUsage(100, 50);
            const opus = createUsage(500, 200);
            await service.recordUsage(workspaceId, "claude-sonnet-4-20250514", sonnet);
            await service.recordUsage(workspaceId, "claude-opus-4-20250514", opus);
            const result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.byModel["claude-sonnet-4-20250514"].input.tokens).toBe(100);
            (0, bun_test_1.expect)(result.byModel["claude-opus-4-20250514"].input.tokens).toBe(500);
        });
        (0, bun_test_1.it)("should update lastRequest with each recordUsage call", async () => {
            const workspaceId = "test-workspace";
            const usage1 = createUsage(100, 50);
            const usage2 = createUsage(200, 75);
            await service.recordUsage(workspaceId, "claude-sonnet-4-20250514", usage1);
            let result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result?.lastRequest?.model).toBe("claude-sonnet-4-20250514");
            (0, bun_test_1.expect)(result?.lastRequest?.usage.input.tokens).toBe(100);
            await service.recordUsage(workspaceId, "claude-opus-4-20250514", usage2);
            result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result?.lastRequest?.model).toBe("claude-opus-4-20250514");
            (0, bun_test_1.expect)(result?.lastRequest?.usage.input.tokens).toBe(200);
        });
    });
    (0, bun_test_1.describe)("setTokenStatsCache", () => {
        (0, bun_test_1.it)("should persist tokenStatsCache and preserve existing usage fields", async () => {
            const projectPath = "/tmp/unix-session-usage-test-project";
            const model = "claude-sonnet-4-20250514";
            const parentWorkspaceId = "parent-workspace";
            const childWorkspaceId = "child-workspace";
            await config.addWorkspace(projectPath, {
                id: parentWorkspaceId,
                name: "parent-branch",
                projectName: "test-project",
                projectPath,
                runtimeConfig: { type: "local" },
            });
            await config.addWorkspace(projectPath, {
                id: childWorkspaceId,
                name: "child-branch",
                projectName: "test-project",
                projectPath,
                runtimeConfig: { type: "local" },
                parentWorkspaceId: parentWorkspaceId,
            });
            // Seed: base usage + rolledUpFrom ledger
            await service.recordUsage(parentWorkspaceId, model, createUsage(100, 50));
            await service.rollUpUsageIntoParent(parentWorkspaceId, childWorkspaceId, {
                [model]: createUsage(7, 3),
            });
            const cache = {
                version: 1,
                computedAt: 123,
                model: "gpt-4",
                tokenizerName: "cl100k",
                history: { messageCount: 2, maxHistorySequence: 42 },
                consumers: [{ name: "User", tokens: 10, percentage: 100 }],
                totalTokens: 10,
                topFilePaths: [{ path: "/tmp/file.ts", tokens: 10 }],
            };
            await service.setTokenStatsCache(parentWorkspaceId, cache);
            const result = await service.getSessionUsage(parentWorkspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            (0, bun_test_1.expect)(result.tokenStatsCache).toEqual(cache);
            (0, bun_test_1.expect)(result.rolledUpFrom?.[childWorkspaceId]).toBe(true);
            // Existing usage fields preserved
            (0, bun_test_1.expect)(result.byModel[model].input.tokens).toBe(107);
            (0, bun_test_1.expect)(result.byModel[model].output.tokens).toBe(53);
            (0, bun_test_1.expect)(result.lastRequest).toBeDefined();
        });
    });
    (0, bun_test_1.describe)("getSessionUsage", () => {
        (0, bun_test_1.it)("should rebuild from messages when file missing (ENOENT)", async () => {
            const workspaceId = "test-workspace";
            const messages = [
                (0, message_1.createUnixMessage)("msg1", "assistant", "Hello", {
                    model: "claude-sonnet-4-20250514",
                    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                }),
                (0, message_1.createUnixMessage)("msg2", "assistant", "World", {
                    model: "claude-sonnet-4-20250514",
                    usage: { inputTokens: 200, outputTokens: 75, totalTokens: 275 },
                }),
            ];
            mockHistoryService = createMockHistoryService(messages);
            service = new sessionUsageService_1.SessionUsageService(config, mockHistoryService);
            // Create session dir but NOT the session-usage.json file
            await fs.mkdir(config.getSessionDir(workspaceId), { recursive: true });
            const result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            // Should have rebuilt and summed the usage
            (0, bun_test_1.expect)(result.byModel["claude-sonnet-4-20250514"]).toBeDefined();
        });
    });
    (0, bun_test_1.describe)("rebuildFromMessages", () => {
        (0, bun_test_1.it)("should rebuild from messages when file is corrupted JSON", async () => {
            const workspaceId = "test-workspace";
            const messages = [
                (0, message_1.createUnixMessage)("msg1", "assistant", "Hello", {
                    model: "claude-sonnet-4-20250514",
                    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
                }),
            ];
            mockHistoryService = createMockHistoryService(messages);
            service = new sessionUsageService_1.SessionUsageService(config, mockHistoryService);
            // Create session dir with corrupted JSON
            const sessionDir = config.getSessionDir(workspaceId);
            await fs.mkdir(sessionDir, { recursive: true });
            await fs.writeFile(path.join(sessionDir, "session-usage.json"), "{ invalid json");
            const result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            // Should have rebuilt from messages
            (0, bun_test_1.expect)(result.byModel["claude-sonnet-4-20250514"]).toBeDefined();
            (0, bun_test_1.expect)(result.byModel["claude-sonnet-4-20250514"].input.tokens).toBe(100);
        });
        (0, bun_test_1.it)("should include historicalUsage from legacy compaction summaries", async () => {
            const workspaceId = "test-workspace";
            // Create a compaction summary with historicalUsage (legacy format)
            const compactionSummary = (0, message_1.createUnixMessage)("summary-1", "assistant", "Compacted summary", {
                historySequence: 1,
                compacted: true,
                model: "anthropic:claude-sonnet-4-5",
                usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            });
            // Add historicalUsage - this field was removed from UnixMetadata type
            // but may still exist in persisted data from before the change
            compactionSummary.metadata.historicalUsage = createUsage(5000, 1000);
            // Add a post-compaction message
            const postCompactionMsg = (0, message_1.createUnixMessage)("msg2", "assistant", "New response", {
                historySequence: 2,
                model: "anthropic:claude-sonnet-4-5",
                usage: { inputTokens: 200, outputTokens: 75, totalTokens: 275 },
            });
            mockHistoryService = createMockHistoryService([compactionSummary, postCompactionMsg]);
            service = new sessionUsageService_1.SessionUsageService(config, mockHistoryService);
            // Create session dir but NOT the session-usage.json file (triggers rebuild)
            await fs.mkdir(config.getSessionDir(workspaceId), { recursive: true });
            const result = await service.getSessionUsage(workspaceId);
            (0, bun_test_1.expect)(result).toBeDefined();
            // Should include historical usage under "historical" key
            (0, bun_test_1.expect)(result.byModel.historical).toBeDefined();
            (0, bun_test_1.expect)(result.byModel.historical.input.tokens).toBe(5000);
            (0, bun_test_1.expect)(result.byModel.historical.output.tokens).toBe(1000);
            // Should also include current model usage (compaction summary + post-compaction)
            (0, bun_test_1.expect)(result.byModel["anthropic:claude-sonnet-4-5"]).toBeDefined();
            (0, bun_test_1.expect)(result.byModel["anthropic:claude-sonnet-4-5"].input.tokens).toBe(300); // 100 + 200
        });
    });
});
//# sourceMappingURL=sessionUsageService.test.js.map