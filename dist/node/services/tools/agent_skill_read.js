"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentSkillReadTool = void 0;
const unixChat_1 = require("../../../common/constants/unixChat");
const builtInSkillDefinitions_1 = require("../../../node/services/agentSkills/builtInSkillDefinitions");
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const schemas_1 = require("../../../common/orpc/schemas");
const agentSkillsService_1 = require("../../../node/services/agentSkills/agentSkillsService");
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
/**
 * Agent Skill read tool factory.
 * Reads and validates a skill's SKILL.md from project-local or global skills roots.
 */
const createAgentSkillReadTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.agent_skill_read.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.agent_skill_read.schema,
        execute: async ({ name }) => {
            const workspacePath = config.cwd;
            if (!workspacePath) {
                return {
                    success: false,
                    error: "Tool misconfigured: cwd is required.",
                };
            }
            // Defensive: validate again even though inputSchema should guarantee shape.
            const parsedName = schemas_1.SkillNameSchema.safeParse(name);
            if (!parsedName.success) {
                return {
                    success: false,
                    error: parsedName.error.message,
                };
            }
            try {
                // Chat with Unix intentionally has no generic filesystem access. Restrict skill reads to
                // built-in skills (bundled in the app) so users can access help like `unix-docs` without
                // granting access to project/global skills on disk.
                if (config.workspaceId === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID) {
                    const builtIn = (0, builtInSkillDefinitions_1.getBuiltInSkillByName)(parsedName.data);
                    if (!builtIn) {
                        return {
                            success: false,
                            error: `Only built-in skills are available in Chat with Unix (requested: ${parsedName.data}).`,
                        };
                    }
                    return {
                        success: true,
                        skill: builtIn,
                    };
                }
                const resolved = await (0, agentSkillsService_1.readAgentSkill)(config.runtime, workspacePath, parsedName.data);
                return {
                    success: true,
                    skill: resolved.package,
                };
            }
            catch (error) {
                return {
                    success: false,
                    error: formatError(error),
                };
            }
        },
    });
};
exports.createAgentSkillReadTool = createAgentSkillReadTool;
//# sourceMappingURL=agent_skill_read.js.map