"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBashBackgroundTerminateTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
/**
 * Tool for terminating background processes
 */
const createBashBackgroundTerminateTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.bash_background_terminate.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.bash_background_terminate.schema,
        execute: async ({ process_id }) => {
            if (!config.backgroundProcessManager) {
                return {
                    success: false,
                    error: "Background process manager not available",
                };
            }
            if (!config.workspaceId) {
                return {
                    success: false,
                    error: "Workspace ID not available",
                };
            }
            // Verify process belongs to this workspace before terminating
            const process = await config.backgroundProcessManager.getProcess(process_id);
            if (process?.workspaceId !== config.workspaceId) {
                return {
                    success: false,
                    error: `Process not found: ${process_id}`,
                };
            }
            const result = await config.backgroundProcessManager.terminate(process_id);
            if (result.success) {
                return {
                    success: true,
                    message: `Process ${process_id} terminated`,
                    display_name: process.displayName,
                };
            }
            return result;
        },
    });
};
exports.createBashBackgroundTerminateTool = createBashBackgroundTerminateTool;
//# sourceMappingURL=bash_background_terminate.js.map