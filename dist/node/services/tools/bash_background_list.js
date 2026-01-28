"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBashBackgroundListTool = void 0;
const ai_1 = require("ai");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
/**
 * Tool for listing background processes in the current workspace
 */
const createBashBackgroundListTool = (config) => {
    return (0, ai_1.tool)({
        description: toolDefinitions_1.TOOL_DEFINITIONS.bash_background_list.description,
        inputSchema: toolDefinitions_1.TOOL_DEFINITIONS.bash_background_list.schema,
        execute: async () => {
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
            const processes = await config.backgroundProcessManager.list(config.workspaceId);
            const now = Date.now();
            return {
                success: true,
                processes: processes.map((p) => ({
                    process_id: p.id,
                    status: p.status,
                    script: p.script,
                    uptime_ms: p.exitTime !== undefined ? p.exitTime - p.startTime : now - p.startTime,
                    exitCode: p.exitCode,
                    display_name: p.displayName,
                })),
            };
        },
    });
};
exports.createBashBackgroundListTool = createBashBackgroundListTool;
//# sourceMappingURL=bash_background_list.js.map