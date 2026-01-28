"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskTerminateTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const taskId_1 = require("./taskId");
const toolUtils_1 = require("./toolUtils");
const createTaskTerminateTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.task_terminate.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.task_terminate.schema,
        execute: async (args) => {
            const workspaceId = (0, toolUtils_1.requireWorkspaceId)(config, "task_terminate");
            const taskService = (0, toolUtils_1.requireTaskService)(config, "task_terminate");
            const uniqueTaskIds = (0, toolUtils_1.dedupeStrings)(args.task_ids);
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
                    const terminateResult = await config.backgroundProcessManager.terminate(maybeProcessId);
                    if (!terminateResult.success) {
                        return { status: "error", taskId, error: terminateResult.error };
                    }
                    return {
                        status: "terminated",
                        taskId,
                        terminatedTaskIds: [taskId],
                    };
                }
                const terminateResult = await taskService.terminateDescendantAgentTask(workspaceId, taskId);
                if (!terminateResult.success) {
                    const msg = terminateResult.error;
                    if (/not found/i.test(msg)) {
                        return { status: "not_found", taskId };
                    }
                    if (/descendant/i.test(msg) || /scope/i.test(msg)) {
                        return { status: "invalid_scope", taskId };
                    }
                    return { status: "error", taskId, error: msg };
                }
                return {
                    status: "terminated",
                    taskId,
                    terminatedTaskIds: terminateResult.data.terminatedTaskIds,
                };
            }));
            return (0, toolUtils_1.parseToolResult)(toolDefinitions_1.TaskTerminateToolResultSchema, { results }, "task_terminate");
        },
    });
};
exports.createTaskTerminateTool = createTaskTerminateTool;
//# sourceMappingURL=task_terminate.js.map