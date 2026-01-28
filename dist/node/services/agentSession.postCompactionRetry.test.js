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
const events_1 = require("events");
const fsPromises = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const agentSession_1 = require("./agentSession");
function createPersistedPostCompactionState(options) {
    const payload = {
        version: 1,
        createdAt: Date.now(),
        diffs: options.diffs,
    };
    return fsPromises.writeFile(options.filePath, JSON.stringify(payload));
}
(0, bun_test_1.describe)("AgentSession post-compaction context retry", () => {
    (0, bun_test_1.test)("retries once without post-compaction injection on context_exceeded", async () => {
        const workspaceId = "ws";
        const sessionDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "unix-agentSession-"));
        const postCompactionPath = path.join(sessionDir, "post-compaction.json");
        await createPersistedPostCompactionState({
            filePath: postCompactionPath,
            diffs: [
                {
                    path: "/tmp/foo.ts",
                    diff: "@@ -1 +1 @@\n-foo\n+bar\n",
                    truncated: false,
                },
            ],
        });
        const history = [
            {
                id: "compaction-summary",
                role: "assistant",
                parts: [{ type: "text", text: "Summary" }],
                metadata: { timestamp: 1000, compacted: "user" },
            },
            {
                id: "user-1",
                role: "user",
                parts: [{ type: "text", text: "Continue" }],
                metadata: { timestamp: 1100 },
            },
        ];
        const historyService = {
            getHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: history })),
            deleteMessage: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const partialService = {
            commitToHistory: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
            deletePartial: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const aiEmitter = new events_1.EventEmitter();
        let resolveSecondCall;
        const secondCall = new Promise((resolve) => {
            resolveSecondCall = resolve;
        });
        let callCount = 0;
        const streamMessage = (0, bun_test_1.mock)((..._args) => {
            callCount += 1;
            if (callCount === 1) {
                // Simulate a provider context limit error before any deltas.
                aiEmitter.emit("error", {
                    workspaceId,
                    messageId: "assistant-ctx-exceeded",
                    error: "Context length exceeded",
                    errorType: "context_exceeded",
                });
                return Promise.resolve({ success: true, data: undefined });
            }
            resolveSecondCall?.();
            return Promise.resolve({ success: true, data: undefined });
        });
        const aiService = {
            on(eventName, listener) {
                aiEmitter.on(String(eventName), listener);
                return this;
            },
            off(eventName, listener) {
                aiEmitter.off(String(eventName), listener);
                return this;
            },
            streamMessage,
            getWorkspaceMetadata: (0, bun_test_1.mock)(() => Promise.resolve({ success: false, error: "nope" })),
            stopStream: (0, bun_test_1.mock)(() => Promise.resolve({ success: true, data: undefined })),
        };
        const initStateManager = {
            on() {
                return this;
            },
            off() {
                return this;
            },
        };
        const backgroundProcessManager = {
            setMessageQueued: (0, bun_test_1.mock)(() => undefined),
            cleanup: (0, bun_test_1.mock)(() => Promise.resolve()),
        };
        const config = {
            srcDir: "/tmp",
            getSessionDir: (0, bun_test_1.mock)(() => sessionDir),
        };
        const session = new agentSession_1.AgentSession({
            workspaceId,
            config,
            historyService,
            partialService,
            aiService,
            initStateManager,
            backgroundProcessManager,
        });
        const options = {
            model: "openai:gpt-4o",
            agentId: "exec",
        };
        // Call streamWithHistory directly (private) to avoid needing a full user send pipeline.
        await session.streamWithHistory(options.model, options);
        // Wait for the retry call to happen.
        await Promise.race([
            secondCall,
            new Promise((_, reject) => setTimeout(() => reject(new Error("retry timeout")), 1000)),
        ]);
        (0, bun_test_1.expect)(streamMessage).toHaveBeenCalledTimes(2);
        const firstAttachments = streamMessage.mock
            .calls[0][12];
        (0, bun_test_1.expect)(Array.isArray(firstAttachments)).toBe(true);
        const secondAttachments = streamMessage.mock
            .calls[1][12];
        (0, bun_test_1.expect)(secondAttachments).toBeNull();
        (0, bun_test_1.expect)(historyService.deleteMessage.mock.calls[0][1]).toBe("assistant-ctx-exceeded");
        // Pending post-compaction state should be discarded.
        let exists = true;
        try {
            await fsPromises.stat(postCompactionPath);
        }
        catch {
            exists = false;
        }
        (0, bun_test_1.expect)(exists).toBe(false);
        session.dispose();
    });
});
//# sourceMappingURL=agentSession.postCompactionRetry.test.js.map