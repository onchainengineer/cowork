"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAgentInheritanceChain = resolveAgentInheritanceChain;
const log_1 = require("../../../node/services/log");
const agentDefinitionsService_1 = require("./agentDefinitionsService");
/**
 * Resolve an agent's `base` inheritance chain (starting at the selected agent).
 *
 * IMPORTANT: Tool-policy computation requires the base chain to be present.
 * Building an "all agents" set in callers is error-prone because base agents
 * can be workspace-defined (project/global) rather than built-ins.
 *
 * When resolving a base with the same ID as the current agent (e.g., project-scope
 * `exec.md` with `base: exec`), we skip the current scope to find global/built-in.
 */
async function resolveAgentInheritanceChain(options) {
    const { runtime, workspacePath, agentId, agentDefinition, workspaceId } = options;
    const maxDepth = options.maxDepth ?? agentDefinitionsService_1.MAX_INHERITANCE_DEPTH;
    const agentsForInheritance = [];
    const seenPackages = new Set();
    let currentAgentId = agentId;
    let currentDefinition = agentDefinition;
    for (let depth = 0; depth < maxDepth; depth++) {
        const visitKey = (0, agentDefinitionsService_1.agentVisitKey)(currentDefinition.id, currentDefinition.scope);
        if (seenPackages.has(visitKey)) {
            log_1.log.warn("Agent definition base chain has a cycle; stopping resolution", {
                workspaceId,
                agentId,
                currentAgentId,
                scope: currentDefinition.scope,
            });
            break;
        }
        seenPackages.add(visitKey);
        agentsForInheritance.push({
            id: currentAgentId,
            base: currentDefinition.frontmatter.base,
            tools: currentDefinition.frontmatter.tools,
            uiColor: currentDefinition.frontmatter.ui?.color,
        });
        const baseId = currentDefinition.frontmatter.base;
        if (!baseId) {
            break;
        }
        const skipScopesAbove = (0, agentDefinitionsService_1.computeBaseSkipScope)(baseId, currentAgentId, currentDefinition.scope);
        currentAgentId = baseId;
        try {
            currentDefinition = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, workspacePath, baseId, {
                skipScopesAbove,
            });
        }
        catch (error) {
            log_1.log.warn("Failed to load base agent definition; stopping inheritance resolution", {
                workspaceId,
                agentId,
                baseId,
                error: error instanceof Error ? error.message : String(error),
            });
            break;
        }
    }
    return agentsForInheritance;
}
//# sourceMappingURL=resolveAgentInheritanceChain.js.map