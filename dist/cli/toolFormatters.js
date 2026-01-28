"use strict";
/**
 * CLI tool output formatters for `unix run`
 *
 * Provides clean, readable formatting for recognized tool calls,
 * with emoji prefixes and structured output similar to the frontend UI.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatToolStart = formatToolStart;
exports.formatToolEnd = formatToolEnd;
exports.formatGenericToolStart = formatGenericToolStart;
exports.formatGenericToolEnd = formatGenericToolEnd;
exports.isMultilineResultTool = isMultilineResultTool;
const chalk_1 = __importDefault(require("chalk"));
/** Tools that should have their result on a new line (multi-line results) */
const MULTILINE_RESULT_TOOLS = new Set([
    "file_edit_replace_string",
    "file_edit_replace_lines",
    "file_edit_insert",
    "bash",
    "task",
    "task_await",
    "code_execution",
]);
// ============================================================================
// Utilities
// ============================================================================
const TOOL_BLOCK_SEPARATOR = chalk_1.default.dim("─".repeat(40));
function isRecord(value) {
    return value !== null && typeof value === "object";
}
function formatFilePath(filePath) {
    return chalk_1.default.cyan(filePath);
}
function formatCommand(cmd) {
    // Truncate long commands
    const maxLen = 80;
    const truncated = cmd.length > maxLen ? cmd.slice(0, maxLen) + "…" : cmd;
    return chalk_1.default.yellow(truncated);
}
function formatDiff(diff) {
    // Color diff lines for terminal output
    return diff
        .split("\n")
        .map((line) => {
        if (line.startsWith("+") && !line.startsWith("+++")) {
            return chalk_1.default.green(line);
        }
        else if (line.startsWith("-") && !line.startsWith("---")) {
            return chalk_1.default.red(line);
        }
        else if (line.startsWith("@@")) {
            return chalk_1.default.cyan(line);
        }
        return line;
    })
        .join("\n");
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
function indent(text, spaces = 2) {
    const prefix = " ".repeat(spaces);
    return text
        .split("\n")
        .map((line) => prefix + line)
        .join("\n");
}
function renderUnknown(value) {
    if (typeof value === "string")
        return value;
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
// ============================================================================
// Tool Start Formatters
// ============================================================================
function formatFileEditStart(_toolName, args) {
    const editArgs = args;
    if (!editArgs?.file_path)
        return null;
    return `✏️  ${formatFilePath(editArgs.file_path)}`;
}
function formatFileReadStart(_toolName, args) {
    const readArgs = args;
    if (!readArgs?.file_path)
        return null;
    let suffix = "";
    if (readArgs.offset !== undefined || readArgs.limit !== undefined) {
        const parts = [];
        if (readArgs.offset !== undefined)
            parts.push(`L${readArgs.offset}`);
        if (readArgs.limit !== undefined)
            parts.push(`+${readArgs.limit}`);
        suffix = chalk_1.default.dim(` (${parts.join(", ")})`);
    }
    return `📖 ${formatFilePath(readArgs.file_path)}${suffix}`;
}
function formatBashStart(_toolName, args) {
    const bashArgs = args;
    if (!bashArgs?.script)
        return null;
    const bg = bashArgs.run_in_background ? chalk_1.default.dim(" [background]") : "";
    const timeout = bashArgs.timeout_secs ? chalk_1.default.dim(` timeout:${bashArgs.timeout_secs}s`) : "";
    return `🔧 ${formatCommand(bashArgs.script)}${bg}${timeout}`;
}
function formatTaskStart(_toolName, args) {
    const taskArgs = args;
    if (!taskArgs?.title)
        return null;
    const bg = taskArgs.run_in_background ? chalk_1.default.dim(" [background]") : "";
    return `🤖 ${chalk_1.default.magenta(taskArgs.title)}${bg}`;
}
function formatWebFetchStart(_toolName, args) {
    const fetchArgs = args;
    if (!fetchArgs?.url)
        return null;
    return `🌐 ${chalk_1.default.blue(fetchArgs.url)}`;
}
function formatWebSearchStart(_toolName, args) {
    const searchArgs = args;
    if (!searchArgs?.query)
        return null;
    return `🔍 ${chalk_1.default.blue(searchArgs.query)}`;
}
function formatTodoStart(_toolName, args) {
    const todoArgs = args;
    if (!todoArgs?.todos)
        return null;
    return `📋 ${chalk_1.default.dim(`${todoArgs.todos.length} items`)}`;
}
function formatNotifyStart(_toolName, args) {
    const notifyArgs = args;
    if (!notifyArgs?.title)
        return null;
    return `🔔 ${chalk_1.default.yellow(notifyArgs.title)}`;
}
function formatStatusSetStart(_toolName, args) {
    const statusArgs = args;
    if (!statusArgs?.message)
        return null;
    const emoji = statusArgs.emoji ?? "📌";
    return `${emoji} ${chalk_1.default.dim(statusArgs.message)}`;
}
function formatSetExitCodeStart(_toolName, args) {
    const exitArgs = args;
    if (exitArgs?.exit_code === undefined)
        return null;
    const code = exitArgs.exit_code;
    const color = code === 0 ? chalk_1.default.green : chalk_1.default.red;
    return `🚪 exit ${color(code)}`;
}
function formatAgentSkillReadStart(_toolName, args) {
    const skillArgs = args;
    if (!skillArgs?.name)
        return null;
    return `📚 ${chalk_1.default.cyan(skillArgs.name)}`;
}
function formatCodeExecutionStart(_toolName, args) {
    const codeArgs = args;
    if (!codeArgs?.code)
        return null;
    // Show first line or truncated preview of code
    const firstLine = codeArgs.code.split("\n")[0];
    const maxLen = 60;
    const preview = firstLine.length > maxLen ? firstLine.slice(0, maxLen) + "…" : firstLine;
    return `🧮 ${chalk_1.default.yellow(preview)}`;
}
// ============================================================================
// Tool End Formatters
// ============================================================================
function formatFileEditEnd(_toolName, _args, result) {
    const editResult = result;
    if (editResult?.success === false) {
        return `${chalk_1.default.red("✗")} ${chalk_1.default.red(editResult.error || "Edit failed")}`;
    }
    if (editResult?.success && editResult.diff) {
        return formatDiff(editResult.diff);
    }
    return chalk_1.default.green("✓");
}
function formatFileReadEnd(_toolName, _args, result) {
    const readResult = result;
    if (readResult?.success === false) {
        return `${chalk_1.default.red("✗")} ${chalk_1.default.red(readResult.error || "Read failed")}`;
    }
    if (readResult?.success) {
        const size = readResult.file_size ? chalk_1.default.dim(` (${formatBytes(readResult.file_size)})`) : "";
        const lines = readResult.lines_read ? chalk_1.default.dim(` ${readResult.lines_read} lines`) : "";
        return `${chalk_1.default.green("✓")}${lines}${size}`;
    }
    return null;
}
function formatBashEnd(_toolName, _args, result) {
    if (!isRecord(result))
        return null;
    const bashResult = result;
    // Background process started
    if ("backgroundProcessId" in bashResult) {
        return `${chalk_1.default.blue("→")} background: ${chalk_1.default.dim(bashResult.backgroundProcessId)}`;
    }
    const duration = bashResult.wall_duration_ms
        ? chalk_1.default.dim(` (${formatDuration(bashResult.wall_duration_ms)})`)
        : "";
    const exitCode = bashResult.exitCode;
    const exitStr = exitCode === 0 ? chalk_1.default.green("exit:0") : chalk_1.default.red(`exit:${exitCode}`);
    let output = `${exitStr}${duration}`;
    // Show truncated output if present
    if (bashResult.output) {
        const lines = bashResult.output.split("\n");
        const maxLines = 20;
        const truncated = lines.length > maxLines;
        const displayLines = truncated ? lines.slice(0, maxLines) : lines;
        const outputText = displayLines.join("\n");
        if (outputText.trim()) {
            output += "\n" + indent(chalk_1.default.dim(outputText));
            if (truncated) {
                output += "\n" + indent(chalk_1.default.dim(`... ${lines.length - maxLines} more lines`));
            }
        }
    }
    // Show error if present (only on failure)
    if (!bashResult.success && bashResult.error) {
        output += "\n" + indent(chalk_1.default.red(bashResult.error));
    }
    return output;
}
function formatTaskEnd(_toolName, _args, result) {
    if (!isRecord(result))
        return null;
    const taskResult = result;
    if ("taskId" in taskResult && taskResult.status) {
        return `${chalk_1.default.blue("→")} ${taskResult.status}: ${chalk_1.default.dim(taskResult.taskId)}`;
    }
    if ("reportMarkdown" in taskResult) {
        // Truncate long reports
        const report = taskResult.reportMarkdown;
        const maxLen = 500;
        const truncated = report.length > maxLen ? report.slice(0, maxLen) + "…" : report;
        return `${chalk_1.default.green("✓")}\n${indent(chalk_1.default.dim(truncated))}`;
    }
    return null;
}
function formatWebFetchEnd(_toolName, _args, result) {
    const fetchResult = result;
    if (fetchResult?.success === false) {
        return `${chalk_1.default.red("✗")} ${chalk_1.default.red(fetchResult.error ?? "Fetch failed")}`;
    }
    if (fetchResult?.success) {
        const title = fetchResult.title ? chalk_1.default.dim(` "${fetchResult.title}"`) : "";
        const len = fetchResult.length ? chalk_1.default.dim(` ${formatBytes(fetchResult.length)}`) : "";
        return `${chalk_1.default.green("✓")}${title}${len}`;
    }
    return null;
}
function formatCodeExecutionEnd(_toolName, _args, result) {
    if (result === undefined || result === null)
        return null;
    // Code execution results can be complex - show truncated summary
    const resultStr = typeof result === "string" ? result : renderUnknown(result);
    const lines = resultStr.split("\n");
    const maxLines = 10;
    const truncated = lines.length > maxLines;
    const displayLines = truncated ? lines.slice(0, maxLines) : lines;
    let output = chalk_1.default.green("✓");
    if (displayLines.join("").trim()) {
        output += "\n" + indent(chalk_1.default.dim(displayLines.join("\n")));
        if (truncated) {
            output += "\n" + indent(chalk_1.default.dim(`... ${lines.length - maxLines} more lines`));
        }
    }
    return output;
}
/** Simple success/error marker for inline tools that don't need detailed result formatting */
function formatSimpleSuccessEnd(_toolName, _args, result) {
    // Check for error results
    const resultObj = result;
    if (resultObj?.success === false) {
        return `${chalk_1.default.red("✗")} ${chalk_1.default.red(resultObj.error ?? "Failed")}`;
    }
    return chalk_1.default.green("✓");
}
// ============================================================================
// Registry and Public API
// ============================================================================
const startFormatters = {
    file_edit_replace_string: formatFileEditStart,
    file_edit_replace_lines: formatFileEditStart,
    file_edit_insert: formatFileEditStart,
    file_read: formatFileReadStart,
    bash: formatBashStart,
    task: formatTaskStart,
    web_fetch: formatWebFetchStart,
    web_search: formatWebSearchStart,
    todo_write: formatTodoStart,
    notify: formatNotifyStart,
    status_set: formatStatusSetStart,
    set_exit_code: formatSetExitCodeStart,
    agent_skill_read: formatAgentSkillReadStart,
    agent_skill_read_file: formatAgentSkillReadStart,
    code_execution: formatCodeExecutionStart,
};
const endFormatters = {
    file_edit_replace_string: formatFileEditEnd,
    file_edit_replace_lines: formatFileEditEnd,
    file_edit_insert: formatFileEditEnd,
    file_read: formatFileReadEnd,
    bash: formatBashEnd,
    task: formatTaskEnd,
    task_await: formatTaskEnd,
    web_fetch: formatWebFetchEnd,
    code_execution: formatCodeExecutionEnd,
    // Inline tools with simple success markers (prevents generic fallback)
    web_search: formatSimpleSuccessEnd,
    todo_write: formatSimpleSuccessEnd,
    notify: formatSimpleSuccessEnd,
    status_set: formatSimpleSuccessEnd,
    set_exit_code: formatSimpleSuccessEnd,
    agent_skill_read: formatSimpleSuccessEnd,
    agent_skill_read_file: formatSimpleSuccessEnd,
};
/**
 * Format a tool-call-start event for CLI output.
 * Returns formatted string, or null to use generic fallback.
 */
function formatToolStart(payload) {
    const formatter = startFormatters[payload.toolName];
    if (!formatter)
        return null;
    try {
        return formatter(payload.toolName, payload.args);
    }
    catch {
        return null;
    }
}
/**
 * Format a tool-call-end event for CLI output.
 * Returns formatted string, or null to use generic fallback.
 */
function formatToolEnd(payload, startArgs) {
    const formatter = endFormatters[payload.toolName];
    if (!formatter)
        return null;
    try {
        return formatter(payload.toolName, startArgs, payload.result);
    }
    catch {
        return null;
    }
}
/**
 * Generic fallback formatter for unrecognized tools.
 */
function formatGenericToolStart(payload) {
    return [
        TOOL_BLOCK_SEPARATOR,
        `${chalk_1.default.bold(payload.toolName)} ${chalk_1.default.dim(`(${payload.toolCallId})`)}`,
        chalk_1.default.dim("Args:"),
        indent(renderUnknown(payload.args)),
        TOOL_BLOCK_SEPARATOR,
    ].join("\n");
}
/**
 * Generic fallback formatter for unrecognized tool results.
 */
function formatGenericToolEnd(payload) {
    return [
        TOOL_BLOCK_SEPARATOR,
        `${chalk_1.default.bold(payload.toolName)} ${chalk_1.default.dim("result")}`,
        indent(renderUnknown(payload.result)),
        TOOL_BLOCK_SEPARATOR,
    ].join("\n");
}
/**
 * Check if a tool should have its result on a new line (multi-line output).
 * For single-line results (file_read, web_fetch, etc.), result appears inline.
 */
function isMultilineResultTool(toolName) {
    return MULTILINE_RESULT_TOOLS.has(toolName);
}
//# sourceMappingURL=toolFormatters.js.map