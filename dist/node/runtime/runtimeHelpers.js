"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRuntimeForWorkspace = createRuntimeForWorkspace;
const runtimeFactory_1 = require("./runtimeFactory");
/**
 * Create a runtime from workspace metadata, ensuring workspaceName is always passed.
 *
 * Use this helper when creating a runtime from workspace metadata to ensure
 * DevcontainerRuntime.currentWorkspacePath is set, enabling host-path reads
 * (stat, readFile, etc.) before the container is ready.
 */
function createRuntimeForWorkspace(metadata) {
    return (0, runtimeFactory_1.createRuntime)(metadata.runtimeConfig, {
        projectPath: metadata.projectPath,
        workspaceName: metadata.name,
    });
}
//# sourceMappingURL=runtimeHelpers.js.map