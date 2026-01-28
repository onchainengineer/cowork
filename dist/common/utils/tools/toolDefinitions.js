"use strict";
/**
 * Tool definitions module - Frontend-safe
 *
 * Single source of truth for all tool definitions.
 * Zod schemas are defined here and JSON schemas are auto-generated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESULT_SCHEMAS = exports.WebFetchToolResultSchema = exports.FileEditReplaceStringToolResultSchema = exports.FileEditInsertToolResultSchema = exports.AgentSkillReadFileToolResultSchema = exports.AgentSkillReadToolResultSchema = exports.FileReadToolResultSchema = exports.UnixGlobalAgentsWriteToolResultSchema = exports.UnixGlobalAgentsReadToolResultSchema = exports.BashBackgroundTerminateResultSchema = exports.BashBackgroundListResultSchema = exports.BashOutputToolResultSchema = exports.BashToolResultSchema = exports.TOOL_DEFINITIONS = exports.AgentReportToolResultSchema = exports.AgentReportToolArgsSchema = exports.TaskListToolResultSchema = exports.TaskListToolTaskSchema = exports.TaskListToolArgsSchema = exports.TaskTerminateToolResultSchema = exports.TaskTerminateToolErrorResultSchema = exports.TaskTerminateToolInvalidScopeResultSchema = exports.TaskTerminateToolNotFoundResultSchema = exports.TaskTerminateToolTerminatedResultSchema = exports.TaskTerminateToolArgsSchema = exports.TaskAwaitToolResultSchema = exports.TaskAwaitToolErrorResultSchema = exports.TaskAwaitToolInvalidScopeResultSchema = exports.TaskAwaitToolNotFoundResultSchema = exports.TaskAwaitToolActiveResultSchema = exports.TaskAwaitToolCompletedResultSchema = exports.TaskAwaitToolArgsSchema = exports.TaskToolResultSchema = exports.TaskToolCompletedResultSchema = exports.TaskToolQueuedResultSchema = exports.TaskToolArgsSchema = exports.AskUserQuestionToolResultSchema = exports.AskUserQuestionToolArgsSchema = exports.AskUserQuestionQuestionSchema = exports.AskUserQuestionOptionSchema = void 0;
exports.getToolSchemas = getToolSchemas;
exports.getAvailableTools = getAvailableTools;
const zod_1 = require("zod");
const schemas_1 = require("../../../common/orpc/schemas");
const toolLimits_1 = require("../../../common/constants/toolLimits");
const tools_1 = require("../../../common/types/tools");
const tasks_1 = require("../../../common/types/tasks");
const zod_to_json_schema_1 = require("zod-to-json-schema");
// -----------------------------------------------------------------------------
// ask_user_question (plan-mode interactive questions)
// -----------------------------------------------------------------------------
exports.AskUserQuestionOptionSchema = zod_1.z
    .object({
    label: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
})
    .strict();
exports.AskUserQuestionQuestionSchema = zod_1.z
    .object({
    question: zod_1.z.string().min(1),
    header: zod_1.z.string().min(1).max(32).describe("Short label shown in the UI (keep it concise)"),
    options: zod_1.z.array(exports.AskUserQuestionOptionSchema).min(2).max(4),
    multiSelect: zod_1.z.boolean(),
})
    .strict()
    .superRefine((question, ctx) => {
    const labels = question.options.map((o) => o.label);
    const labelSet = new Set(labels);
    if (labelSet.size !== labels.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Option labels must be unique within a question",
            path: ["options"],
        });
    }
    // Claude Code provides "Other" automatically; do not include it explicitly.
    if (labels.some((label) => label.trim().toLowerCase() === "other")) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Do not include an 'Other' option; it is provided automatically",
            path: ["options"],
        });
    }
});
const AskUserQuestionUiOnlySchema = zod_1.z.object({
    questions: zod_1.z.array(exports.AskUserQuestionQuestionSchema),
    answers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
const ToolOutputUiOnlySchema = zod_1.z.object({
    ask_user_question: AskUserQuestionUiOnlySchema.optional(),
    file_edit: zod_1.z
        .object({
        diff: zod_1.z.string(),
    })
        .optional(),
    notify: zod_1.z
        .object({
        notifiedVia: zod_1.z.enum(["electron", "browser"]),
        workspaceId: zod_1.z.string().optional(),
    })
        .optional(),
});
const ToolOutputUiOnlyFieldSchema = {
    ui_only: ToolOutputUiOnlySchema.optional(),
};
exports.AskUserQuestionToolArgsSchema = zod_1.z
    .object({
    questions: zod_1.z.array(exports.AskUserQuestionQuestionSchema).min(1).max(4),
    // Optional prefilled answers (Claude Code supports this, though Unix typically won't use it)
    answers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
})
    .strict()
    .superRefine((args, ctx) => {
    const questionTexts = args.questions.map((q) => q.question);
    const questionTextSet = new Set(questionTexts);
    if (questionTextSet.size !== questionTexts.length) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Question text must be unique across questions",
            path: ["questions"],
        });
    }
});
const AskUserQuestionToolSummarySchema = zod_1.z
    .object({
    summary: zod_1.z.string(),
})
    .extend(ToolOutputUiOnlyFieldSchema);
const AskUserQuestionToolLegacySchema = zod_1.z
    .object({
    questions: zod_1.z.array(exports.AskUserQuestionQuestionSchema),
    answers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
})
    .strict();
exports.AskUserQuestionToolResultSchema = zod_1.z.union([
    AskUserQuestionToolSummarySchema,
    AskUserQuestionToolLegacySchema,
]);
// -----------------------------------------------------------------------------
// task (sub-workspaces as subagents)
// -----------------------------------------------------------------------------
const SubagentTypeSchema = zod_1.z.preprocess((value) => (typeof value === "string" ? value.trim().toLowerCase() : value), schemas_1.AgentIdSchema);
const TaskAgentIdSchema = zod_1.z.preprocess((value) => (typeof value === "string" ? value.trim().toLowerCase() : value), schemas_1.AgentIdSchema);
const TaskToolAgentArgsSchema = zod_1.z
    .object({
    // Prefer agentId. subagent_type is a deprecated alias for backwards compatibility.
    agentId: TaskAgentIdSchema.optional(),
    subagent_type: SubagentTypeSchema.optional(),
    prompt: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    run_in_background: zod_1.z.boolean().default(false),
})
    .strict()
    .superRefine((args, ctx) => {
    const hasAgentId = typeof args.agentId === "string" && args.agentId.length > 0;
    const hasSubagentType = typeof args.subagent_type === "string" && args.subagent_type.length > 0;
    if (!hasAgentId && !hasSubagentType) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Provide agentId (preferred) or subagent_type",
            path: ["agentId"],
        });
        return;
    }
    if (hasAgentId && hasSubagentType) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Provide only one of agentId or subagent_type (not both)",
            path: ["agentId"],
        });
        return;
    }
});
exports.TaskToolArgsSchema = TaskToolAgentArgsSchema;
exports.TaskToolQueuedResultSchema = zod_1.z
    .object({
    status: zod_1.z.enum(["queued", "running"]),
    taskId: zod_1.z.string(),
})
    .strict();
exports.TaskToolCompletedResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("completed"),
    taskId: zod_1.z.string().optional(),
    reportMarkdown: zod_1.z.string(),
    title: zod_1.z.string().optional(),
    agentId: zod_1.z.string().optional(),
    agentType: zod_1.z.string().optional(),
})
    .strict();
exports.TaskToolResultSchema = zod_1.z.discriminatedUnion("status", [
    exports.TaskToolQueuedResultSchema,
    exports.TaskToolCompletedResultSchema,
]);
// -----------------------------------------------------------------------------
// task_await (await one or more sub-agent tasks)
// -----------------------------------------------------------------------------
exports.TaskAwaitToolArgsSchema = zod_1.z
    .object({
    task_ids: zod_1.z
        .array(zod_1.z.string().min(1))
        .optional()
        .describe("List of task IDs to await. When omitted, waits for all active descendant tasks of the current workspace."),
    filter: zod_1.z
        .string()
        .optional()
        .describe("Optional regex to filter bash task output lines. By default, only matching lines are returned. " +
        "When filter_exclude is true, matching lines are excluded instead. " +
        "Non-matching lines are discarded and cannot be retrieved later."),
    filter_exclude: zod_1.z
        .boolean()
        .optional()
        .describe("When true, lines matching 'filter' are excluded instead of kept. " +
        "Requires 'filter' to be set."),
    timeout_secs: zod_1.z
        .number()
        .min(0)
        .optional()
        .default(600)
        .describe("Maximum time to wait in seconds for each task. " +
        "For bash tasks, this waits for NEW output (or process exit). " +
        "If exceeded, the result returns status=queued|running|awaiting_report (task is still active). " +
        "Defaults to 600 seconds (10 minutes) if not specified. " +
        "Set to 0 for a non-blocking status check."),
})
    .strict()
    .superRefine((args, ctx) => {
    if (args.filter_exclude && !args.filter) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "filter_exclude requires filter to be set",
            path: ["filter_exclude"],
        });
    }
});
exports.TaskAwaitToolCompletedResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("completed"),
    taskId: zod_1.z.string(),
    reportMarkdown: zod_1.z.string(),
    title: zod_1.z.string().optional(),
    output: zod_1.z.string().optional(),
    elapsed_ms: zod_1.z.number().optional(),
    exitCode: zod_1.z.number().optional(),
    note: zod_1.z.string().optional(),
})
    .strict();
exports.TaskAwaitToolActiveResultSchema = zod_1.z
    .object({
    status: zod_1.z.enum(["queued", "running", "awaiting_report"]),
    taskId: zod_1.z.string(),
    output: zod_1.z.string().optional(),
    elapsed_ms: zod_1.z.number().optional(),
    note: zod_1.z.string().optional(),
})
    .strict();
exports.TaskAwaitToolNotFoundResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("not_found"),
    taskId: zod_1.z.string(),
})
    .strict();
exports.TaskAwaitToolInvalidScopeResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("invalid_scope"),
    taskId: zod_1.z.string(),
})
    .strict();
exports.TaskAwaitToolErrorResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("error"),
    taskId: zod_1.z.string(),
    error: zod_1.z.string(),
})
    .strict();
exports.TaskAwaitToolResultSchema = zod_1.z
    .object({
    results: zod_1.z.array(zod_1.z.discriminatedUnion("status", [
        exports.TaskAwaitToolCompletedResultSchema,
        exports.TaskAwaitToolActiveResultSchema,
        exports.TaskAwaitToolNotFoundResultSchema,
        exports.TaskAwaitToolInvalidScopeResultSchema,
        exports.TaskAwaitToolErrorResultSchema,
    ])),
})
    .strict();
// -----------------------------------------------------------------------------
// task_terminate (terminate one or more sub-agent tasks)
// -----------------------------------------------------------------------------
exports.TaskTerminateToolArgsSchema = zod_1.z
    .object({
    task_ids: zod_1.z
        .array(zod_1.z.string().min(1))
        .min(1)
        .describe("List of task IDs to terminate. Each must be a descendant sub-agent task of the current workspace."),
})
    .strict();
exports.TaskTerminateToolTerminatedResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("terminated"),
    taskId: zod_1.z.string(),
    terminatedTaskIds: zod_1.z
        .array(zod_1.z.string())
        .describe("All terminated task IDs (includes descendants)"),
})
    .strict();
exports.TaskTerminateToolNotFoundResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("not_found"),
    taskId: zod_1.z.string(),
})
    .strict();
exports.TaskTerminateToolInvalidScopeResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("invalid_scope"),
    taskId: zod_1.z.string(),
})
    .strict();
exports.TaskTerminateToolErrorResultSchema = zod_1.z
    .object({
    status: zod_1.z.literal("error"),
    taskId: zod_1.z.string(),
    error: zod_1.z.string(),
})
    .strict();
exports.TaskTerminateToolResultSchema = zod_1.z
    .object({
    results: zod_1.z.array(zod_1.z.discriminatedUnion("status", [
        exports.TaskTerminateToolTerminatedResultSchema,
        exports.TaskTerminateToolNotFoundResultSchema,
        exports.TaskTerminateToolInvalidScopeResultSchema,
        exports.TaskTerminateToolErrorResultSchema,
    ])),
})
    .strict();
// -----------------------------------------------------------------------------
// task_list (list descendant sub-agent tasks)
// -----------------------------------------------------------------------------
const TaskListStatusSchema = zod_1.z.enum(["queued", "running", "awaiting_report", "reported"]);
const TaskListThinkingLevelSchema = zod_1.z.enum(["off", "low", "medium", "high", "xhigh"]);
exports.TaskListToolArgsSchema = zod_1.z
    .object({
    statuses: zod_1.z
        .array(TaskListStatusSchema)
        .optional()
        .describe("Task statuses to include. Defaults to active tasks: queued, running, awaiting_report."),
})
    .strict();
exports.TaskListToolTaskSchema = zod_1.z
    .object({
    taskId: zod_1.z.string(),
    status: TaskListStatusSchema,
    parentWorkspaceId: zod_1.z.string(),
    agentType: zod_1.z.string().optional(),
    workspaceName: zod_1.z.string().optional(),
    title: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().optional(),
    modelString: zod_1.z.string().optional(),
    thinkingLevel: TaskListThinkingLevelSchema.optional(),
    depth: zod_1.z.number().int().min(0),
})
    .strict();
exports.TaskListToolResultSchema = zod_1.z
    .object({
    tasks: zod_1.z.array(exports.TaskListToolTaskSchema),
})
    .strict();
// -----------------------------------------------------------------------------
// agent_report (explicit subagent -> parent report)
// -----------------------------------------------------------------------------
exports.AgentReportToolArgsSchema = zod_1.z
    .object({
    reportMarkdown: zod_1.z.string().min(1),
    title: zod_1.z.string().optional(),
})
    .strict();
exports.AgentReportToolResultSchema = zod_1.z.object({ success: zod_1.z.literal(true) }).strict();
const FILE_EDIT_FILE_PATH = zod_1.z
    .string()
    .describe("Path to the file to edit (absolute or relative to the current workspace)");
/**
 * Tool definitions: single source of truth
 * Key = tool name, Value = { description, schema }
 */
exports.TOOL_DEFINITIONS = {
    bash: {
        description: "Execute a bash command with a configurable timeout. " +
            `Output is strictly limited to ${toolLimits_1.BASH_HARD_MAX_LINES} lines, ${toolLimits_1.BASH_MAX_LINE_BYTES} bytes per line, and ${toolLimits_1.BASH_MAX_TOTAL_BYTES} bytes total. ` +
            "Commands that exceed these limits will FAIL with an error (no partial output returned). " +
            "Be conservative: use 'head', 'tail', 'grep', or other filters to limit output before running commands. " +
            "Large outputs may be automatically filtered; when this happens, the result includes a note explaining what was kept and (if available) where the full output was saved.",
        schema: zod_1.z.preprocess((value) => {
            // Compatibility: some models emit { command: "..." } instead of { script: "..." }.
            // Normalize to `script` so downstream code (tool runner + UI) stays consistent.
            if (typeof value !== "object" || value === null || Array.isArray(value))
                return value;
            const obj = value;
            if (typeof obj.script === "string")
                return value;
            if (typeof obj.command === "string") {
                // Drop the legacy field to keep tool args canonical (and avoid confusing downstream consumers).
                const { command, ...rest } = obj;
                return { ...rest, script: command };
            }
            return value;
        }, zod_1.z.object({
            script: zod_1.z.string().describe("The bash script/command to execute"),
            timeout_secs: zod_1.z
                .number()
                .positive()
                .describe("Timeout in seconds. For foreground: max execution time before kill. " +
                "For background: max lifetime before auto-termination. " +
                "Start small and increase on retry; avoid large initial values to keep UX responsive"),
            run_in_background: zod_1.z
                .boolean()
                .default(false)
                .describe("Run this command in the background without blocking. " +
                "Use for processes running >5s (dev servers, builds, file watchers). " +
                "Do NOT use for quick commands (<5s), interactive processes (no stdin support), " +
                "or processes requiring real-time output (use foreground with larger timeout instead). " +
                "Returns immediately with a taskId (bash:<processId>) and backgroundProcessId. " +
                "Read output with task_await (returns only new output since last check). " +
                "Terminate with task_terminate using the taskId. " +
                "List active tasks with task_list. " +
                "Process persists until timeout_secs expires, terminated, or workspace is removed." +
                "\\n\\nFor long-running tasks like builds or compilations, prefer background mode to continue productive work in parallel. " +
                "Check back periodically with task_await rather than blocking on completion."),
            display_name: zod_1.z
                .string()
                .describe("Human-readable name for the process (e.g., 'Dev Server', 'TypeCheck Watch'). " +
                "Required for all bash invocations since any process can be sent to background."),
        })),
    },
    file_read: {
        description: "Read the contents of a file from the file system. Read as little as possible to complete the task.",
        schema: zod_1.z.object({
            file_path: zod_1.z.string().describe("The path to the file to read (absolute or relative)"),
            offset: zod_1.z
                .number()
                .int()
                .positive()
                .optional()
                .describe("1-based starting line number (optional, defaults to 1)"),
            limit: zod_1.z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Number of lines to return from offset (optional, returns all if not specified)"),
        }),
    },
    unix_global_agents_read: {
        description: "Read the global AGENTS.md file (unix-wide agent instructions) from the unix home directory.",
        schema: zod_1.z.object({}).strict(),
    },
    unix_global_agents_write: {
        description: "Write the global AGENTS.md file (unix-wide agent instructions) in the unix home directory. " +
            "Requires explicit confirmation via confirm: true.",
        schema: zod_1.z
            .object({
            newContent: zod_1.z.string().describe("The full new contents of the global AGENTS.md file"),
            confirm: zod_1.z
                .boolean()
                .describe("Must be true to apply the write. The agent should ask the user for confirmation first."),
        })
            .strict(),
    },
    agent_skill_read: {
        description: "Load an Agent Skill's SKILL.md (YAML frontmatter + markdown body) by name. " +
            "Skills are discovered from <projectRoot>/.unix/skills/<name>/SKILL.md and ~/.unix/skills/<name>/SKILL.md.",
        schema: zod_1.z
            .object({
            name: schemas_1.SkillNameSchema.describe("Skill name (directory name under the skills root)"),
        })
            .strict(),
    },
    agent_skill_read_file: {
        description: "Read a file within an Agent Skill directory. " +
            "filePath must be relative to the skill directory (no absolute paths, no ~, no .. traversal). " +
            "Supports offset/limit like file_read.",
        schema: zod_1.z
            .object({
            name: schemas_1.SkillNameSchema.describe("Skill name (directory name under the skills root)"),
            filePath: zod_1.z
                .string()
                .min(1)
                .describe("Path to the file within the skill directory (relative)"),
            offset: zod_1.z
                .number()
                .int()
                .positive()
                .optional()
                .describe("1-based starting line number (optional, defaults to 1)"),
            limit: zod_1.z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Number of lines to return from offset (optional, returns all if not specified)"),
        })
            .strict(),
    },
    file_edit_replace_string: {
        description: "⚠️ CRITICAL: Always check tool results - edits WILL fail if old_string is not found or unique. Do not proceed with dependent operations (commits, pushes, builds) until confirming success.\n\n" +
            "Apply one or more edits to a file by replacing exact text matches. All edits are applied sequentially. Each old_string must be unique in the file unless replace_count > 1 or replace_count is -1.",
        schema: zod_1.z.object({
            file_path: FILE_EDIT_FILE_PATH,
            old_string: zod_1.z
                .string()
                .describe("The exact text to replace (must be unique in file if replace_count is 1). Include enough context (indentation, surrounding lines) to make it unique."),
            new_string: zod_1.z.string().describe("The replacement text"),
            replace_count: zod_1.z
                .number()
                .int()
                .optional()
                .describe("Number of occurrences to replace (default: 1). Use -1 to replace all occurrences. If 1, old_string must be unique in the file."),
        }),
    },
    file_edit_replace_lines: {
        description: "⚠️ CRITICAL: Always check tool results - edits WILL fail if line numbers are invalid or file content has changed. Do not proceed with dependent operations (commits, pushes, builds) until confirming success.\n\n" +
            "Replace a range of lines in a file. Use this for line-based edits when you know the exact line numbers to modify.",
        schema: zod_1.z.object({
            file_path: FILE_EDIT_FILE_PATH,
            start_line: zod_1.z.number().int().min(1).describe("1-indexed start line (inclusive) to replace"),
            end_line: zod_1.z.number().int().min(1).describe("1-indexed end line (inclusive) to replace"),
            new_lines: zod_1.z
                .array(zod_1.z.string())
                .describe("Replacement lines. Provide an empty array to delete the specified range."),
            expected_lines: zod_1.z
                .array(zod_1.z.string())
                .optional()
                .describe("Optional safety check. When provided, the current lines in the specified range must match exactly."),
        }),
    },
    file_edit_insert: {
        description: "Insert content into a file using substring guards. " +
            "Provide exactly one of before or after to anchor the operation when editing an existing file. " +
            "When the file does not exist, it is created automatically without guards. " +
            "Optional before/after substrings must uniquely match surrounding content. " +
            "Avoid short guards like `}` or `}\\n` that match multiple locations — " +
            `use longer patterns like full function signatures or unique comments. ${tools_1.TOOL_EDIT_WARNING}`,
        schema: zod_1.z
            .object({
            file_path: FILE_EDIT_FILE_PATH,
            content: zod_1.z.string().describe("The content to insert"),
            before: zod_1.z
                .string()
                .min(1)
                .optional()
                .describe("Optional substring that must appear immediately before the insertion point"),
            after: zod_1.z
                .string()
                .min(1)
                .optional()
                .describe("Optional substring that must appear immediately after the insertion point"),
        })
            .refine((data) => !(data.before !== undefined && data.after !== undefined), {
            message: "Provide only one of before or after (not both).",
            path: ["before"],
        }),
    },
    ask_user_question: {
        description: "Ask 1–4 multiple-choice questions (with optional multi-select) and wait for the user's answers. " +
            "This tool is intended for plan mode and MUST be used when you need user clarification to complete the plan. " +
            "Do not output a list of open questions; ask them via this tool instead. " +
            "Each question must include 2–4 options; an 'Other' choice is provided automatically.",
        schema: exports.AskUserQuestionToolArgsSchema,
    },
    propose_plan: {
        description: "Signal that your plan is complete and ready for user approval. " +
            "This tool reads the plan from the plan file you wrote. " +
            "You must write your plan to the plan file before calling this tool. " +
            "After calling this tool, do not paste the plan contents or mention the plan file path; the UI already shows the full plan.",
        schema: zod_1.z.object({}),
    },
    task: {
        description: "Spawn a sub-agent task (child workspace). " +
            "\n\nProvide subagent_type, prompt, title, run_in_background. " +
            "\n\nIf run_in_background is false, waits for the sub-agent to finish and returns a completed reportMarkdown. " +
            "If run_in_background is true, returns a queued/running taskId; use task_await to wait for completion, task_list to rediscover active tasks, and task_terminate to stop it. " +
            "Use the bash tool to run shell commands.",
        schema: exports.TaskToolArgsSchema,
    },
    task_await: {
        description: "Wait for one or more tasks to produce output. " +
            "Agent tasks return reports when completed. " +
            "Bash tasks return incremental output while running and a final reportMarkdown when they exit. " +
            "For bash tasks, you may optionally pass filter/filter_exclude to include/exclude output lines by regex. " +
            "WARNING: when using filter, non-matching lines are permanently discarded. " +
            "Use this tool to WAIT; do not poll task_list in a loop to wait for task completion (that is misuse and wastes tool calls). " +
            "This is similar to Promise.allSettled(): you always get per-task results. " +
            "Possible statuses: completed, queued, running, awaiting_report, not_found, invalid_scope, error. " +
            "Bash task outputs may be automatically filtered; when this happens, check each result's note for details and (if available) where the full output was saved.",
        schema: exports.TaskAwaitToolArgsSchema,
    },
    task_terminate: {
        description: "Terminate one or more tasks immediately (sub-agent tasks or background bash tasks). " +
            "For sub-agent tasks, this stops their AI streams and deletes their workspaces (best-effort). " +
            "No report will be delivered; any in-progress work is discarded. " +
            "If the task has descendant sub-agent tasks, they are terminated too.",
        schema: exports.TaskTerminateToolArgsSchema,
    },
    task_list: {
        description: "List descendant tasks for the current workspace, including status + metadata. " +
            "This includes sub-agent tasks and background bash tasks. " +
            "Use this after compaction or interruptions to rediscover which tasks are still active. " +
            "This is a discovery tool, NOT a waiting mechanism: if you need to wait for tasks to finish, call task_await (optionally omit task_ids to await all active descendant tasks).",
        schema: exports.TaskListToolArgsSchema,
    },
    agent_report: {
        description: "Report the final result of a sub-agent task back to the parent workspace. " +
            "Call this exactly once when you have a final answer (after any spawned sub-tasks complete).",
        schema: exports.AgentReportToolArgsSchema,
    },
    system1_keep_ranges: {
        description: "Internal tool used by unix to record which line ranges to keep when filtering large bash output.",
        schema: zod_1.z
            .object({
            keep_ranges: zod_1.z
                .array(zod_1.z
                .object({
                start: zod_1.z.coerce
                    .number()
                    .finite()
                    .min(1)
                    .describe("1-based start line (inclusive) in the numbered output"),
                end: zod_1.z.coerce
                    .number()
                    .finite()
                    .min(1)
                    .describe("1-based end line (inclusive) in the numbered output"),
                reason: zod_1.z
                    .preprocess((value) => (value === null ? undefined : value), zod_1.z.string().optional())
                    .describe("Optional short reason for keeping this range"),
            })
                // Providers/models sometimes include extra keys in tool arguments; be permissive and
                // ignore them rather than failing the whole compaction call.
                .passthrough())
                .min(1)
                // Allow at least as many ranges as the user can request via maxKeptLines.
                // (In the worst case, the model may emit one 1-line range per kept line.)
                .max(tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.max)
                .describe("Line ranges to keep"),
        })
            .passthrough(),
    },
    todo_write: {
        description: "Create or update the todo list for tracking multi-step tasks (limit: 7 items). " +
            "The TODO list is displayed to the user at all times. " +
            "Replace the entire list on each call - the AI tracks which tasks are completed.\n" +
            "\n" +
            "Mark ONE task as in_progress at a time. " +
            "Order tasks as: completed first, then in_progress (max 1), then pending last. " +
            "Use appropriate tense in content: past tense for completed (e.g., 'Added tests'), " +
            "present progressive for in_progress (e.g., 'Adding tests'), " +
            "and imperative/infinitive for pending (e.g., 'Add tests').\n" +
            "\n" +
            "If you hit the 7-item limit, summarize older completed items into one line " +
            "(e.g., 'Completed initial setup (3 tasks)').\n" +
            "\n" +
            "Update the list as work progresses. If work fails or the approach changes, update " +
            "the list to reflect reality - only mark tasks complete when they actually succeed.",
        schema: zod_1.z.object({
            todos: zod_1.z.array(zod_1.z.object({
                content: zod_1.z
                    .string()
                    .describe("Task description with tense matching status: past for completed, present progressive for in_progress, imperative for pending"),
                status: zod_1.z.enum(["pending", "in_progress", "completed"]).describe("Task status"),
            })),
        }),
    },
    todo_read: {
        description: "Read the current todo list",
        schema: zod_1.z.object({}),
    },
    status_set: {
        description: "Set a status indicator to show what Assistant is currently doing. The status is set IMMEDIATELY \n" +
            "when this tool is called, even before other tool calls complete.\n" +
            "\n" +
            "WHEN TO SET STATUS:\n" +
            "- Set status when beginning concrete work (file edits, running tests, executing commands)\n" +
            "- Update status as work progresses through distinct phases\n" +
            "- Set a final status after completion, only claim success when certain (e.g., after confirming checks passed)\n" +
            "- DO NOT set status during initial exploration, file reading, or planning phases\n" +
            "\n" +
            "The status is cleared when a new user message comes in. Validate your approach is feasible \n" +
            "before setting status - failed tool calls after setting status indicate premature commitment.\n" +
            "\n" +
            "URL PARAMETER:\n" +
            "- Optional 'url' parameter links to external resources (e.g., PR URL: 'https://github.com/owner/repo/pull/123')\n" +
            "- Prefer stable URLs that don't change often - saving the same URL twice is a no-op\n" +
            "- URL persists until replaced by a new status with a different URL",
        schema: zod_1.z
            .object({
            emoji: zod_1.z.string().describe("A single emoji character representing the current activity"),
            message: zod_1.z
                .string()
                .describe(`A brief description of the current activity (auto-truncated to ${toolLimits_1.STATUS_MESSAGE_MAX_LENGTH} chars with ellipsis if needed)`),
            url: zod_1.z
                .string()
                .url()
                .optional()
                .describe("Optional URL to external resource with more details (e.g., Pull Request URL). The URL persists and is displayed to the user for easy access."),
        })
            .strict(),
    },
    bash_output: {
        description: 'DEPRECATED: use task_await instead (pass bash-prefixed taskId like "bash:<processId>"). ' +
            "Retrieve output from a running or completed background bash process. " +
            "Returns only NEW output since the last check (incremental). " +
            "Returns stdout and stderr output along with process status. " +
            "Supports optional regex filtering to show only lines matching a pattern. " +
            "WARNING: When using filter, non-matching lines are permanently discarded. " +
            "Use timeout to wait for output instead of polling repeatedly. " +
            "Large outputs may be automatically filtered; when this happens, the result includes a note explaining what was kept and (if available) where the full output was saved.",
        schema: zod_1.z.object({
            process_id: zod_1.z.string().describe("The ID of the background process to retrieve output from"),
            filter: zod_1.z
                .string()
                .optional()
                .describe("Optional regex to filter output lines. By default, only matching lines are returned. " +
                "When filter_exclude is true, matching lines are excluded instead. " +
                "Non-matching lines are permanently discarded and cannot be retrieved later."),
            filter_exclude: zod_1.z
                .boolean()
                .optional()
                .describe("When true, lines matching 'filter' are excluded instead of kept. " +
                "Key behavior: excluded lines do NOT cause early return from timeout - " +
                "waiting continues until non-excluded output arrives or process exits. " +
                "Use to avoid busy polling on progress spam (e.g., filter='⏳|waiting|\\.\\.\\.' with filter_exclude=true " +
                "lets you set a long timeout and only wake on meaningful output). " +
                "Requires 'filter' to be set."),
            timeout_secs: zod_1.z
                .number()
                .min(0)
                .describe("Seconds to wait for new output. " +
                "If no output is immediately available and process is still running, " +
                "blocks up to this duration. Returns early when output arrives or process exits. " +
                "Only use long timeouts (>15s) when no other useful work can be done in parallel."),
        }),
    },
    bash_background_list: {
        description: "DEPRECATED: use task_list instead. " +
            "List all background processes started with bash(run_in_background=true). " +
            "Returns process_id, status, script for each process. " +
            "Use to find process_id for termination or check output with bash_output.",
        schema: zod_1.z.object({}),
    },
    bash_background_terminate: {
        description: "DEPRECATED: use task_terminate instead. " +
            "Terminate a background process started with bash(run_in_background=true). " +
            "Use process_id from the original bash response or from bash_background_list. " +
            "Sends SIGTERM, waits briefly, then SIGKILL if needed. " +
            "Output remains available via bash_output after termination.",
        schema: zod_1.z.object({
            process_id: zod_1.z.string().describe("Background process ID to terminate"),
        }),
    },
    web_fetch: {
        description: `Fetch a web page and extract its main content as clean markdown. ` +
            `Uses the workspace's network context (requests originate from the workspace, not Unix host). ` +
            `Requires curl to be installed in the workspace. ` +
            `Output is truncated to ${Math.floor(toolLimits_1.WEB_FETCH_MAX_OUTPUT_BYTES / 1024)}KB.`,
        schema: zod_1.z.object({
            url: zod_1.z.string().url().describe("The URL to fetch (http or https)"),
        }),
    },
    code_execution: {
        description: "Execute JavaScript code in a sandboxed environment with access to Unix tools. " +
            "Available for multi-tool workflows when PTC experiment is enabled.",
        schema: zod_1.z.object({
            code: zod_1.z.string().min(1).describe("JavaScript code to execute in the PTC sandbox"),
        }),
    },
    // #region NOTIFY_DOCS
    notify: {
        description: "Send a system notification to the user. Use this to alert the user about important events that require their attention, such as long-running task completion, errors requiring intervention, or questions. " +
            "Notifications appear as OS-native notifications (macOS Notification Center, Windows Toast, Linux). " +
            "Infer whether to send notifications from user instructions. If no instructions provided, reserve notifications for major wins or blocking issues. Do not use for routine status updates (use status_set instead).",
        schema: zod_1.z
            .object({
            title: zod_1.z
                .string()
                .min(1)
                .max(64)
                .describe("Short notification title (max 64 chars). Should be concise and actionable."),
            message: zod_1.z
                .string()
                .max(200)
                .optional()
                .describe("Optional notification body with more details (max 200 chars). " +
                "Keep it brief - users may only see a preview."),
        })
            .strict(),
    },
    // #endregion NOTIFY_DOCS
};
// -----------------------------------------------------------------------------
// Result Schemas for Bridgeable Tools (PTC Type Generation)
// -----------------------------------------------------------------------------
// These Zod schemas define the result types for tools exposed in the PTC sandbox.
// They serve as single source of truth for both:
// 1. TypeScript types in tools.ts (via z.infer<>)
// 2. Runtime type generation for PTC (via Zod → JSON Schema → TypeScript string)
/**
 * Truncation info returned when output exceeds limits.
 */
const TruncatedInfoSchema = zod_1.z.object({
    reason: zod_1.z.string(),
    totalLines: zod_1.z.number(),
});
/**
 * Bash tool result - success, background spawn, or failure.
 */
const BashToolSuccessSchema = zod_1.z
    .object({
    success: zod_1.z.literal(true),
    output: zod_1.z.string(),
    exitCode: zod_1.z.literal(0),
    wall_duration_ms: zod_1.z.number(),
    note: zod_1.z.string().optional(),
    truncated: TruncatedInfoSchema.optional(),
})
    .extend(ToolOutputUiOnlyFieldSchema);
const BashToolBackgroundSchema = zod_1.z
    .object({
    success: zod_1.z.literal(true),
    output: zod_1.z.string(),
    exitCode: zod_1.z.literal(0),
    wall_duration_ms: zod_1.z.number(),
    taskId: zod_1.z.string(),
    backgroundProcessId: zod_1.z.string(),
})
    .extend(ToolOutputUiOnlyFieldSchema);
const BashToolFailureSchema = zod_1.z
    .object({
    success: zod_1.z.literal(false),
    output: zod_1.z.string().optional(),
    exitCode: zod_1.z.number(),
    error: zod_1.z.string(),
    wall_duration_ms: zod_1.z.number(),
    note: zod_1.z.string().optional(),
    truncated: TruncatedInfoSchema.optional(),
})
    .extend(ToolOutputUiOnlyFieldSchema);
exports.BashToolResultSchema = zod_1.z.union([
    // Foreground success
    BashToolSuccessSchema,
    // Background spawn success
    BashToolBackgroundSchema,
    // Failure
    BashToolFailureSchema,
]);
/**
 * Bash output tool result - process status and incremental output.
 */
exports.BashOutputToolResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        status: zod_1.z.enum(["running", "exited", "killed", "failed", "interrupted"]),
        output: zod_1.z.string(),
        exitCode: zod_1.z.number().optional(),
        note: zod_1.z.string().optional(),
        elapsed_ms: zod_1.z.number(),
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    }),
]);
/**
 * Bash background list tool result - all background processes.
 */
exports.BashBackgroundListResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        processes: zod_1.z.array(zod_1.z.object({
            process_id: zod_1.z.string(),
            status: zod_1.z.enum(["running", "exited", "killed", "failed"]),
            script: zod_1.z.string(),
            uptime_ms: zod_1.z.number(),
            exitCode: zod_1.z.number().optional(),
            display_name: zod_1.z.string().optional(),
        })),
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    }),
]);
/**
 * Bash background terminate tool result.
 */
exports.BashBackgroundTerminateResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        message: zod_1.z.string(),
        display_name: zod_1.z.string().optional(),
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    }),
]);
/**
 * unix_global_agents_read tool result.
 */
exports.UnixGlobalAgentsReadToolResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        content: zod_1.z.string(),
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    }),
]);
/**
 * unix_global_agents_write tool result.
 */
exports.UnixGlobalAgentsWriteToolResultSchema = zod_1.z.union([
    zod_1.z
        .object({
        success: zod_1.z.literal(true),
        diff: zod_1.z.string(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
    zod_1.z
        .object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
]);
/**
 * File read tool result - content or error.
 */
exports.FileReadToolResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        file_size: zod_1.z.number(),
        modifiedTime: zod_1.z.string(),
        lines_read: zod_1.z.number(),
        content: zod_1.z.string(),
        warning: zod_1.z.string().optional(),
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    }),
]);
/**
 * Agent Skill read tool result - full SKILL.md package or error.
 */
exports.AgentSkillReadToolResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        skill: schemas_1.AgentSkillPackageSchema,
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
    }),
]);
/**
 * Agent Skill read_file tool result.
 * Uses the same shape/limits as file_read.
 */
exports.AgentSkillReadFileToolResultSchema = exports.FileReadToolResultSchema;
/**
 * File edit insert tool result - diff or error.
 */
exports.FileEditInsertToolResultSchema = zod_1.z.union([
    zod_1.z
        .object({
        success: zod_1.z.literal(true),
        diff: zod_1.z.string(),
        warning: zod_1.z.string().optional(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
    zod_1.z
        .object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
        note: zod_1.z.string().optional(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
]);
/**
 * File edit replace string tool result - diff with edit count or error.
 */
exports.FileEditReplaceStringToolResultSchema = zod_1.z.union([
    zod_1.z
        .object({
        success: zod_1.z.literal(true),
        diff: zod_1.z.string(),
        edits_applied: zod_1.z.number(),
        warning: zod_1.z.string().optional(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
    zod_1.z
        .object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
        note: zod_1.z.string().optional(),
    })
        .extend(ToolOutputUiOnlyFieldSchema),
]);
/**
 * Web fetch tool result - parsed content or error.
 */
exports.WebFetchToolResultSchema = zod_1.z.union([
    zod_1.z.object({
        success: zod_1.z.literal(true),
        title: zod_1.z.string(),
        content: zod_1.z.string(),
        url: zod_1.z.string(),
        byline: zod_1.z.string().optional(),
        length: zod_1.z.number(),
    }),
    zod_1.z.object({
        success: zod_1.z.literal(false),
        error: zod_1.z.string(),
        content: zod_1.z.string().optional(),
    }),
]);
/**
 * Lookup map for result schemas by tool name.
 * Used by PTC type generator to get result types for bridgeable tools.
 *
 * Type-level enforcement ensures all BridgeableToolName entries have schemas.
 */
exports.RESULT_SCHEMAS = {
    bash: exports.BashToolResultSchema,
    bash_output: exports.BashOutputToolResultSchema,
    bash_background_list: exports.BashBackgroundListResultSchema,
    bash_background_terminate: exports.BashBackgroundTerminateResultSchema,
    file_read: exports.FileReadToolResultSchema,
    agent_skill_read: exports.AgentSkillReadToolResultSchema,
    agent_skill_read_file: exports.AgentSkillReadFileToolResultSchema,
    file_edit_insert: exports.FileEditInsertToolResultSchema,
    file_edit_replace_string: exports.FileEditReplaceStringToolResultSchema,
    web_fetch: exports.WebFetchToolResultSchema,
    task: exports.TaskToolResultSchema,
    task_await: exports.TaskAwaitToolResultSchema,
    task_list: exports.TaskListToolResultSchema,
    task_terminate: exports.TaskTerminateToolResultSchema,
};
/**
 * Get tool definition schemas for token counting
 * JSON schemas are auto-generated from zod schemas
 *
 * @returns Record of tool name to schema
 */
function getToolSchemas() {
    return Object.fromEntries(Object.entries(exports.TOOL_DEFINITIONS).map(([name, def]) => [
        name,
        {
            name,
            description: def.description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            inputSchema: (0, zod_to_json_schema_1.zodToJsonSchema)(def.schema),
        },
    ]));
}
/**
 * Get which tools are available for a given model
 * @param modelString The model string (e.g., "anthropic:claude-opus-4-1")
 * @returns Array of tool names available for the model
 */
function getAvailableTools(modelString, options) {
    const [provider] = modelString.split(":");
    const enableAgentReport = options?.enableAgentReport ?? true;
    // Base tools available for all models
    // Note: Tool availability is controlled by agent tool policy (allowlist), not mode checks here.
    const baseTools = [
        ...(options?.enableUnixGlobalAgentsTools
            ? ["unix_global_agents_read", "unix_global_agents_write"]
            : []),
        "file_read",
        "agent_skill_read",
        "agent_skill_read_file",
        "file_edit_replace_string",
        // "file_edit_replace_lines", // DISABLED: causes models to break repo state
        "file_edit_insert",
        "ask_user_question",
        "propose_plan",
        "bash",
        "task",
        "task_await",
        "task_terminate",
        "task_list",
        ...(enableAgentReport ? ["agent_report"] : []),
        "system1_keep_ranges",
        "todo_write",
        "todo_read",
        "status_set",
        "notify",
        "web_fetch",
    ];
    // Add provider-specific tools
    switch (provider) {
        case "anthropic":
            return [...baseTools, "web_search"];
        case "openai":
            // Only some OpenAI models support web search
            if (modelString.includes("gpt-4") || modelString.includes("gpt-5")) {
                return [...baseTools, "web_search"];
            }
            return baseTools;
        case "google":
            return [...baseTools, "google_search"];
        default:
            return baseTools;
    }
}
//# sourceMappingURL=toolDefinitions.js.map