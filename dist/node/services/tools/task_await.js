"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskAwaitTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const taskId_1 = require("./taskId");
const bashTaskReport_1 = require("./bashTaskReport");
const toolUtils_1 = require("./toolUtils");
function coerceTimeoutMs(timeoutSecs) {
    if (typeof timeoutSecs !== "number" || !Number.isFinite(timeoutSecs))
        return undefined;
    if (timeoutSecs < 0)
        return undefined;
    const timeoutMs = Math.floor(timeoutSecs * 1000);
    return timeoutMs;
}
const createTaskAwaitTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.task_await.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.task_await.schema,
        execute: async (args, { abortSignal }) => {
            const workspaceId = (0, toolUtils_1.requireWorkspaceId)(config, "task_await");
            const taskService = (0, toolUtils_1.requireTaskService)(config, "task_await");
            const timeoutMs = coerceTimeoutMs(args.timeout_secs);
            const timeoutSecsForBash = args.timeout_secs;
            const requestedIds = args.task_ids && args.task_ids.length > 0 ? args.task_ids : null;
            let candidateTaskIds = requestedIds ?? taskService.listActiveDescendantAgentTaskIds(workspaceId);
            if (!requestedIds && config.backgroundProcessManager) {
                const processes = await config.backgroundProcessManager.list();
                const bashTaskIds = processes
                    .filter((proc) => {
                    if (proc.status !== "running")
                        return false;
                    return (proc.workspaceId === workspaceId ||
                        taskService.isDescendantAgentTask(workspaceId, proc.workspaceId));
                })
                    .map((proc) => (0, taskId_1.toBashTaskId)(proc.id));
                candidateTaskIds = [...candidateTaskIds, ...bashTaskIds];
            }
            const uniqueTaskIds = (0, toolUtils_1.dedupeStrings)(candidateTaskIds);
            const agentTaskIds = uniqueTaskIds.filter((taskId) => !taskId.startsWith("bash:"));
            const bulkFilter = taskService.filterDescendantAgentTaskIds;
            const descendantAgentTaskIdSet = new Set(typeof bulkFilter === "function"
                ? bulkFilter.call(taskService, workspaceId, agentTaskIds)
                : agentTaskIds.filter((taskId) => taskService.isDescendantAgentTask(workspaceId, taskId)));
            const results = await Promise.all(uniqueTaskIds.map(async (taskId) => {
                const maybeProcessId = (0, taskId_1.fromBashTaskId)(taskId);
                if (taskId.startsWith("bash:") && !maybeProcessId) {
                    return { status: "error", taskId, error: "Invalid bash taskId." };
                }
                if (maybeProcessId) {
                    if (!config.backgroundProcessManager) {
                        return {
                            status: "error",
                            taskId,
                            error: "Background process manager not available",
                        };
                    }
                    const proc = await config.backgroundProcessManager.getProcess(maybeProcessId);
                    if (!proc) {
                        return { status: "not_found", taskId };
                    }
                    const inScope = proc.workspaceId === workspaceId ||
                        taskService.isDescendantAgentTask(workspaceId, proc.workspaceId);
                    if (!inScope) {
                        return { status: "invalid_scope", taskId };
                    }
                    const outputResult = await config.backgroundProcessManager.getOutput(maybeProcessId, args.filter, args.filter_exclude, timeoutSecsForBash, abortSignal, workspaceId, "task_await");
                    if (!outputResult.success) {
                        return { status: "error", taskId, error: outputResult.error };
                    }
                    if (outputResult.status === "running" || outputResult.status === "interrupted") {
                        return {
                            status: "running",
                            taskId,
                            output: outputResult.output,
                            elapsed_ms: outputResult.elapsed_ms,
                            note: outputResult.note,
                        };
                    }
                    return {
                        status: "completed",
                        taskId,
                        title: proc.displayName ?? proc.id,
                        reportMarkdown: (0, bashTaskReport_1.formatBashOutputReport)({
                            processId: proc.id,
                            status: outputResult.status,
                            exitCode: outputResult.exitCode,
                            output: outputResult.output,
                        }),
                        elapsed_ms: outputResult.elapsed_ms,
                        exitCode: outputResult.exitCode,
                        note: outputResult.note,
                    };
                }
                if (!descendantAgentTaskIdSet.has(taskId)) {
                    return { status: "invalid_scope", taskId };
                }
                // When timeout_secs=0 (or rounds down to 0ms), task_await should be non-blocking.
                // `waitForAgentReport` asserts timeoutMs > 0, so handle 0 explicitly by returning the
                // current task status instead of awaiting.
                if (timeoutMs === 0) {
                    const status = taskService.getAgentTaskStatus(taskId);
                    if (status === "queued" || status === "running" || status === "awaiting_report") {
                        return { status, taskId };
                    }
                    // Best-effort: the task might already have a cached report (even if its workspace was
                    // cleaned up). Avoid blocking when it isn't available.
                    try {
                        const report = await taskService.waitForAgentReport(taskId, {
                            timeoutMs: 1,
                            abortSignal,
                            requestingWorkspaceId: workspaceId,
                        });
                        return {
                            status: "completed",
                            taskId,
                            reportMarkdown: report.reportMarkdown,
                            title: report.title,
                        };
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        if (/not found/i.test(message)) {
                            return { status: "not_found", taskId };
                        }
                        return { status: "error", taskId, error: message };
                    }
                }
                try {
                    const report = await taskService.waitForAgentReport(taskId, {
                        timeoutMs,
                        abortSignal,
                        requestingWorkspaceId: workspaceId,
                    });
                    return {
                        status: "completed",
                        taskId,
                        reportMarkdown: report.reportMarkdown,
                        title: report.title,
                    };
                }
                catch (error) {
                    if (abortSignal?.aborted) {
                        return { status: "error", taskId, error: "Interrupted" };
                    }
                    const message = error instanceof Error ? error.message : String(error);
                    if (/not found/i.test(message)) {
                        return { status: "not_found", taskId };
                    }
                    if (/timed out/i.test(message)) {
                        const status = taskService.getAgentTaskStatus(taskId);
                        if (status === "queued" || status === "running" || status === "awaiting_report") {
                            return { status, taskId };
                        }
                        if (!status) {
                            return { status: "not_found", taskId };
                        }
                        return {
                            status: "error",
                            taskId,
                            error: `Task status is '${status}' (not awaitable via task_await).`,
                        };
                    }
                    return { status: "error", taskId, error: message };
                }
            }));
            return (0, toolUtils_1.parseToolResult)(toolDefinitions_1.TaskAwaitToolResultSchema, { results }, "task_await");
        },
    });
};
exports.createTaskAwaitTool = createTaskAwaitTool;
//# sourceMappingURL=task_await.js.map