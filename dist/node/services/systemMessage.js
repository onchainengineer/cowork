"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractToolInstructions = extractToolInstructions;
exports.readToolInstructions = readToolInstructions;
exports.buildSystemMessage = buildSystemMessage;
const runtime_1 = require("../../common/types/runtime");
const instructionFiles_1 = require("../../node/utils/main/instructionFiles");
const markdown_1 = require("../../node/utils/main/markdown");
const unixChat_1 = require("../../common/constants/unixChat");
const paths_1 = require("../../common/constants/paths");
const agentSkillsService_1 = require("../../node/services/agentSkills/agentSkillsService");
const log_1 = require("../../node/services/log");
const toolDefinitions_1 = require("../../common/utils/tools/toolDefinitions");
const assertNever_1 = require("../../common/utils/assertNever");
// NOTE: keep this in sync with the docs/models.md file
function sanitizeSectionTag(value, fallback) {
    const normalized = (value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/gi, "-")
        .replace(/-+/g, "-");
    return normalized.length > 0 ? normalized : fallback;
}
function buildTaggedSection(content, rawTagValue, fallback) {
    if (!content)
        return "";
    const tag = sanitizeSectionTag(rawTagValue, fallback);
    return `\n\n<${tag}>\n${content}\n</${tag}>`;
}
// #region SYSTEM_PROMPT_DOCS
// The PRELUDE is intentionally minimal to not conflict with the user's instructions.
// unix is designed to be model agnostic, and models have shown large inconsistency in how they
// follow instructions.
const PRELUDE = ` 
<prelude>
You are a coding agent called DEV OS.
  
<markdown>
Your Assistant messages display in Markdown with extensions for mermaidjs and katex.

When creating mermaid diagrams:
- Avoid side-by-side subgraphs (they display too wide)
- For comparisons, use separate diagram blocks or single graph with visual separation
- When using custom fill colors, include contrasting color property (e.g., "style note fill:#ff6b6b,color:#fff")
- Make good use of visual space: e.g. use inline commentary
- Wrap node labels containing brackets or special characters in quotes (e.g., Display["Message[]"] not Display[Message[]])

Use GitHub-style \`<details>/<summary>\` tags to create collapsible sections for lengthy content, error traces, or supplementary information. Toggles help keep responses scannable while preserving detail.
</markdown>

<memory>
When the user asks you to remember something:
- If it's about the general codebase: encode that lesson into the project's AGENTS.md file, matching its existing tone and structure.
- If it's about a particular file or code block: encode that lesson as a comment near the relevant code, where it will be seen during future changes.
</memory>
</prelude>
`;
/**
 * Build environment context XML block describing the workspace.
 * @param workspacePath - Workspace directory path
 * @param runtimeType - Runtime type (local, worktree, ssh, docker)
 */
function buildEnvironmentContext(workspacePath, runtimeType) {
    // Common lines shared across git-based runtimes
    const gitCommonLines = [
        "- This IS a git repository - run git commands directly (no cd needed)",
        "- Tools run here automatically",
        "- You are meant to do your work isolated from the user and other agents",
        "- Parent directories may contain other workspaces - do not confuse them with this project",
    ];
    let description;
    let lines;
    switch (runtimeType) {
        case runtime_1.RUNTIME_MODE.LOCAL:
            // Local runtime works directly in project directory - may or may not be git
            description = `You are working in a directory at ${workspacePath}`;
            lines = [
                "- Tools run here automatically",
                "- You are meant to do your work isolated from the user and other agents",
            ];
            break;
        case runtime_1.RUNTIME_MODE.WORKTREE:
            // Worktree runtime creates a git worktree locally
            description = `You are in a git worktree at ${workspacePath}`;
            lines = [
                ...gitCommonLines,
                "- Do not modify or visit other worktrees (especially the main project) without explicit user intent",
            ];
            break;
        case runtime_1.RUNTIME_MODE.SSH:
            // SSH runtime clones the repository on a remote host
            description = `You are in a clone of a git repository at ${workspacePath}`;
            lines = gitCommonLines;
            break;
        case runtime_1.RUNTIME_MODE.DOCKER:
            // Docker runtime runs in an isolated container
            description = `You are in a clone of a git repository at ${workspacePath} inside a Docker container`;
            lines = gitCommonLines;
            break;
        case runtime_1.RUNTIME_MODE.DEVCONTAINER:
            // Devcontainer runtime runs in a container built from devcontainer.json
            description = `You are in a git worktree at ${workspacePath} inside a Dev Container`;
            lines = gitCommonLines;
            break;
        default:
            (0, assertNever_1.assertNever)(runtimeType, `Unknown runtime type: ${String(runtimeType)}`);
    }
    // Remote runtimes: clarify that UNIX_PROJECT_PATH is the user's local path
    const isRemote = runtimeType === runtime_1.RUNTIME_MODE.SSH ||
        runtimeType === runtime_1.RUNTIME_MODE.DOCKER ||
        runtimeType === runtime_1.RUNTIME_MODE.DEVCONTAINER;
    if (isRemote) {
        lines = [
            ...lines,
            "- $UNIX_PROJECT_PATH refers to the user's local machine, not this environment",
        ];
    }
    return `
<environment>
${description}

${lines.join("\n")}
</environment>
`;
}
/**
 * Build MCP servers context XML block.
 * Only included when at least one MCP server is configured.
 * Note: We only expose server names, not commands, to avoid leaking secrets.
 */
async function buildAgentSkillsContext(runtime, workspacePath) {
    try {
        const skills = await (0, agentSkillsService_1.discoverAgentSkills)(runtime, workspacePath);
        if (skills.length === 0)
            return "";
        const MAX_SKILLS = 50;
        const shown = skills.slice(0, MAX_SKILLS);
        const omitted = skills.length - shown.length;
        const lines = [];
        lines.push("Available agent skills (call tools to load):");
        for (const skill of shown) {
            lines.push(`- ${skill.name}: ${skill.description} (scope: ${skill.scope})`);
        }
        if (omitted > 0) {
            lines.push(`(+${omitted} more not shown)`);
        }
        lines.push("");
        lines.push("To load a skill:");
        lines.push('- agent_skill_read({ name: "<skill-name>" })');
        lines.push("");
        lines.push("To read referenced files inside a skill directory:");
        lines.push('- agent_skill_read_file({ name: "<skill-name>", filePath: "references/whatever.txt" })');
        return `\n\n<agent-skills>\n${lines.join("\n")}\n</agent-skills>`;
    }
    catch (error) {
        log_1.log.warn("Failed to build agent skills context", { workspacePath, error });
        return "";
    }
}
function buildMCPContext(mcpServers) {
    const names = Object.keys(mcpServers);
    if (names.length === 0)
        return "";
    const serverList = names.map((name) => `- ${name}`).join("\n");
    return `
<mcp>
MCP (Model Context Protocol) servers provide additional tools. Configured in user's local project's .unix/mcp.jsonc:

${serverList}

Use /mcp add|edit|remove or Settings → Projects to manage servers.
</mcp>
`;
}
// #endregion SYSTEM_PROMPT_DOCS
/**
 * Get the system directory where global unix configuration lives.
 * Users can place global AGENTS.md and .unix/PLAN.md files here.
 */
function getSystemDirectory() {
    return (0, paths_1.getUnixHome)();
}
/**
 * Search instruction sources in priority order: agent → context → global.
 * Returns the first non-null result from the extractor function.
 */
function searchInstructionSources(sources, extractor) {
    // Priority: agent definition → workspace/project AGENTS.md → global AGENTS.md
    for (const src of [sources.agent, sources.context, sources.global]) {
        if (src) {
            const result = extractor(src);
            if (result !== null)
                return result;
        }
    }
    return null;
}
/**
 * Extract tool-specific instructions from instruction sources.
 * Searches agent instructions first, then context (workspace/project), then global.
 *
 * @param globalInstructions Global instructions from ~/.unix/AGENTS.md
 * @param contextInstructions Context instructions from workspace/project AGENTS.md
 * @param modelString Active model identifier to determine available tools
 * @param options.enableAgentReport Whether to include agent_report in available tools
 * @param options.agentInstructions Optional agent definition body (searched first)
 * @returns Map of tool names to their additional instructions
 */
function extractToolInstructions(globalInstructions, contextInstructions, modelString, options) {
    const availableTools = (0, toolDefinitions_1.getAvailableTools)(modelString, options);
    const toolInstructions = {};
    const sources = {
        agent: options?.agentInstructions,
        context: contextInstructions,
        global: globalInstructions,
    };
    for (const toolName of availableTools) {
        const content = searchInstructionSources(sources, (src) => (0, markdown_1.extractToolSection)(src, toolName));
        if (content) {
            toolInstructions[toolName] = content;
        }
    }
    return toolInstructions;
}
/**
 * Read instruction sources and extract tool-specific instructions.
 * Convenience wrapper that combines readInstructionSources and extractToolInstructions.
 *
 * @param metadata - Workspace metadata (contains projectPath)
 * @param runtime - Runtime for reading workspace files (supports SSH)
 * @param workspacePath - Workspace directory path
 * @param modelString - Active model identifier to determine available tools
 * @param agentInstructions - Optional agent definition body (searched first for tool sections)
 * @returns Map of tool names to their additional instructions
 */
async function readToolInstructions(metadata, runtime, workspacePath, modelString, agentInstructions) {
    const [globalInstructions, contextInstructions] = await readInstructionSources(metadata, runtime, workspacePath);
    return extractToolInstructions(globalInstructions, contextInstructions, modelString, {
        enableAgentReport: Boolean(metadata.parentWorkspaceId),
        enableUnixGlobalAgentsTools: metadata.id === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID,
        agentInstructions,
    });
}
/**
 * Read instruction sets from global and context sources.
 * Internal helper for buildSystemMessage and extractToolInstructions.
 *
 * @param metadata - Workspace metadata (contains projectPath)
 * @param runtime - Runtime for reading workspace files (supports SSH)
 * @param workspacePath - Workspace directory path
 * @returns Tuple of [globalInstructions, contextInstructions]
 */
async function readInstructionSources(metadata, runtime, workspacePath) {
    const globalInstructions = await (0, instructionFiles_1.readInstructionSet)(getSystemDirectory());
    const workspaceInstructions = await (0, instructionFiles_1.readInstructionSetFromRuntime)(runtime, workspacePath);
    const contextInstructions = workspaceInstructions ?? (await (0, instructionFiles_1.readInstructionSet)(metadata.projectPath));
    return [globalInstructions, contextInstructions];
}
/**
 * Builds a system message for the AI model by combining instruction sources.
 *
 * Instruction layers:
 * 1. Global: ~/.unix/AGENTS.md (always included)
 * 2. Context: workspace/AGENTS.md OR project/AGENTS.md (workspace takes precedence)
 * 3. Model: Extracts "Model: <regex>" section from context then global (if modelString provided)
 *
 * File search order: AGENTS.md → AGENT.md → CLAUDE.md
 * Local variants: AGENTS.local.md appended if found (for .gitignored personal preferences)
 *
 * @param metadata - Workspace metadata (contains projectPath)
 * @param runtime - Runtime for reading workspace files (supports SSH)
 * @param workspacePath - Workspace directory path
 * @param additionalSystemInstructions - Optional instructions appended last
 * @param modelString - Active model identifier used for Model-specific sections
 * @param mcpServers - Optional MCP server configuration (name -> command)
 * @throws Error if metadata or workspacePath invalid
 */
async function buildSystemMessage(metadata, runtime, workspacePath, additionalSystemInstructions, modelString, mcpServers, options) {
    if (!metadata)
        throw new Error("Invalid workspace metadata: metadata is required");
    if (!workspacePath)
        throw new Error("Invalid workspace path: workspacePath is required");
    // Read instruction sets
    // Get runtime type from metadata (defaults to "local" for legacy workspaces without runtimeConfig)
    const runtimeType = metadata.runtimeConfig?.type ?? "local";
    // Build system message
    let systemMessage = `${PRELUDE.trim()}\n\n${buildEnvironmentContext(workspacePath, runtimeType)}`;
    // Add MCP context if servers are configured
    if (mcpServers && Object.keys(mcpServers).length > 0) {
        systemMessage += buildMCPContext(mcpServers);
    }
    // Add agent skills context (if any)
    systemMessage += await buildAgentSkillsContext(runtime, workspacePath);
    // Read instruction sets
    const [globalInstructions, contextInstructions] = await readInstructionSources(metadata, runtime, workspacePath);
    const agentPrompt = options?.agentSystemPrompt?.trim() ?? null;
    // Combine: global + context (workspace takes precedence over project) after stripping scoped sections
    // Also strip scoped sections from agent prompt for consistency
    const sanitizeScopedInstructions = (input) => {
        if (!input)
            return undefined;
        const stripped = (0, markdown_1.stripScopedInstructionSections)(input);
        return stripped.trim().length > 0 ? stripped : undefined;
    };
    const sanitizedAgentPrompt = sanitizeScopedInstructions(agentPrompt);
    if (sanitizedAgentPrompt) {
        systemMessage += `\n<agent-instructions>\n${sanitizedAgentPrompt}\n</agent-instructions>`;
    }
    const customInstructionSources = [
        sanitizeScopedInstructions(globalInstructions),
        sanitizeScopedInstructions(contextInstructions),
    ].filter((value) => Boolean(value));
    const customInstructions = customInstructionSources.join("\n\n");
    // Extract model-specific section based on active model identifier
    const modelContent = modelString
        ? searchInstructionSources({ agent: agentPrompt, context: contextInstructions, global: globalInstructions }, (src) => (0, markdown_1.extractModelSection)(src, modelString))
        : null;
    if (customInstructions) {
        systemMessage += `\n<custom-instructions>\n${customInstructions}\n</custom-instructions>`;
    }
    if (modelContent && modelString) {
        const modelSection = buildTaggedSection(modelContent, `model-${modelString}`, "model");
        if (modelSection) {
            systemMessage += modelSection;
        }
    }
    if (additionalSystemInstructions) {
        systemMessage += `\n\n<additional-instructions>\n${additionalSystemInstructions}\n</additional-instructions>`;
    }
    return systemMessage;
}
//# sourceMappingURL=systemMessage.js.map