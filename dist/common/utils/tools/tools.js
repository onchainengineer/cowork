"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolsForModel = getToolsForModel;
const unixChat_1 = require("../../../common/constants/unixChat");
const assert_1 = __importDefault(require("../../../common/utils/assert"));
const file_read_1 = require("../../../node/services/tools/file_read");
const bash_1 = require("../../../node/services/tools/bash");
const bash_output_1 = require("../../../node/services/tools/bash_output");
const bash_background_list_1 = require("../../../node/services/tools/bash_background_list");
const bash_background_terminate_1 = require("../../../node/services/tools/bash_background_terminate");
const file_edit_replace_string_1 = require("../../../node/services/tools/file_edit_replace_string");
// DISABLED: import { createFileEditReplaceLinesTool } from "../../../node/services/tools/file_edit_replace_lines";
const file_edit_insert_1 = require("../../../node/services/tools/file_edit_insert");
const ask_user_question_1 = require("../../../node/services/tools/ask_user_question");
const propose_plan_1 = require("../../../node/services/tools/propose_plan");
const todo_1 = require("../../../node/services/tools/todo");
const status_set_1 = require("../../../node/services/tools/status_set");
const notify_1 = require("../../../node/services/tools/notify");
const task_1 = require("../../../node/services/tools/task");
const task_await_1 = require("../../../node/services/tools/task_await");
const task_terminate_1 = require("../../../node/services/tools/task_terminate");
const task_list_1 = require("../../../node/services/tools/task_list");
const agent_skill_read_1 = require("../../../node/services/tools/agent_skill_read");
const agent_skill_read_file_1 = require("../../../node/services/tools/agent_skill_read_file");
const unix_global_agents_read_1 = require("../../../node/services/tools/unix_global_agents_read");
const unix_global_agents_write_1 = require("../../../node/services/tools/unix_global_agents_write");
const agent_report_1 = require("../../../node/services/tools/agent_report");
const system1_keep_ranges_1 = require("../../../node/services/tools/system1_keep_ranges");
const wrapWithInitWait_1 = require("../../../node/services/tools/wrapWithInitWait");
const withHooks_1 = require("../../../node/services/tools/withHooks");
const log_1 = require("../../../node/services/log");
const internalToolResultFields_1 = require("../../../common/utils/tools/internalToolResultFields");
const NotificationEngine_1 = require("../../../node/services/agentNotifications/NotificationEngine");
const TodoListReminderSource_1 = require("../../../node/services/agentNotifications/sources/TodoListReminderSource");
const toolDefinitions_1 = require("../../../common/utils/tools/toolDefinitions");
const schemaSanitizer_1 = require("../../../common/utils/tools/schemaSanitizer");
/**
 * Augment a tool's description with additional instructions from "Tool: <name>" sections
 * Mutates the base tool in place to append the instructions to its description.
 * This preserves any provider-specific metadata or internal state on the tool object.
 * @param baseTool The original tool to augment
 * @param additionalInstructions Additional instructions to append to the description
 * @returns The same tool instance with the augmented description
 */
function augmentToolDescription(baseTool, additionalInstructions) {
    // Access the tool as a record to get its properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseToolRecord = baseTool;
    const originalDescription = typeof baseToolRecord.description === "string" ? baseToolRecord.description : "";
    const augmentedDescription = `${originalDescription}\n\n${additionalInstructions}`;
    // Mutate the description in place to preserve other properties (e.g. provider metadata)
    baseToolRecord.description = augmentedDescription;
    return baseTool;
}
function cloneToolPreservingDescriptors(tool) {
    (0, assert_1.default)(tool && typeof tool === "object", "tool must be an object");
    // Clone the tool without invoking getters (important for some dynamic tools).
    const prototype = Object.getPrototypeOf(tool);
    (0, assert_1.default)(prototype === null || typeof prototype === "object", "tool prototype must be an object or null");
    const clone = Object.create(prototype);
    Object.defineProperties(clone, Object.getOwnPropertyDescriptors(tool));
    return clone;
}
function wrapToolExecuteWithModelOnlyNotifications(toolName, baseTool, engine) {
    // Access the tool as a record to get its properties.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseToolRecord = baseTool;
    const originalExecute = baseToolRecord.execute;
    if (typeof originalExecute !== "function") {
        return baseTool;
    }
    const executeFn = originalExecute;
    // Avoid mutating cached tools in place (e.g. MCP tools cached per workspace).
    // Repeated getToolsForModel() calls should not stack wrappers.
    const wrappedTool = cloneToolPreservingDescriptors(baseTool);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrappedToolRecord = wrappedTool;
    wrappedToolRecord.execute = async (args, options) => {
        try {
            const result = await executeFn.call(baseTool, args, options);
            let notifications = [];
            try {
                notifications = await engine.pollAfterToolCall({
                    toolName,
                    toolSucceeded: true,
                    now: Date.now(),
                });
            }
            catch (error) {
                log_1.log.debug("[getToolsForModel] notification poll failed", { error, toolName });
            }
            return (0, internalToolResultFields_1.attachModelOnlyToolNotifications)(result, notifications);
        }
        catch (error) {
            try {
                await engine.pollAfterToolCall({
                    toolName,
                    toolSucceeded: false,
                    now: Date.now(),
                });
            }
            catch (pollError) {
                log_1.log.debug("[getToolsForModel] notification poll failed", { pollError, toolName });
            }
            throw error;
        }
    };
    return wrappedTool;
}
function wrapToolsWithModelOnlyNotifications(tools, config) {
    if (!config.workspaceSessionDir) {
        return tools;
    }
    const engine = new NotificationEngine_1.NotificationEngine([
        new TodoListReminderSource_1.TodoListReminderSource({ workspaceSessionDir: config.workspaceSessionDir }),
    ]);
    const wrappedTools = {};
    for (const [toolName, tool] of Object.entries(tools)) {
        wrappedTools[toolName] = wrapToolExecuteWithModelOnlyNotifications(toolName, tool, engine);
    }
    return wrappedTools;
}
/**
 * Wrap tools with hook support.
 *
 * If any of these exist, each tool execution is wrapped:
 * - `.lattice/tool_pre` (pre-hook)
 * - `.lattice/tool_post` (post-hook)
 * - `.lattice/tool_hook` (legacy pre+post)
 */
function wrapToolsWithHooks(tools, config) {
    // Hooks require workspaceId, cwd, and runtime
    if (!config.workspaceId || !config.cwd || !config.runtime) {
        return tools;
    }
    const hookConfig = {
        runtime: config.runtime,
        cwd: config.cwd,
        runtimeTempDir: config.runtimeTempDir,
        workspaceId: config.workspaceId,
        // Match bash tool behavior: muxEnv is present and secrets override it.
        env: {
            ...(config.muxEnv ?? {}),
            ...(config.secrets ?? {}),
        },
    };
    const wrappedTools = {};
    for (const [toolName, tool] of Object.entries(tools)) {
        wrappedTools[toolName] = (0, withHooks_1.withHooks)(toolName, tool, hookConfig);
    }
    return wrappedTools;
}
/**
 * Get tools available for a specific model with configuration
 *
 * Providers are lazy-loaded to reduce startup time. AI SDK providers are only
 * imported when actually needed for a specific model.
 *
 * @param modelString The model string in format "provider:model-id"
 * @param config Required configuration for tools
 * @param workspaceId Workspace ID for init state tracking (required for runtime tools)
 * @param initStateManager Init state manager for runtime tools to wait for initialization
 * @param toolInstructions Optional map of tool names to additional instructions from "Tool: <name>" sections
 * @returns Promise resolving to record of tools available for the model
 */
async function getToolsForModel(modelString, config, workspaceId, initStateManager, toolInstructions, mcpTools) {
    const [provider, modelId] = modelString.split(":");
    // Helper to reduce repetition when wrapping runtime tools
    const wrap = (tool) => (0, wrapWithInitWait_1.wrapWithInitWait)(tool, workspaceId, initStateManager);
    // Lazy-load web_fetch to avoid loading jsdom (ESM-only) at Jest setup time
    // This allows integration tests to run without transforming jsdom's dependencies
    const { createWebFetchTool } = await Promise.resolve().then(() => __importStar(require("../../../node/services/tools/web_fetch")));
    // Runtime-dependent tools need to wait for workspace initialization
    // Wrap them to handle init waiting centrally instead of in each tool
    const runtimeTools = {
        file_read: wrap((0, file_read_1.createFileReadTool)(config)),
        agent_skill_read: wrap((0, agent_skill_read_1.createAgentSkillReadTool)(config)),
        agent_skill_read_file: wrap((0, agent_skill_read_file_1.createAgentSkillReadFileTool)(config)),
        file_edit_replace_string: wrap((0, file_edit_replace_string_1.createFileEditReplaceStringTool)(config)),
        file_edit_insert: wrap((0, file_edit_insert_1.createFileEditInsertTool)(config)),
        // DISABLED: file_edit_replace_lines - causes models (particularly GPT-5-Codex)
        // to leave repository in broken state due to issues with concurrent file modifications
        // and line number miscalculations. Use file_edit_replace_string instead.
        // file_edit_replace_lines: wrap(createFileEditReplaceLinesTool(config)),
        // Sub-agent task orchestration (child workspaces)
        task: wrap((0, task_1.createTaskTool)(config)),
        task_await: wrap((0, task_await_1.createTaskAwaitTool)(config)),
        task_terminate: wrap((0, task_terminate_1.createTaskTerminateTool)(config)),
        task_list: wrap((0, task_list_1.createTaskListTool)(config)),
        // Bash execution (foreground/background). Manage background output via task_await/task_list/task_terminate.
        bash: wrap((0, bash_1.createBashTool)(config)),
        // Legacy bash process tools (deprecated)
        bash_output: wrap((0, bash_output_1.createBashOutputTool)(config)),
        bash_background_list: wrap((0, bash_background_list_1.createBashBackgroundListTool)(config)),
        bash_background_terminate: wrap((0, bash_background_terminate_1.createBashBackgroundTerminateTool)(config)),
        web_fetch: wrap(createWebFetchTool(config)),
    };
    // Non-runtime tools execute immediately (no init wait needed)
    // Note: Tool availability is controlled by agent tool policy (allowlist), not mode checks here.
    const nonRuntimeTools = {
        unix_global_agents_read: (0, unix_global_agents_read_1.createUnixGlobalAgentsReadTool)(config),
        unix_global_agents_write: (0, unix_global_agents_write_1.createUnixGlobalAgentsWriteTool)(config),
        ask_user_question: (0, ask_user_question_1.createAskUserQuestionTool)(config),
        propose_plan: (0, propose_plan_1.createProposePlanTool)(config),
        ...(config.enableAgentReport ? { agent_report: (0, agent_report_1.createAgentReportTool)(config) } : {}),
        system1_keep_ranges: (0, system1_keep_ranges_1.createSystem1KeepRangesTool)(config),
        todo_write: (0, todo_1.createTodoWriteTool)(config),
        todo_read: (0, todo_1.createTodoReadTool)(config),
        status_set: (0, status_set_1.createStatusSetTool)(config),
        notify: (0, notify_1.createNotifyTool)(config),
    };
    // Base tools available for all models
    const baseTools = {
        ...runtimeTools,
        ...nonRuntimeTools,
    };
    // Try to add provider-specific web search tools if available
    // Lazy-load providers to avoid loading all AI SDKs at startup
    let allTools = { ...baseTools, ...(mcpTools ?? {}) };
    try {
        switch (provider) {
            case "anthropic": {
                const { anthropic } = await Promise.resolve().then(() => __importStar(require("@ai-sdk/anthropic")));
                allTools = {
                    ...baseTools,
                    ...(mcpTools ?? {}),
                    // Provider-specific tool types are compatible with Tool at runtime
                    web_search: anthropic.tools.webSearch_20250305({ maxUses: 1000 }),
                };
                break;
            }
            case "openai": {
                // Sanitize MCP tools for OpenAI's stricter JSON Schema validation.
                // OpenAI's Responses API doesn't support certain schema properties like
                // minLength, maximum, default, etc. that are valid JSON Schema but not
                // accepted by OpenAI's Structured Outputs implementation.
                const sanitizedMcpTools = mcpTools ? (0, schemaSanitizer_1.sanitizeMCPToolsForOpenAI)(mcpTools) : {};
                // Only add web search for models that support it
                if (modelId.includes("gpt-5") || modelId.includes("gpt-4")) {
                    const { openai } = await Promise.resolve().then(() => __importStar(require("@ai-sdk/openai")));
                    allTools = {
                        ...baseTools,
                        ...sanitizedMcpTools,
                        // Provider-specific tool types are compatible with Tool at runtime
                        web_search: openai.tools.webSearch({
                            searchContextSize: "high",
                        }),
                    };
                }
                else {
                    // For other OpenAI models (o1, o3, etc.), still use sanitized MCP tools
                    allTools = {
                        ...baseTools,
                        ...sanitizedMcpTools,
                    };
                }
                break;
            }
            // Note: Gemini 3 tool support:
            // Combining native tools with function calling is currently only
            // supported in the Live API. Thus no `google_search` or `url_context` added here.
            // - https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#native-tools
        }
    }
    catch (error) {
        // If tools aren't available, just use base tools
        log_1.log.error(`No web search tools available for ${provider}:`, error);
    }
    // Filter tools to the canonical allowlist so system prompt + toolset stay in sync.
    // Include MCP tools even if they're not in getAvailableTools().
    const allowlistedToolNames = new Set((0, toolDefinitions_1.getAvailableTools)(modelString, {
        enableAgentReport: config.enableAgentReport,
        enableUnixGlobalAgentsTools: workspaceId === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID,
    }));
    for (const toolName of Object.keys(mcpTools ?? {})) {
        allowlistedToolNames.add(toolName);
    }
    allTools = Object.fromEntries(Object.entries(allTools).filter(([toolName]) => allowlistedToolNames.has(toolName)));
    let finalTools = allTools;
    // Apply tool-specific instructions if provided
    if (toolInstructions) {
        const augmentedTools = {};
        for (const [toolName, baseTool] of Object.entries(allTools)) {
            const instructions = toolInstructions[toolName];
            if (instructions) {
                augmentedTools[toolName] = augmentToolDescription(baseTool, instructions);
            }
            else {
                augmentedTools[toolName] = baseTool;
            }
        }
        finalTools = augmentedTools;
    }
    // Apply hook wrapping first (hooks wrap each tool execution)
    finalTools = wrapToolsWithHooks(finalTools, config);
    // Then apply model-only notifications (adds notifications to results)
    finalTools = wrapToolsWithModelOnlyNotifications(finalTools, config);
    return finalTools;
}
//# sourceMappingURL=tools.js.map