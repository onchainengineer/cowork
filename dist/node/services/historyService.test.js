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
const historyService_1 = require("./historyService");
const config_1 = require("../../node/config");
const message_1 = require("../../common/types/message");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
(0, bun_test_1.describe)("HistoryService", () => {
    let service;
    let config;
    let tempDir;
    (0, bun_test_1.beforeEach)(async () => {
        // Create a temporary directory for test files
        tempDir = path.join(os.tmpdir(), `unix-test-${Date.now()}-${Math.random()}`);
        await fs.mkdir(tempDir, { recursive: true });
        // Create a Config with the temp directory
        config = new config_1.Config(tempDir);
        service = new historyService_1.HistoryService(config);
    });
    (0, bun_test_1.afterEach)(async () => {
        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    (0, bun_test_1.describe)("getHistory", () => {
        (0, bun_test_1.it)("should return empty array when no history exists", async () => {
            const result = await service.getHistory("workspace1");
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.data).toEqual([]);
            }
        });
        (0, bun_test_1.it)("should read messages from chat.jsonl", async () => {
            const workspaceId = "workspace1";
            const workspaceDir = config.getSessionDir(workspaceId);
            await fs.mkdir(workspaceDir, { recursive: true });
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 0 });
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Hi there", {
                historySequence: 1,
            });
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            await fs.writeFile(chatPath, JSON.stringify({ ...msg1, workspaceId }) +
                "\n" +
                JSON.stringify({ ...msg2, workspaceId }) +
                "\n");
            const result = await service.getHistory(workspaceId);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.data).toHaveLength(2);
                (0, bun_test_1.expect)(result.data[0].id).toBe("msg1");
                (0, bun_test_1.expect)(result.data[1].id).toBe("msg2");
            }
        });
        (0, bun_test_1.it)("should skip malformed JSON lines", async () => {
            const workspaceId = "workspace1";
            const workspaceDir = config.getSessionDir(workspaceId);
            await fs.mkdir(workspaceDir, { recursive: true });
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 0 });
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            await fs.writeFile(chatPath, JSON.stringify({ ...msg1, workspaceId }) +
                "\n" +
                "invalid json line\n" +
                JSON.stringify({
                    ...(0, message_1.createUnixMessage)("msg2", "user", "World", { historySequence: 1 }),
                    workspaceId,
                }) +
                "\n");
            const result = await service.getHistory(workspaceId);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.data).toHaveLength(2);
                (0, bun_test_1.expect)(result.data[0].id).toBe("msg1");
                (0, bun_test_1.expect)(result.data[1].id).toBe("msg2");
            }
        });
        (0, bun_test_1.it)("hydrates legacy cunixMetadata entries", async () => {
            const workspaceId = "workspace-legacy";
            const workspaceDir = config.getSessionDir(workspaceId);
            await fs.mkdir(workspaceDir, { recursive: true });
            const legacyMessage = (0, message_1.createUnixMessage)("msg-legacy", "user", "legacy", {
                historySequence: 0,
            });
            legacyMessage.metadata.cunixMetadata = { type: "normal" };
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            await fs.writeFile(chatPath, JSON.stringify({ ...legacyMessage, workspaceId }) + "\n");
            const result = await service.getHistory(workspaceId);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.data[0].metadata?.unixMetadata?.type).toBe("normal");
            }
        });
        (0, bun_test_1.it)("should handle empty lines in history file", async () => {
            const workspaceId = "workspace1";
            const workspaceDir = config.getSessionDir(workspaceId);
            await fs.mkdir(workspaceDir, { recursive: true });
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 0 });
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            await fs.writeFile(chatPath, JSON.stringify({ ...msg1, workspaceId }) + "\n\n\n" // Extra empty lines
            );
            const result = await service.getHistory(workspaceId);
            (0, bun_test_1.expect)(result.success).toBe(true);
            if (result.success) {
                (0, bun_test_1.expect)(result.data).toHaveLength(1);
                (0, bun_test_1.expect)(result.data[0].id).toBe("msg1");
            }
        });
    });
    (0, bun_test_1.describe)("appendToHistory", () => {
        (0, bun_test_1.it)("should create workspace directory if it doesn't exist", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            const result = await service.appendToHistory(workspaceId, msg);
            (0, bun_test_1.expect)(result.success).toBe(true);
            const workspaceDir = config.getSessionDir(workspaceId);
            const exists = await fs
                .access(workspaceDir)
                .then(() => true)
                .catch(() => false);
            (0, bun_test_1.expect)(exists).toBe(true);
        });
        (0, bun_test_1.it)("should assign historySequence to message without metadata", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            const result = await service.appendToHistory(workspaceId, msg);
            (0, bun_test_1.expect)(result.success).toBe(true);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
            }
        });
        (0, bun_test_1.it)("should assign sequential historySequence numbers", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Hi");
            const msg3 = (0, message_1.createUnixMessage)("msg3", "user", "How are you?");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            await service.appendToHistory(workspaceId, msg3);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data).toHaveLength(3);
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
                (0, bun_test_1.expect)(history.data[1].metadata?.historySequence).toBe(1);
                (0, bun_test_1.expect)(history.data[2].metadata?.historySequence).toBe(2);
            }
        });
        (0, bun_test_1.it)("should preserve existing historySequence if provided", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 5 });
            const result = await service.appendToHistory(workspaceId, msg);
            (0, bun_test_1.expect)(result.success).toBe(true);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(5);
            }
        });
        (0, bun_test_1.it)("should update sequence counter when message has higher sequence", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 10 });
            const msg2 = (0, message_1.createUnixMessage)("msg2", "user", "World");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(10);
                (0, bun_test_1.expect)(history.data[1].metadata?.historySequence).toBe(11);
            }
        });
        (0, bun_test_1.it)("should preserve other metadata fields", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello", {
                timestamp: 123456,
                model: "claude-opus-4",
                providerMetadata: { test: "data" },
            });
            await service.appendToHistory(workspaceId, msg);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.timestamp).toBe(123456);
                (0, bun_test_1.expect)(history.data[0].metadata?.model).toBe("claude-opus-4");
                (0, bun_test_1.expect)(history.data[0].metadata?.providerMetadata).toEqual({ test: "data" });
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBeDefined();
            }
        });
        (0, bun_test_1.it)("should include workspaceId in persisted message", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg);
            const workspaceDir = config.getSessionDir(workspaceId);
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            const content = await fs.readFile(chatPath, "utf-8");
            const persisted = JSON.parse(content.trim());
            (0, bun_test_1.expect)(persisted.workspaceId).toBe(workspaceId);
        });
    });
    (0, bun_test_1.describe)("updateHistory", () => {
        (0, bun_test_1.it)("should update message by historySequence", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Hi");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                const updatedMsg = (0, message_1.createUnixMessage)("msg1", "user", "Updated Hello", {
                    historySequence: history.data[0].metadata?.historySequence,
                });
                const result = await service.updateHistory(workspaceId, updatedMsg);
                (0, bun_test_1.expect)(result.success).toBe(true);
                const newHistory = await service.getHistory(workspaceId);
                if (newHistory.success) {
                    (0, bun_test_1.expect)(newHistory.data[0].parts[0]).toMatchObject({
                        type: "text",
                        text: "Updated Hello",
                    });
                    (0, bun_test_1.expect)(newHistory.data[0].metadata?.historySequence).toBe(0);
                }
            }
        });
        (0, bun_test_1.it)("should return error if message has no historySequence", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            const result = await service.updateHistory(workspaceId, msg);
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("without historySequence");
            }
        });
        (0, bun_test_1.it)("should return error if message with historySequence not found", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg1);
            const msg2 = (0, message_1.createUnixMessage)("msg2", "user", "Not found", { historySequence: 99 });
            const result = await service.updateHistory(workspaceId, msg2);
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("No message found");
            }
        });
        (0, bun_test_1.it)("should preserve historySequence when updating", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                const originalSequence = history.data[0].metadata?.historySequence;
                const updatedMsg = (0, message_1.createUnixMessage)("msg1", "user", "Updated", {
                    historySequence: originalSequence,
                });
                await service.updateHistory(workspaceId, updatedMsg);
                const newHistory = await service.getHistory(workspaceId);
                if (newHistory.success) {
                    (0, bun_test_1.expect)(newHistory.data[0].metadata?.historySequence).toBe(originalSequence);
                }
            }
        });
    });
    (0, bun_test_1.describe)("deleteMessage", () => {
        (0, bun_test_1.it)("should remove only the targeted message and preserve subsequent messages", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "First");
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Second");
            const msg3 = (0, message_1.createUnixMessage)("msg3", "user", "Third");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            await service.appendToHistory(workspaceId, msg3);
            const result = await service.deleteMessage(workspaceId, "msg2");
            (0, bun_test_1.expect)(result.success).toBe(true);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data).toHaveLength(2);
                (0, bun_test_1.expect)(history.data.map((message) => message.id)).toEqual(["msg1", "msg3"]);
            }
            const msg4 = (0, message_1.createUnixMessage)("msg4", "assistant", "Fourth");
            await service.appendToHistory(workspaceId, msg4);
            const historyAfterAppend = await service.getHistory(workspaceId);
            if (historyAfterAppend.success) {
                const msg3Seq = historyAfterAppend.data.find((message) => message.id === "msg3")?.metadata
                    ?.historySequence;
                const msg4Seq = historyAfterAppend.data.find((message) => message.id === "msg4")?.metadata
                    ?.historySequence;
                (0, bun_test_1.expect)(msg3Seq).toBeDefined();
                (0, bun_test_1.expect)(msg4Seq).toBeDefined();
                (0, bun_test_1.expect)(msg4Seq).toBeGreaterThan(msg3Seq ?? -1);
            }
        });
        (0, bun_test_1.it)("should return error if message not found", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg);
            const result = await service.deleteMessage(workspaceId, "nonexistent");
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("not found");
            }
        });
    });
    (0, bun_test_1.describe)("truncateAfterMessage", () => {
        (0, bun_test_1.it)("should remove message and all subsequent messages", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "First");
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Second");
            const msg3 = (0, message_1.createUnixMessage)("msg3", "user", "Third");
            const msg4 = (0, message_1.createUnixMessage)("msg4", "assistant", "Fourth");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            await service.appendToHistory(workspaceId, msg3);
            await service.appendToHistory(workspaceId, msg4);
            const result = await service.truncateAfterMessage(workspaceId, "msg2");
            (0, bun_test_1.expect)(result.success).toBe(true);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data).toHaveLength(1);
                (0, bun_test_1.expect)(history.data[0].id).toBe("msg1");
            }
        });
        (0, bun_test_1.it)("should update sequence counter after truncation", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "First");
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Second");
            const msg3 = (0, message_1.createUnixMessage)("msg3", "user", "Third");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            await service.appendToHistory(workspaceId, msg3);
            await service.truncateAfterMessage(workspaceId, "msg2");
            // Append a new message and check its sequence
            const msg4 = (0, message_1.createUnixMessage)("msg4", "user", "New message");
            await service.appendToHistory(workspaceId, msg4);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data).toHaveLength(2);
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
                (0, bun_test_1.expect)(history.data[1].metadata?.historySequence).toBe(1);
            }
        });
        (0, bun_test_1.it)("should reset sequence counter when truncating all messages", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "First");
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Second");
            await service.appendToHistory(workspaceId, msg1);
            await service.appendToHistory(workspaceId, msg2);
            await service.truncateAfterMessage(workspaceId, "msg1");
            const msg3 = (0, message_1.createUnixMessage)("msg3", "user", "New");
            await service.appendToHistory(workspaceId, msg3);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data).toHaveLength(1);
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
            }
        });
        (0, bun_test_1.it)("should return error if message not found", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg);
            const result = await service.truncateAfterMessage(workspaceId, "nonexistent");
            (0, bun_test_1.expect)(result.success).toBe(false);
            if (!result.success) {
                (0, bun_test_1.expect)(result.error).toContain("not found");
            }
        });
    });
    (0, bun_test_1.describe)("clearHistory", () => {
        (0, bun_test_1.it)("should delete chat.jsonl file", async () => {
            const workspaceId = "workspace1";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg);
            const result = await service.clearHistory(workspaceId);
            (0, bun_test_1.expect)(result.success).toBe(true);
            const workspaceDir = config.getSessionDir(workspaceId);
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            const exists = await fs
                .access(chatPath)
                .then(() => true)
                .catch(() => false);
            (0, bun_test_1.expect)(exists).toBe(false);
        });
        (0, bun_test_1.it)("should reset sequence counter", async () => {
            const workspaceId = "workspace1";
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello");
            await service.appendToHistory(workspaceId, msg1);
            await service.clearHistory(workspaceId);
            const msg2 = (0, message_1.createUnixMessage)("msg2", "user", "New message");
            await service.appendToHistory(workspaceId, msg2);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
            }
        });
        (0, bun_test_1.it)("should succeed when clearing non-existent history", async () => {
            const workspaceId = "workspace-no-history";
            const result = await service.clearHistory(workspaceId);
            (0, bun_test_1.expect)(result.success).toBe(true);
        });
        (0, bun_test_1.it)("should reset sequence counter even when file doesn't exist", async () => {
            const workspaceId = "workspace-no-history";
            await service.clearHistory(workspaceId);
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "First");
            await service.appendToHistory(workspaceId, msg);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
            }
        });
    });
    (0, bun_test_1.describe)("sequence number initialization", () => {
        (0, bun_test_1.it)("should initialize sequence from existing history", async () => {
            const workspaceId = "workspace1";
            const workspaceDir = config.getSessionDir(workspaceId);
            await fs.mkdir(workspaceDir, { recursive: true });
            // Manually create history with specific sequences
            const msg1 = (0, message_1.createUnixMessage)("msg1", "user", "Hello", { historySequence: 0 });
            const msg2 = (0, message_1.createUnixMessage)("msg2", "assistant", "Hi", { historySequence: 1 });
            const chatPath = path.join(workspaceDir, "chat.jsonl");
            await fs.writeFile(chatPath, JSON.stringify({ ...msg1, workspaceId }) +
                "\n" +
                JSON.stringify({ ...msg2, workspaceId }) +
                "\n");
            // Create new service instance to ensure fresh initialization
            const newService = new historyService_1.HistoryService(config);
            // Append a new message - should get sequence 2
            const msg3 = (0, message_1.createUnixMessage)("msg3", "user", "How are you?");
            await newService.appendToHistory(workspaceId, msg3);
            const history = await newService.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data).toHaveLength(3);
                (0, bun_test_1.expect)(history.data[2].metadata?.historySequence).toBe(2);
            }
        });
        (0, bun_test_1.it)("should start from 0 for new workspace", async () => {
            const workspaceId = "new-workspace";
            const msg = (0, message_1.createUnixMessage)("msg1", "user", "First message");
            await service.appendToHistory(workspaceId, msg);
            const history = await service.getHistory(workspaceId);
            if (history.success) {
                (0, bun_test_1.expect)(history.data[0].metadata?.historySequence).toBe(0);
            }
        });
    });
});
//# sourceMappingURL=historyService.test.js.map