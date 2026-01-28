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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const config_1 = require("../../node/config");
const sessionTimingService_1 = require("./sessionTimingService");
const models_1 = require("../../common/utils/ai/models");
function createMockTelemetryService() {
    return {
        capture: (0, bun_test_1.mock)(() => undefined),
        getFeatureFlag: (0, bun_test_1.mock)(() => Promise.resolve(undefined)),
    };
}
(0, bun_test_1.describe)("SessionTimingService", () => {
    let tempDir;
    let config;
    (0, bun_test_1.beforeEach)(async () => {
        tempDir = path.join(os.tmpdir(), `unix-session-timing-test-${Date.now()}-${Math.random()}`);
        await fs.mkdir(tempDir, { recursive: true });
        config = new config_1.Config(tempDir);
    });
    (0, bun_test_1.afterEach)(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    });
    (0, bun_test_1.it)("persists aborted stream stats to session-timing.json", async () => {
        const telemetry = createMockTelemetryService();
        const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
        service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
        const workspaceId = "test-workspace";
        const messageId = "m1";
        const model = "openai:gpt-4o";
        const startTime = 1_000_000;
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            model,
            historySequence: 1,
            startTime,
            mode: "exec",
        });
        service.handleStreamDelta({
            type: "stream-delta",
            workspaceId,
            messageId,
            delta: "hi",
            tokens: 5,
            timestamp: startTime + 1000,
        });
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            args: { cmd: "echo hi" },
            tokens: 3,
            timestamp: startTime + 2000,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 3000,
        });
        service.handleStreamAbort({
            type: "stream-abort",
            workspaceId,
            messageId,
            metadata: {
                duration: 5000,
                usage: {
                    inputTokens: 1,
                    outputTokens: 10,
                    totalTokens: 11,
                    reasoningTokens: 2,
                },
            },
            abortReason: "system",
            abandonPartial: true,
        });
        await service.waitForIdle(workspaceId);
        const snapshot = await service.getSnapshot(workspaceId);
        (0, bun_test_1.expect)(snapshot.lastRequest?.messageId).toBe(messageId);
        (0, bun_test_1.expect)(snapshot.lastRequest?.totalDurationMs).toBe(5000);
        (0, bun_test_1.expect)(snapshot.lastRequest?.toolExecutionMs).toBe(1000);
        (0, bun_test_1.expect)(snapshot.lastRequest?.ttftMs).toBe(1000);
        (0, bun_test_1.expect)(snapshot.lastRequest?.streamingMs).toBe(3000);
        (0, bun_test_1.expect)(snapshot.lastRequest?.invalid).toBe(false);
        (0, bun_test_1.expect)(snapshot.session?.responseCount).toBe(1);
    });
    (0, bun_test_1.it)("ignores empty aborted streams", async () => {
        const telemetry = createMockTelemetryService();
        const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
        service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
        const workspaceId = "test-workspace";
        const messageId = "m1";
        const model = "openai:gpt-4o";
        const startTime = 1_000_000;
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            model,
            historySequence: 1,
            startTime,
            mode: "exec",
        });
        service.handleStreamAbort({
            type: "stream-abort",
            workspaceId,
            messageId,
            metadata: { duration: 1000 },
            abortReason: "user",
            abandonPartial: true,
        });
        await service.waitForIdle(workspaceId);
        const snapshot = await service.getSnapshot(workspaceId);
        (0, bun_test_1.expect)(snapshot.lastRequest).toBeUndefined();
        (0, bun_test_1.expect)(snapshot.session?.responseCount).toBe(0);
    });
    (0, bun_test_1.describe)("rollUpTimingIntoParent", () => {
        (0, bun_test_1.it)("should roll up child timing into parent without changing parent's lastRequest", async () => {
            const telemetry = createMockTelemetryService();
            const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
            service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
            const projectPath = "/tmp/unix-session-timing-rollup-test-project";
            const model = "openai:gpt-4o";
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
            // Parent stream.
            const parentMessageId = "p1";
            const startTimeParent = 1_000_000;
            service.handleStreamStart({
                type: "stream-start",
                workspaceId: parentWorkspaceId,
                messageId: parentMessageId,
                model,
                historySequence: 1,
                startTime: startTimeParent,
                mode: "exec",
            });
            service.handleStreamDelta({
                type: "stream-delta",
                workspaceId: parentWorkspaceId,
                messageId: parentMessageId,
                delta: "hi",
                tokens: 5,
                timestamp: startTimeParent + 1000,
            });
            service.handleToolCallStart({
                type: "tool-call-start",
                workspaceId: parentWorkspaceId,
                messageId: parentMessageId,
                toolCallId: "t1",
                toolName: "bash",
                args: { cmd: "echo hi" },
                tokens: 3,
                timestamp: startTimeParent + 2000,
            });
            service.handleToolCallEnd({
                type: "tool-call-end",
                workspaceId: parentWorkspaceId,
                messageId: parentMessageId,
                toolCallId: "t1",
                toolName: "bash",
                result: { ok: true },
                timestamp: startTimeParent + 3000,
            });
            service.handleStreamEnd({
                type: "stream-end",
                workspaceId: parentWorkspaceId,
                messageId: parentMessageId,
                metadata: {
                    model,
                    duration: 5000,
                    usage: {
                        inputTokens: 1,
                        outputTokens: 10,
                        totalTokens: 11,
                        reasoningTokens: 2,
                    },
                },
                parts: [],
            });
            // Child stream.
            const childMessageId = "c1";
            const startTimeChild = 2_000_000;
            service.handleStreamStart({
                type: "stream-start",
                workspaceId: childWorkspaceId,
                messageId: childMessageId,
                model,
                historySequence: 1,
                startTime: startTimeChild,
                mode: "exec",
            });
            service.handleStreamDelta({
                type: "stream-delta",
                workspaceId: childWorkspaceId,
                messageId: childMessageId,
                delta: "hi",
                tokens: 5,
                timestamp: startTimeChild + 200,
            });
            service.handleStreamEnd({
                type: "stream-end",
                workspaceId: childWorkspaceId,
                messageId: childMessageId,
                metadata: {
                    model,
                    duration: 1500,
                    usage: {
                        inputTokens: 1,
                        outputTokens: 5,
                        totalTokens: 6,
                    },
                },
                parts: [],
            });
            await service.waitForIdle(parentWorkspaceId);
            await service.waitForIdle(childWorkspaceId);
            const before = await service.getSnapshot(parentWorkspaceId);
            (0, bun_test_1.expect)(before.lastRequest?.messageId).toBe(parentMessageId);
            const beforeLastRequest = before.lastRequest;
            const rollupResult = await service.rollUpTimingIntoParent(parentWorkspaceId, childWorkspaceId);
            (0, bun_test_1.expect)(rollupResult.didRollUp).toBe(true);
            const after = await service.getSnapshot(parentWorkspaceId);
            // lastRequest is preserved
            (0, bun_test_1.expect)(after.lastRequest).toEqual(beforeLastRequest);
            (0, bun_test_1.expect)(after.session?.responseCount).toBe(2);
            (0, bun_test_1.expect)(after.session?.totalDurationMs).toBe(6500);
            (0, bun_test_1.expect)(after.session?.totalToolExecutionMs).toBe(1000);
            (0, bun_test_1.expect)(after.session?.totalStreamingMs).toBe(4300);
            (0, bun_test_1.expect)(after.session?.totalTtftMs).toBe(1200);
            (0, bun_test_1.expect)(after.session?.ttftCount).toBe(2);
            (0, bun_test_1.expect)(after.session?.totalOutputTokens).toBe(15);
            (0, bun_test_1.expect)(after.session?.totalReasoningTokens).toBe(2);
            const normalizedModel = (0, models_1.normalizeGatewayModel)(model);
            const key = `${normalizedModel}:exec`;
            (0, bun_test_1.expect)(after.session?.byModel[key]?.responseCount).toBe(2);
        });
        (0, bun_test_1.it)("should be idempotent for the same child workspace", async () => {
            const telemetry = createMockTelemetryService();
            const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
            service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
            const projectPath = "/tmp/unix-session-timing-rollup-test-project";
            const model = "openai:gpt-4o";
            const parentWorkspaceId = "parent-workspace";
            const childWorkspaceId = "child-workspace";
            await config.addWorkspace(projectPath, {
                id: parentWorkspaceId,
                name: "parent-branch",
                projectName: "test-project",
                projectPath,
                runtimeConfig: { type: "local" },
            });
            // Child stream.
            const childMessageId = "c1";
            const startTimeChild = 2_000_000;
            service.handleStreamStart({
                type: "stream-start",
                workspaceId: childWorkspaceId,
                messageId: childMessageId,
                model,
                historySequence: 1,
                startTime: startTimeChild,
                mode: "exec",
            });
            service.handleStreamDelta({
                type: "stream-delta",
                workspaceId: childWorkspaceId,
                messageId: childMessageId,
                delta: "hi",
                tokens: 5,
                timestamp: startTimeChild + 200,
            });
            service.handleStreamEnd({
                type: "stream-end",
                workspaceId: childWorkspaceId,
                messageId: childMessageId,
                metadata: {
                    model,
                    duration: 1500,
                    usage: {
                        inputTokens: 1,
                        outputTokens: 5,
                        totalTokens: 6,
                    },
                },
                parts: [],
            });
            await service.waitForIdle(childWorkspaceId);
            const first = await service.rollUpTimingIntoParent(parentWorkspaceId, childWorkspaceId);
            (0, bun_test_1.expect)(first.didRollUp).toBe(true);
            const second = await service.rollUpTimingIntoParent(parentWorkspaceId, childWorkspaceId);
            (0, bun_test_1.expect)(second.didRollUp).toBe(false);
            const result = await service.getSnapshot(parentWorkspaceId);
            (0, bun_test_1.expect)(result.session?.responseCount).toBe(1);
            const timingFilePath = path.join(config.getSessionDir(parentWorkspaceId), "session-timing.json");
            const raw = await fs.readFile(timingFilePath, "utf-8");
            const parsed = JSON.parse(raw);
            (0, bun_test_1.expect)(parsed.rolledUpFrom?.[childWorkspaceId]).toBe(true);
        });
    });
    (0, bun_test_1.it)("persists completed stream stats to session-timing.json", async () => {
        const telemetry = createMockTelemetryService();
        const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
        service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
        const workspaceId = "test-workspace";
        const messageId = "m1";
        const model = "openai:gpt-4o";
        const startTime = 1_000_000;
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            model,
            historySequence: 1,
            startTime,
            mode: "exec",
        });
        service.handleStreamDelta({
            type: "stream-delta",
            workspaceId,
            messageId,
            delta: "hi",
            tokens: 5,
            timestamp: startTime + 1000,
        });
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            args: { cmd: "echo hi" },
            tokens: 3,
            timestamp: startTime + 2000,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 3000,
        });
        service.handleStreamEnd({
            type: "stream-end",
            workspaceId,
            messageId,
            metadata: {
                model,
                duration: 5000,
                usage: {
                    inputTokens: 1,
                    outputTokens: 10,
                    totalTokens: 11,
                    reasoningTokens: 2,
                },
            },
            parts: [],
        });
        await service.waitForIdle(workspaceId);
        const filePath = path.join(config.getSessionDir(workspaceId), "session-timing.json");
        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        (0, bun_test_1.expect)(typeof parsed).toBe("object");
        (0, bun_test_1.expect)(parsed).not.toBeNull();
        const file = await service.getSnapshot(workspaceId);
        (0, bun_test_1.expect)(file.lastRequest?.messageId).toBe(messageId);
        (0, bun_test_1.expect)(file.lastRequest?.totalDurationMs).toBe(5000);
        (0, bun_test_1.expect)(file.lastRequest?.toolExecutionMs).toBe(1000);
        (0, bun_test_1.expect)(file.lastRequest?.ttftMs).toBe(1000);
        (0, bun_test_1.expect)(file.lastRequest?.streamingMs).toBe(3000);
        (0, bun_test_1.expect)(file.lastRequest?.invalid).toBe(false);
        (0, bun_test_1.expect)(file.session?.responseCount).toBe(1);
        (0, bun_test_1.expect)(file.session?.totalDurationMs).toBe(5000);
        (0, bun_test_1.expect)(file.session?.totalToolExecutionMs).toBe(1000);
        (0, bun_test_1.expect)(file.session?.totalStreamingMs).toBe(3000);
        (0, bun_test_1.expect)(file.session?.totalOutputTokens).toBe(10);
        (0, bun_test_1.expect)(file.session?.totalReasoningTokens).toBe(2);
        const normalizedModel = (0, models_1.normalizeGatewayModel)(model);
        const key = `${normalizedModel}:exec`;
        (0, bun_test_1.expect)(file.session?.byModel[key]).toBeDefined();
        (0, bun_test_1.expect)(file.session?.byModel[key]?.responseCount).toBe(1);
    });
    (0, bun_test_1.it)("ignores replayed events so timing stats aren't double-counted", async () => {
        const telemetry = createMockTelemetryService();
        const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
        service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
        const workspaceId = "test-workspace";
        const messageId = "m1";
        const model = "openai:gpt-4o";
        const startTime = 4_000_000;
        // Normal completed stream
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            model,
            historySequence: 1,
            startTime,
            mode: "exec",
        });
        service.handleStreamDelta({
            type: "stream-delta",
            workspaceId,
            messageId,
            delta: "hi",
            tokens: 5,
            timestamp: startTime + 1000,
        });
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            args: { cmd: "echo hi" },
            tokens: 3,
            timestamp: startTime + 2000,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 3000,
        });
        service.handleStreamEnd({
            type: "stream-end",
            workspaceId,
            messageId,
            metadata: {
                model,
                duration: 5000,
                usage: {
                    inputTokens: 1,
                    outputTokens: 10,
                    totalTokens: 11,
                },
            },
            parts: [],
        });
        await service.waitForIdle(workspaceId);
        const timingFilePath = path.join(config.getSessionDir(workspaceId), "session-timing.json");
        const beforeRaw = await fs.readFile(timingFilePath, "utf-8");
        const beforeSnapshot = await service.getSnapshot(workspaceId);
        (0, bun_test_1.expect)(beforeSnapshot.active).toBeUndefined();
        (0, bun_test_1.expect)(beforeSnapshot.lastRequest?.messageId).toBe(messageId);
        // Replay the same events (e.g., reconnect)
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            replay: true,
            model,
            historySequence: 1,
            startTime,
            mode: "exec",
        });
        service.handleStreamDelta({
            type: "stream-delta",
            workspaceId,
            messageId,
            replay: true,
            delta: "hi",
            tokens: 5,
            timestamp: startTime + 1000,
        });
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            replay: true,
            toolCallId: "t1",
            toolName: "bash",
            args: { cmd: "echo hi" },
            tokens: 3,
            timestamp: startTime + 2000,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            replay: true,
            toolCallId: "t1",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 3000,
        });
        await service.waitForIdle(workspaceId);
        const afterRaw = await fs.readFile(timingFilePath, "utf-8");
        const afterSnapshot = await service.getSnapshot(workspaceId);
        (0, bun_test_1.expect)(afterRaw).toBe(beforeRaw);
        (0, bun_test_1.expect)(afterSnapshot.active).toBeUndefined();
        (0, bun_test_1.expect)(afterSnapshot.lastRequest).toEqual(beforeSnapshot.lastRequest);
        (0, bun_test_1.expect)(afterSnapshot.session).toEqual(beforeSnapshot.session);
    });
    (0, bun_test_1.it)("does not double-count overlapping tool calls", async () => {
        const telemetry = createMockTelemetryService();
        const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
        service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
        const workspaceId = "test-workspace";
        const messageId = "m1";
        const model = "openai:gpt-4o";
        const startTime = 3_000_000;
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            model,
            historySequence: 1,
            startTime,
            mode: "exec",
        });
        // First token arrives quickly.
        service.handleStreamDelta({
            type: "stream-delta",
            workspaceId,
            messageId,
            delta: "hi",
            tokens: 2,
            timestamp: startTime + 500,
        });
        // Two tools overlap: [1000, 3000] and [1500, 4000]
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            args: { cmd: "sleep 2" },
            tokens: 1,
            timestamp: startTime + 1000,
        });
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            toolCallId: "t2",
            toolName: "bash",
            args: { cmd: "sleep 3" },
            tokens: 1,
            timestamp: startTime + 1500,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 3000,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            toolCallId: "t2",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 4000,
        });
        service.handleStreamEnd({
            type: "stream-end",
            workspaceId,
            messageId,
            metadata: {
                model,
                duration: 5000,
                usage: {
                    inputTokens: 1,
                    outputTokens: 1,
                    totalTokens: 2,
                },
            },
            parts: [],
        });
        await service.waitForIdle(workspaceId);
        const snapshot = await service.getSnapshot(workspaceId);
        (0, bun_test_1.expect)(snapshot.lastRequest?.totalDurationMs).toBe(5000);
        // Tool wall-time should be the union: [1000, 4000] = 3000ms.
        (0, bun_test_1.expect)(snapshot.lastRequest?.toolExecutionMs).toBe(3000);
        (0, bun_test_1.expect)(snapshot.lastRequest?.toolExecutionMs).toBeLessThanOrEqual(snapshot.lastRequest?.totalDurationMs ?? 0);
        (0, bun_test_1.expect)(snapshot.lastRequest?.ttftMs).toBe(500);
        (0, bun_test_1.expect)(snapshot.lastRequest?.streamingMs).toBe(1500);
        (0, bun_test_1.expect)(snapshot.lastRequest?.invalid).toBe(false);
    });
    (0, bun_test_1.it)("emits invalid timing telemetry when tool percent would exceed 100%", async () => {
        const telemetry = createMockTelemetryService();
        const service = new sessionTimingService_1.SessionTimingService(config, telemetry);
        service.setStatsTabState({ enabled: true, variant: "stats", override: "default" });
        const workspaceId = "test-workspace";
        const messageId = "m1";
        const model = "openai:gpt-4o";
        const startTime = 2_000_000;
        service.handleStreamStart({
            type: "stream-start",
            workspaceId,
            messageId,
            model,
            historySequence: 1,
            startTime,
        });
        // Tool runs 10s, but we lie in metadata.duration=1s.
        service.handleToolCallStart({
            type: "tool-call-start",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            args: { cmd: "sleep" },
            tokens: 1,
            timestamp: startTime + 100,
        });
        service.handleToolCallEnd({
            type: "tool-call-end",
            workspaceId,
            messageId,
            toolCallId: "t1",
            toolName: "bash",
            result: { ok: true },
            timestamp: startTime + 10_100,
        });
        service.handleStreamEnd({
            type: "stream-end",
            workspaceId,
            messageId,
            metadata: {
                model,
                duration: 1000,
                usage: {
                    inputTokens: 1,
                    outputTokens: 1,
                    totalTokens: 2,
                },
            },
            parts: [],
        });
        await service.waitForIdle(workspaceId);
        (0, bun_test_1.expect)(telemetry.capture).toHaveBeenCalled();
        // Bun's mock() returns a callable with `.mock.calls`, but our TelemetryService typing
        // does not expose that. Introspect via unknown.
        const calls = telemetry.capture.mock
            .calls;
        const invalidCalls = calls.filter((c) => {
            const payload = c[0];
            if (!payload || typeof payload !== "object") {
                return false;
            }
            return ("event" in payload && payload.event === "stream_timing_invalid");
        });
        (0, bun_test_1.expect)(invalidCalls.length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=sessionTimingService.test.js.map