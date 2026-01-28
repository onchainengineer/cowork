"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const idleCompactionService_1 = require("./idleCompactionService");
const message_1 = require("../../common/types/message");
const result_1 = require("../../common/types/result");
(0, bun_test_1.describe)("IdleCompactionService", () => {
    // Mock services
    let mockConfig;
    let mockHistoryService;
    let mockExtensionMetadata;
    let emitIdleCompactionNeededMock;
    let service;
    // Test data
    const testWorkspaceId = "test-workspace-id";
    const testProjectPath = "/test/project";
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    (0, bun_test_1.beforeEach)(() => {
        // Create mock config
        mockConfig = {
            loadConfigOrDefault: (0, bun_test_1.mock)(() => ({
                projects: new Map([
                    [
                        testProjectPath,
                        {
                            workspaces: [{ id: testWorkspaceId, path: "/test/path", name: "test" }],
                            idleCompactionHours: 24,
                        },
                    ],
                ]),
            })),
        };
        // Create mock history service - messages with timestamps 25 hours ago (idle)
        const idleTimestamp = now - 25 * oneHourMs;
        mockHistoryService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve((0, result_1.Ok)([
                (0, message_1.createUnixMessage)("1", "user", "Hello", { timestamp: idleTimestamp }),
                (0, message_1.createUnixMessage)("2", "assistant", "Hi there!", { timestamp: idleTimestamp }),
            ]))),
        };
        // Create mock extension metadata service
        mockExtensionMetadata = {
            getMetadata: (0, bun_test_1.mock)(() => Promise.resolve({
                workspaceId: testWorkspaceId,
                recency: now - 25 * oneHourMs, // 25 hours ago
                streaming: false,
                lastModel: null,
                lastThinkingLevel: null,
                updatedAt: now - 25 * oneHourMs,
            })),
        };
        // Create mock for emitIdleCompactionNeeded callback
        emitIdleCompactionNeededMock = (0, bun_test_1.mock)(() => {
            // noop mock
        });
        // Create service with callback
        service = new idleCompactionService_1.IdleCompactionService(mockConfig, mockHistoryService, mockExtensionMetadata, emitIdleCompactionNeededMock);
    });
    (0, bun_test_1.afterEach)(() => {
        service.stop();
    });
    (0, bun_test_1.describe)("checkEligibility", () => {
        const threshold24h = 24 * oneHourMs;
        (0, bun_test_1.test)("returns eligible for idle workspace with messages", async () => {
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(true);
        });
        (0, bun_test_1.test)("returns ineligible when workspace is currently streaming", async () => {
            // Idle messages but workspace is streaming
            const idleTimestamp = now - 25 * oneHourMs;
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([
                (0, message_1.createUnixMessage)("1", "user", "Hello", { timestamp: idleTimestamp }),
                (0, message_1.createUnixMessage)("2", "assistant", "Hi!", { timestamp: idleTimestamp }),
            ]));
            mockExtensionMetadata.getMetadata.mockResolvedValueOnce({
                workspaceId: testWorkspaceId,
                recency: idleTimestamp,
                streaming: true, // Currently streaming
                lastModel: null,
                lastThinkingLevel: null,
                updatedAt: idleTimestamp,
            });
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(false);
            (0, bun_test_1.expect)(result.reason).toBe("currently_streaming");
        });
        (0, bun_test_1.test)("returns ineligible when workspace has no messages", async () => {
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([]));
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(false);
            (0, bun_test_1.expect)(result.reason).toBe("no_messages");
        });
        (0, bun_test_1.test)("returns ineligible when last message is already compacted", async () => {
            const idleTimestamp = now - 25 * oneHourMs;
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([
                (0, message_1.createUnixMessage)("1", "assistant", "Summary", {
                    compacted: true,
                    timestamp: idleTimestamp,
                }),
            ]));
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(false);
            (0, bun_test_1.expect)(result.reason).toBe("already_compacted");
        });
        (0, bun_test_1.test)("returns ineligible when not idle long enough", async () => {
            // Messages with recent timestamps (only 1 hour ago)
            const recentTimestamp = now - 1 * oneHourMs;
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([
                (0, message_1.createUnixMessage)("1", "user", "Hello", { timestamp: recentTimestamp }),
                (0, message_1.createUnixMessage)("2", "assistant", "Hi!", { timestamp: recentTimestamp }),
            ]));
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(false);
            (0, bun_test_1.expect)(result.reason).toBe("not_idle_enough");
        });
        (0, bun_test_1.test)("returns ineligible when last message is from user (awaiting response)", async () => {
            const idleTimestamp = now - 25 * oneHourMs;
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([
                (0, message_1.createUnixMessage)("1", "user", "Hello", { timestamp: idleTimestamp }),
                (0, message_1.createUnixMessage)("2", "assistant", "Hi!", { timestamp: idleTimestamp }),
                (0, message_1.createUnixMessage)("3", "user", "Another question?", { timestamp: idleTimestamp }), // Last message is user
            ]));
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(false);
            (0, bun_test_1.expect)(result.reason).toBe("awaiting_response");
        });
        (0, bun_test_1.test)("returns ineligible when messages have no timestamps", async () => {
            // Messages without timestamps - can't determine recency
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([(0, message_1.createUnixMessage)("1", "user", "Hello"), (0, message_1.createUnixMessage)("2", "assistant", "Hi!")]));
            const result = await service.checkEligibility(testWorkspaceId, threshold24h, now);
            (0, bun_test_1.expect)(result.eligible).toBe(false);
            (0, bun_test_1.expect)(result.reason).toBe("no_recency_data");
        });
    });
    (0, bun_test_1.describe)("checkAllWorkspaces", () => {
        (0, bun_test_1.test)("skips projects without idleCompactionHours set", async () => {
            mockConfig.loadConfigOrDefault.mockReturnValueOnce({
                projects: new Map([
                    [
                        testProjectPath,
                        {
                            workspaces: [{ id: testWorkspaceId, path: "/test/path", name: "test" }],
                            // idleCompactionHours not set
                        },
                    ],
                ]),
            });
            await service.checkAllWorkspaces();
            // Should not attempt to notify
            (0, bun_test_1.expect)(emitIdleCompactionNeededMock).not.toHaveBeenCalled();
        });
        (0, bun_test_1.test)("marks workspace as needing compaction when eligible", async () => {
            await service.checkAllWorkspaces();
            // Should have emitted idle compaction needed event
            (0, bun_test_1.expect)(emitIdleCompactionNeededMock).toHaveBeenCalledTimes(1);
            (0, bun_test_1.expect)(emitIdleCompactionNeededMock).toHaveBeenCalledWith(testWorkspaceId);
        });
        (0, bun_test_1.test)("continues checking other workspaces if one fails", async () => {
            // Setup two workspaces in different projects
            const workspace2Id = "workspace-2";
            const idleTimestamp = now - 25 * oneHourMs;
            mockConfig.loadConfigOrDefault.mockReturnValueOnce({
                projects: new Map([
                    [
                        testProjectPath,
                        {
                            workspaces: [{ id: testWorkspaceId, path: "/test/path", name: "test" }],
                            idleCompactionHours: 24,
                        },
                    ],
                    [
                        "/another/project",
                        {
                            workspaces: [{ id: workspace2Id, path: "/another/path", name: "test2" }],
                            idleCompactionHours: 24,
                        },
                    ],
                ]),
            });
            // Make first workspace fail eligibility check (history throws)
            let callCount = 0;
            mockHistoryService.getHistory.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error("History fetch failed");
                }
                return Promise.resolve((0, result_1.Ok)([
                    (0, message_1.createUnixMessage)("1", "user", "Hello", { timestamp: idleTimestamp }),
                    (0, message_1.createUnixMessage)("2", "assistant", "Hi!", { timestamp: idleTimestamp }),
                ]));
            });
            await service.checkAllWorkspaces();
            // Should still have tried to process the second workspace
            (0, bun_test_1.expect)(callCount).toBe(2);
        });
    });
    (0, bun_test_1.describe)("workspace ID resolution", () => {
        (0, bun_test_1.test)("falls back to workspace name when id is not set", async () => {
            const workspaceName = "test-workspace-name";
            const idleTimestamp = now - 25 * oneHourMs;
            mockConfig.loadConfigOrDefault.mockReturnValueOnce({
                projects: new Map([
                    [
                        testProjectPath,
                        {
                            workspaces: [{ name: workspaceName, path: "/test/path" }], // No id field
                            idleCompactionHours: 24,
                        },
                    ],
                ]),
            });
            // Update history mock to return idle messages for the name-based ID
            mockHistoryService.getHistory.mockResolvedValueOnce((0, result_1.Ok)([
                (0, message_1.createUnixMessage)("1", "user", "Hello", { timestamp: idleTimestamp }),
                (0, message_1.createUnixMessage)("2", "assistant", "Hi!", { timestamp: idleTimestamp }),
            ]));
            await service.checkAllWorkspaces();
            // Should have emitted with the name as workspaceId
            (0, bun_test_1.expect)(emitIdleCompactionNeededMock).toHaveBeenCalledWith(workspaceName);
        });
        (0, bun_test_1.test)("skips workspace when neither id nor name is set", async () => {
            mockConfig.loadConfigOrDefault.mockReturnValueOnce({
                projects: new Map([
                    [
                        testProjectPath,
                        {
                            workspaces: [{ path: "/test/path" }], // No id or name
                            idleCompactionHours: 24,
                        },
                    ],
                ]),
            });
            await service.checkAllWorkspaces();
            // Should not attempt any compaction
            (0, bun_test_1.expect)(emitIdleCompactionNeededMock).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=idleCompactionService.test.js.map