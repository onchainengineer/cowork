"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProposePlanTool = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const helpers_1 = require("../../../node/utils/runtime/helpers");
const Runtime_1 = require("../../../node/runtime/Runtime");
// Schema for propose_plan - empty object (no input parameters)
// Defined locally to avoid type inference issues with `as const` in TOOL_DEFINITIONS
const proposePlanSchema = zod_1.z.object({});
/**
 * Propose plan tool factory for AI assistant.
 * The tool validates the plan file exists and is non-empty.
 * If the plan file doesn't exist, it returns an error instructing
 * the agent to write the plan first.
 *
 * Note: Plan content is NOT included in the tool result to save context.
 * The plan is already visible via file_edit_* diffs in history, and will be
 * included in the mode transition message when switching to exec mode.
 */
const createProposePlanTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.propose_plan.description,
        inputSchema: proposePlanSchema,
        execute: async () => {
            const planPath = config.planFilePath;
            if (!planPath) {
                return {
                    success: false,
                    error: "No plan file path configured. Are you in the plan agent?",
                };
            }
            // Read plan file using workspace runtime (works for both local and SSH)
            let planContent;
            try {
                planContent = await (0, helpers_1.readFileString)(config.runtime, planPath);
            }
            catch (err) {
                if (err instanceof Runtime_1.RuntimeError) {
                    return {
                        success: false,
                        error: `No plan file found at ${planPath}. Please write your plan to this file before calling propose_plan.`,
                    };
                }
                throw err;
            }
            if (planContent === "") {
                return {
                    success: false,
                    error: `Plan file at ${planPath} is empty. Please write your plan content before calling propose_plan.`,
                };
            }
            // Record file state for external edit detection
            if (config.recordFileState) {
                try {
                    const fileStat = await config.runtime.stat(planPath);
                    config.recordFileState(planPath, {
                        content: planContent,
                        timestamp: fileStat.modifiedTime.getTime(),
                    });
                }
                catch {
                    // File stat failed, skip recording (shouldn't happen since we just read it)
                }
            }
            return {
                success: true,
                planPath,
                message: "Plan proposed. Waiting for user approval.",
            };
        },
    });
};
exports.createProposePlanTool = createProposePlanTool;
//# sourceMappingURL=propose_plan.js.map