"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentReportTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const toolUtils_1 = require("./toolUtils");
const createAgentReportTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.agent_report.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.agent_report.schema,
        execute: () => {
            const workspaceId = (0, toolUtils_1.requireWorkspaceId)(config, "agent_report");
            const taskService = (0, toolUtils_1.requireTaskService)(config, "agent_report");
            if (taskService.hasActiveDescendantAgentTasksForWorkspace(workspaceId)) {
                throw new Error("agent_report rejected: this task still has running/queued descendant tasks. " +
                    "Call task_await (or wait for tasks to finish) before reporting.");
            }
            // Intentionally no side-effects. The backend orchestrator consumes the tool-call args
            // via persisted history/partial state once the tool call completes successfully.
            return { success: true };
        },
    });
};
exports.createAgentReportTool = createAgentReportTool;
//# sourceMappingURL=agent_report.js.map