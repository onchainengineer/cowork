"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskTool = void 0;
const ai_1 = require("ai");
const thinking_1 = require("../../../common/types/thinking");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const log_1 = require("../../../node/services/log");
const toolUtils_1 = require("./toolUtils");
const createTaskTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.task.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.task.schema,
        execute: async (args, { abortSignal }) => {
            // Defensive: tool() should have already validated args via inputSchema,
            // but keep runtime validation here to preserve type-safety.
            const parsedArgs = toolDefinitions_1.TOOL_DEFINITIONS.task.schema.safeParse(args);
            if (!parsedArgs.success) {
                const keys = args && typeof args === "object" ? Object.keys(args) : [];
                log_1.log.warn("[task tool] Unexpected input validation failure (should have been caught by AI SDK)", {
                    issues: parsedArgs.error.issues,
                    keys,
                });
                throw new Error(`task tool input validation failed: ${parsedArgs.error.message}`);
            }
            const validatedArgs = parsedArgs.data;
            if (abortSignal?.aborted) {
                throw new Error("Interrupted");
            }
            const { agentId, subagent_type, prompt, title, run_in_background } = validatedArgs;
            const requestedAgentId = typeof agentId === "string" && agentId.trim().length > 0 ? agentId : subagent_type;
            if (!requestedAgentId || !prompt || !title) {
                throw new Error("task tool input validation failed: expected agent task args");
            }
            const workspaceId = (0, toolUtils_1.requireWorkspaceId)(config, "task");
            const taskService = (0, toolUtils_1.requireTaskService)(config, "task");
            // Disallow recursive sub-agent spawning.
            if (config.enableAgentReport) {
                throw new Error("Sub-agent workspaces may not spawn additional sub-agent tasks.");
            }
            // Plan agent is explicitly non-executing. Allow only read-only exploration tasks.
            if (config.planFileOnly && requestedAgentId !== "explore") {
                throw new Error('In the plan agent you may only spawn agentId: "explore" tasks.');
            }
            const modelString = config.muxEnv && typeof config.muxEnv.UNIX_MODEL_STRING === "string"
                ? config.muxEnv.UNIX_MODEL_STRING
                : undefined;
            const thinkingLevel = (0, thinking_1.coerceThinkingLevel)(config.muxEnv?.UNIX_THINKING_LEVEL);
            const created = await taskService.create({
                parentWorkspaceId: workspaceId,
                kind: "agent",
                agentId: requestedAgentId,
                // Legacy alias (persisted for older clients / on-disk compatibility).
                agentType: requestedAgentId,
                prompt,
                title,
                modelString,
                thinkingLevel,
                experiments: config.experiments,
            });
            if (!created.success) {
                throw new Error(created.error);
            }
            if (run_in_background) {
                return (0, toolUtils_1.parseToolResult)(toolDefinitions_1.TaskToolResultSchema, { status: created.data.status, taskId: created.data.taskId }, "task");
            }
            const report = await taskService.waitForAgentReport(created.data.taskId, {
                abortSignal,
                requestingWorkspaceId: workspaceId,
            });
            return (0, toolUtils_1.parseToolResult)(toolDefinitions_1.TaskToolResultSchema, {
                status: "completed",
                taskId: created.data.taskId,
                reportMarkdown: report.reportMarkdown,
                title: report.title,
                agentId: requestedAgentId,
                agentType: requestedAgentId,
            }, "task");
        },
    });
};
exports.createTaskTool = createTaskTool;
//# sourceMappingURL=task.js.map