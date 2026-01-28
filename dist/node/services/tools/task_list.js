"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskListTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const taskId_1 = require("./taskId");
const toolUtils_1 = require("./toolUtils");
const DEFAULT_STATUSES = ["queued", "running", "awaiting_report"];
const createTaskListTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.task_list.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.task_list.schema,
        execute: async (args) => {
            const workspaceId = (0, toolUtils_1.requireWorkspaceId)(config, "task_list");
            const taskService = (0, toolUtils_1.requireTaskService)(config, "task_list");
            const statuses = args.statuses && args.statuses.length > 0 ? args.statuses : [...DEFAULT_STATUSES];
            const agentTasks = taskService.listDescendantAgentTasks(workspaceId, { statuses });
            const tasks = [...agentTasks];
            if (config.backgroundProcessManager) {
                const depthByWorkspaceId = new Map();
                depthByWorkspaceId.set(workspaceId, 0);
                for (const t of agentTasks) {
                    depthByWorkspaceId.set(t.taskId, t.depth);
                }
                const processes = await config.backgroundProcessManager.list();
                for (const proc of processes) {
                    const inScope = proc.workspaceId === workspaceId ||
                        taskService.isDescendantAgentTask(workspaceId, proc.workspaceId);
                    if (!inScope)
                        continue;
                    const status = proc.status === "running" ? "running" : "reported";
                    if (!statuses.includes(status))
                        continue;
                    const parentDepth = depthByWorkspaceId.get(proc.workspaceId) ?? 0;
                    tasks.push({
                        taskId: (0, taskId_1.toBashTaskId)(proc.id),
                        status,
                        parentWorkspaceId: proc.workspaceId,
                        title: proc.displayName ?? proc.id,
                        createdAt: new Date(proc.startTime).toISOString(),
                        depth: parentDepth + 1,
                    });
                }
            }
            return (0, toolUtils_1.parseToolResult)(toolDefinitions_1.TaskListToolResultSchema, { tasks }, "task_list");
        },
    });
};
exports.createTaskListTool = createTaskListTool;
//# sourceMappingURL=task_list.js.map