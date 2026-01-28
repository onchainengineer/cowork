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
const tokenizerService_1 = require("./tokenizerService");
const tokenizerUtils = __importStar(require("../../node/utils/main/tokenizer"));
const statsUtils = __importStar(require("../../common/utils/tokens/tokenStatsCalculator"));
const message_1 = require("../../common/types/message");
(0, bun_test_1.describe)("TokenizerService", () => {
    let sessionUsageService;
    let service;
    (0, bun_test_1.beforeEach)(() => {
        sessionUsageService = {
            setTokenStatsCache: () => Promise.resolve(),
        };
        service = new tokenizerService_1.TokenizerService(sessionUsageService);
    });
    (0, bun_test_1.describe)("countTokens", () => {
        (0, bun_test_1.test)("delegates to underlying function", async () => {
            const spy = (0, bun_test_1.spyOn)(tokenizerUtils, "countTokens").mockResolvedValue(42);
            const result = await service.countTokens("gpt-4", "hello world");
            (0, bun_test_1.expect)(result).toBe(42);
            (0, bun_test_1.expect)(spy).toHaveBeenCalledWith("gpt-4", "hello world");
            spy.mockRestore();
        });
        (0, bun_test_1.test)("throws on empty model", () => {
            (0, bun_test_1.expect)(service.countTokens("", "text")).rejects.toThrow("requires model name");
        });
        (0, bun_test_1.test)("throws on invalid text", () => {
            // @ts-expect-error testing runtime validation
            (0, bun_test_1.expect)(service.countTokens("gpt-4", null)).rejects.toThrow("requires text");
        });
    });
    (0, bun_test_1.describe)("countTokensBatch", () => {
        (0, bun_test_1.test)("delegates to underlying function", async () => {
            const spy = (0, bun_test_1.spyOn)(tokenizerUtils, "countTokensBatch").mockResolvedValue([10, 20]);
            const result = await service.countTokensBatch("gpt-4", ["a", "b"]);
            (0, bun_test_1.expect)(result).toEqual([10, 20]);
            (0, bun_test_1.expect)(spy).toHaveBeenCalledWith("gpt-4", ["a", "b"]);
            spy.mockRestore();
        });
        (0, bun_test_1.test)("throws on non-array input", () => {
            // @ts-expect-error testing runtime validation
            (0, bun_test_1.expect)(service.countTokensBatch("gpt-4", "not-array")).rejects.toThrow("requires an array");
        });
    });
    (0, bun_test_1.describe)("calculateStats", () => {
        (0, bun_test_1.test)("delegates to underlying function and persists token stats cache", async () => {
            const messages = [
                (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 1 }),
                (0, message_1.createUnixMessage)("msg2", "assistant", "World", { historySequence: 2 }),
            ];
            const mockResult = {
                consumers: [{ name: "User", tokens: 100, percentage: 100 }],
                totalTokens: 100,
                model: "gpt-4",
                tokenizerName: "cl100k",
                usageHistory: [],
            };
            const statsSpy = (0, bun_test_1.spyOn)(statsUtils, "calculateTokenStats").mockResolvedValue(mockResult);
            const persistSpy = (0, bun_test_1.spyOn)(sessionUsageService, "setTokenStatsCache").mockResolvedValue(undefined);
            const nowSpy = (0, bun_test_1.spyOn)(Date, "now").mockReturnValue(1234);
            const result = await service.calculateStats("test-workspace", messages, "gpt-4");
            (0, bun_test_1.expect)(result).toBe(mockResult);
            (0, bun_test_1.expect)(statsSpy).toHaveBeenCalledWith(messages, "gpt-4");
            (0, bun_test_1.expect)(persistSpy).toHaveBeenCalledWith("test-workspace", bun_test_1.expect.objectContaining({
                version: 1,
                computedAt: 1234,
                model: "gpt-4",
                tokenizerName: "cl100k",
                totalTokens: 100,
                consumers: mockResult.consumers,
                history: { messageCount: 2, maxHistorySequence: 2 },
            }));
            nowSpy.mockRestore();
            statsSpy.mockRestore();
            persistSpy.mockRestore();
        });
        (0, bun_test_1.test)("skips persisting stale token stats cache when calculations overlap", async () => {
            const messagesV1 = [
                (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 1 }),
                (0, message_1.createUnixMessage)("msg2", "assistant", "World", { historySequence: 2 }),
            ];
            const messagesV2 = [
                ...messagesV1,
                (0, message_1.createUnixMessage)("msg3", "assistant", "!!!", { historySequence: 3 }),
            ];
            const deferred = () => {
                let resolve;
                let reject;
                const promise = new Promise((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                return { promise, resolve, reject };
            };
            const statsV1 = {
                consumers: [{ name: "User", tokens: 1, percentage: 100 }],
                totalTokens: 1,
                model: "gpt-4",
                tokenizerName: "cl100k",
                usageHistory: [],
            };
            const statsV2 = {
                consumers: [{ name: "User", tokens: 2, percentage: 100 }],
                totalTokens: 2,
                model: "gpt-4",
                tokenizerName: "cl100k",
                usageHistory: [],
            };
            const d1 = deferred();
            const d2 = deferred();
            const statsSpy = (0, bun_test_1.spyOn)(statsUtils, "calculateTokenStats")
                .mockImplementationOnce(() => d1.promise)
                .mockImplementationOnce(() => d2.promise);
            const persistSpy = (0, bun_test_1.spyOn)(sessionUsageService, "setTokenStatsCache").mockResolvedValue(undefined);
            const p1 = service.calculateStats("test-workspace", messagesV1, "gpt-4");
            const p2 = service.calculateStats("test-workspace", messagesV2, "gpt-4");
            // Resolve second (newer) request first
            d2.resolve(statsV2);
            (0, bun_test_1.expect)(await p2).toBe(statsV2);
            // Resolve first (older) request last
            d1.resolve(statsV1);
            (0, bun_test_1.expect)(await p1).toBe(statsV1);
            // Only the newer request should persist the cache.
            (0, bun_test_1.expect)(persistSpy).toHaveBeenCalledTimes(1);
            (0, bun_test_1.expect)(persistSpy).toHaveBeenCalledWith("test-workspace", bun_test_1.expect.objectContaining({
                history: { messageCount: messagesV2.length, maxHistorySequence: 3 },
            }));
            statsSpy.mockRestore();
            persistSpy.mockRestore();
        });
        (0, bun_test_1.test)("throws on invalid messages", () => {
            // @ts-expect-error testing runtime validation
            (0, bun_test_1.expect)(service.calculateStats("test-workspace", null, "gpt-4")).rejects.toThrow("requires an array");
        });
        (0, bun_test_1.test)("throws on empty workspaceId", () => {
            (0, bun_test_1.expect)(service.calculateStats("", [], "gpt-4")).rejects.toThrow("requires workspaceId");
        });
    });
});
//# sourceMappingURL=tokenizerService.test.js.map