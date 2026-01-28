"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapWithInitWait = wrapWithInitWait;
/**
 * Wraps a tool to wait for workspace initialization before execution.
 *
 * This wrapper handles the cross-cutting concern of init state waiting,
 * keeping individual tools simple and focused on their core functionality.
 *
 * Only runtime-dependent tools (bash, file_read, file_edit_*) need this wrapper.
 * Non-runtime tools (propose_plan, todo, web_search) execute immediately.
 *
 * @param tool The tool to wrap (returned from a tool factory)
 * @param workspaceId Workspace ID for init state tracking
 * @param initStateManager Init state manager for waiting
 * @returns Wrapped tool that waits for init before executing
 */
function wrapWithInitWait(tool, workspaceId, initStateManager) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
        ...tool,
        execute: async (args, options) => {
            // Wait for workspace initialization to complete (no-op if not needed)
            // This never throws - tools proceed regardless of init outcome
            await initStateManager.waitForInit(workspaceId);
            // Execute the actual tool with all arguments
            if (!tool.execute) {
                throw new Error("Tool does not have an execute function");
            }
            return tool.execute(args, options);
        },
    };
}
//# sourceMappingURL=wrapWithInitWait.js.map