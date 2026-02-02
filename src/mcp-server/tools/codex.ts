/**
 * Codex — Code-Execution MCP Pattern (Anthropic-recommended)
 *
 * Instead of loading all 53+ tool definitions into every agent's context,
 * this system presents tools as importable TypeScript files on a filesystem.
 *
 * Agents discover tools by exploring the filesystem, load only what they
 * need, and write code that executes in a sandboxed environment where
 * intermediate results stay out of the model's context.
 *
 * Architecture:
 *   Agent → reads ./servers/ filesystem → imports only needed tools
 *         → writes code → executes in sandbox → returns result
 *
 * Benefits:
 *   - 98%+ token reduction (load 3-5 tool defs vs 53)
 *   - Data flows between tools in code, never re-entering context
 *   - Agents build reusable skills over time
 *   - Progressive disclosure: name → description → full schema
 *
 * Reference: https://www.anthropic.com/engineering/code-execution-with-mcp
 */
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkbenchClient } from "../client.js";

// ── Tool Registry ────────────────────────────────────────────────────
// Complete catalog of all MCP tools, organized by server/category

interface ToolDef {
  name: string;
  description: string;
  category: string;
  params: Array<{ name: string; type: string; required: boolean; description: string }>;
  returnType: string;
}

function getToolCatalog(): Record<string, ToolDef[]> {
  return {
    workspace: [
      {
        name: "listWorkspaces",
        description: "List all workspaces with metadata (id, title, project, status)",
        category: "workspace",
        params: [{ name: "archived", type: "boolean", required: false, description: "Include archived workspaces" }],
        returnType: "Array<{ id: string; title: string; projectPath: string; status: string }>",
      },
      {
        name: "createWorkspace",
        description: "Create a new workspace in a project. Returns workspace ID.",
        category: "workspace",
        params: [
          { name: "projectPath", type: "string", required: true, description: "Absolute path to the project" },
          { name: "branchName", type: "string", required: true, description: "Git branch name" },
          { name: "title", type: "string", required: false, description: "Workspace title" },
          { name: "trunkBranch", type: "string", required: false, description: "Base branch" },
        ],
        returnType: "{ success: boolean; workspaceId?: string; error?: string }",
      },
      {
        name: "removeWorkspace",
        description: "Delete a workspace",
        category: "workspace",
        params: [
          { name: "workspaceId", type: "string", required: true, description: "Workspace ID" },
          { name: "force", type: "boolean", required: false, description: "Force removal" },
        ],
        returnType: "{ success: boolean; error?: string }",
      },
      {
        name: "sendMessage",
        description: "Send a message to workspace agent and wait for full response",
        category: "workspace",
        params: [
          { name: "workspaceId", type: "string", required: true, description: "Target workspace" },
          { name: "message", type: "string", required: true, description: "Message to send" },
          { name: "timeoutMs", type: "number", required: false, description: "Max wait time (default: 120000)" },
        ],
        returnType: "string",
      },
      {
        name: "getChatHistory",
        description: "Get full conversation history for a workspace",
        category: "workspace",
        params: [{ name: "workspaceId", type: "string", required: true, description: "Workspace ID" }],
        returnType: "Array<{ role: string; content: string }>",
      },
      {
        name: "interrupt",
        description: "Interrupt an active agent stream",
        category: "workspace",
        params: [{ name: "workspaceId", type: "string", required: true, description: "Workspace ID" }],
        returnType: "{ success: boolean }",
      },
      {
        name: "executeBash",
        description: "Execute bash in workspace runtime. Returns stdout, stderr, exit code.",
        category: "workspace",
        params: [
          { name: "workspaceId", type: "string", required: true, description: "Workspace ID" },
          { name: "script", type: "string", required: true, description: "Bash script" },
          { name: "timeout", type: "number", required: false, description: "Timeout seconds" },
        ],
        returnType: "{ stdout: string; stderr: string; exitCode: number }",
      },
      {
        name: "getInfo",
        description: "Get detailed workspace info (metadata, status, config)",
        category: "workspace",
        params: [{ name: "workspaceId", type: "string", required: true, description: "Workspace ID" }],
        returnType: "object",
      },
      {
        name: "forkWorkspace",
        description: "Fork workspace to new branch",
        category: "workspace",
        params: [
          { name: "workspaceId", type: "string", required: true, description: "Source workspace" },
          { name: "branchName", type: "string", required: true, description: "New branch name" },
          { name: "title", type: "string", required: false, description: "New workspace title" },
        ],
        returnType: "{ success: boolean; workspaceId?: string }",
      },
      {
        name: "renameWorkspace",
        description: "Rename a workspace's title",
        category: "workspace",
        params: [
          { name: "workspaceId", type: "string", required: true, description: "Workspace ID" },
          { name: "title", type: "string", required: true, description: "New title" },
        ],
        returnType: "{ success: boolean }",
      },
      {
        name: "archiveWorkspace",
        description: "Archive a workspace",
        category: "workspace",
        params: [{ name: "workspaceId", type: "string", required: true, description: "Workspace ID" }],
        returnType: "{ success: boolean }",
      },
      {
        name: "unarchiveWorkspace",
        description: "Unarchive a workspace",
        category: "workspace",
        params: [{ name: "workspaceId", type: "string", required: true, description: "Workspace ID" }],
        returnType: "{ success: boolean }",
      },
    ],
    project: [
      {
        name: "listProjects",
        description: "List all registered projects",
        category: "project",
        params: [],
        returnType: "Array<{ path: string; config: object }>",
      },
      {
        name: "createProject",
        description: "Register a project directory",
        category: "project",
        params: [{ name: "projectPath", type: "string", required: true, description: "Absolute path" }],
        returnType: "{ success: boolean }",
      },
      {
        name: "listBranches",
        description: "List git branches and recommended trunk",
        category: "project",
        params: [{ name: "projectPath", type: "string", required: true, description: "Project path" }],
        returnType: "{ branches: string[]; recommendedTrunk: string | null }",
      },
    ],
    channel: [
      {
        name: "listChannels",
        description: "List messaging channels (Telegram, Discord) with status",
        category: "channel",
        params: [],
        returnType: "Array<{ type: string; accountId: string; status: string; enabled: boolean }>",
      },
      {
        name: "connectChannel",
        description: "Connect a messaging channel (start bot)",
        category: "channel",
        params: [{ name: "accountId", type: "string", required: true, description: "Channel account ID" }],
        returnType: "{ success: boolean }",
      },
      {
        name: "disconnectChannel",
        description: "Disconnect a channel (stop bot)",
        category: "channel",
        params: [{ name: "accountId", type: "string", required: true, description: "Channel account ID" }],
        returnType: "{ success: boolean }",
      },
      {
        name: "sendChannelMessage",
        description: "Send message through a channel to a peer",
        category: "channel",
        params: [
          { name: "accountId", type: "string", required: true, description: "Channel account" },
          { name: "to", type: "string", required: true, description: "Recipient ID" },
          { name: "text", type: "string", required: true, description: "Message text" },
        ],
        returnType: "{ success: boolean }",
      },
    ],
    system: [
      {
        name: "shell",
        description: "Execute shell command with full permissions",
        category: "system",
        params: [
          { name: "command", type: "string", required: true, description: "Shell command" },
          { name: "cwd", type: "string", required: false, description: "Working directory" },
          { name: "timeout", type: "number", required: false, description: "Timeout seconds" },
        ],
        returnType: "{ stdout: string; stderr: string; exitCode: number }",
      },
      {
        name: "gitClone",
        description: "Clone a git repository",
        category: "system",
        params: [
          { name: "url", type: "string", required: true, description: "Git URL" },
          { name: "targetDir", type: "string", required: false, description: "Target directory" },
          { name: "branch", type: "string", required: false, description: "Branch to checkout" },
        ],
        returnType: "{ path: string }",
      },
      {
        name: "readFile",
        description: "Read a file from filesystem",
        category: "system",
        params: [{ name: "path", type: "string", required: true, description: "File path" }],
        returnType: "string",
      },
      {
        name: "writeFile",
        description: "Write content to a file",
        category: "system",
        params: [
          { name: "path", type: "string", required: true, description: "File path" },
          { name: "content", type: "string", required: true, description: "Content" },
          { name: "append", type: "boolean", required: false, description: "Append mode" },
        ],
        returnType: "void",
      },
      {
        name: "listDirectory",
        description: "List files in a directory",
        category: "system",
        params: [
          { name: "path", type: "string", required: true, description: "Directory path" },
          { name: "recursive", type: "boolean", required: false, description: "Recursive listing" },
        ],
        returnType: "string[]",
      },
      {
        name: "systemInfo",
        description: "Get OS, CPU, memory, disk info",
        category: "system",
        params: [],
        returnType: "{ hostname: string; cpus: number; totalMemoryGB: number; freeMemoryGB: number }",
      },
      {
        name: "processes",
        description: "List running processes",
        category: "system",
        params: [{ name: "filter", type: "string", required: false, description: "Filter pattern" }],
        returnType: "string",
      },
    ],
    swarm: [
      {
        name: "spawn",
        description: "Create workspace sub-agents dynamically",
        category: "swarm",
        params: [
          { name: "projectPath", type: "string", required: true, description: "Project path" },
          { name: "agents", type: "Array<{role, systemPrompt?, title?}>", required: true, description: "Specialists to spawn" },
        ],
        returnType: "Array<{ agentId: string; workspaceId: string; status: string }>",
      },
      {
        name: "dispatch",
        description: "Send task to an agent (async, returns immediately)",
        category: "swarm",
        params: [
          { name: "agentId", type: "string", required: true, description: "Target agent" },
          { name: "task", type: "string", required: true, description: "Task instruction" },
        ],
        returnType: "{ taskId: string; status: string }",
      },
      {
        name: "executeStage",
        description: "Run parallel tasks as a logical stage with dependencies",
        category: "swarm",
        params: [
          { name: "name", type: "string", required: true, description: "Stage name" },
          { name: "tasks", type: "Array<{agentId, task}>", required: true, description: "Parallel tasks" },
          { name: "dependsOnStages", type: "string[]", required: false, description: "Stage dependencies" },
        ],
        returnType: "{ stageId: string; taskIds: string[] }",
      },
      {
        name: "status",
        description: "Full swarm dashboard — agents, tasks, stages, resources",
        category: "swarm",
        params: [],
        returnType: "SwarmDashboard",
      },
      {
        name: "collect",
        description: "Wait for tasks/stages to complete, return results",
        category: "swarm",
        params: [
          { name: "stageId", type: "string", required: false, description: "Wait for stage" },
          { name: "taskIds", type: "string[]", required: false, description: "Wait for tasks" },
          { name: "timeoutMs", type: "number", required: false, description: "Timeout" },
        ],
        returnType: "Array<{ taskId: string; status: string; result?: string }>",
      },
      {
        name: "memorySet",
        description: "Store in shared swarm memory",
        category: "swarm",
        params: [
          { name: "key", type: "string", required: true, description: "Memory key" },
          { name: "value", type: "string", required: true, description: "Value" },
        ],
        returnType: "void",
      },
      {
        name: "memoryGet",
        description: "Read from shared swarm memory",
        category: "swarm",
        params: [{ name: "key", type: "string", required: false, description: "Key (omit for all)" }],
        returnType: "string | Record<string, string>",
      },
      {
        name: "resources",
        description: "Check system resources and parallel capacity",
        category: "swarm",
        params: [],
        returnType: "{ cpus: number; freeMemGB: number; maxParallelAgents: number }",
      },
    ],
    bootstrap: [
      {
        name: "bootstrapProject",
        description: "All-in-one: clone repo → register → create workspace",
        category: "bootstrap",
        params: [
          { name: "gitUrl", type: "string", required: true, description: "Git repo URL" },
          { name: "targetDir", type: "string", required: false, description: "Clone target" },
          { name: "branch", type: "string", required: false, description: "Branch" },
        ],
        returnType: "{ workspaceId: string }",
      },
      {
        name: "initProject",
        description: "Create new project from scratch with git init",
        category: "bootstrap",
        params: [
          { name: "projectPath", type: "string", required: true, description: "New project path" },
        ],
        returnType: "{ workspaceId: string }",
      },
      {
        name: "installDeps",
        description: "Auto-detect and install project dependencies",
        category: "bootstrap",
        params: [{ name: "projectPath", type: "string", required: true, description: "Project path" }],
        returnType: "{ packageManager: string; exitCode: number }",
      },
    ],
    cron: [
      {
        name: "create",
        description: "Schedule recurring task in a workspace",
        category: "cron",
        params: [
          { name: "name", type: "string", required: true, description: "Job name" },
          { name: "workspaceId", type: "string", required: true, description: "Target workspace" },
          { name: "schedule", type: "string", required: true, description: "Interval: '5m', '1h', '1d'" },
          { name: "task", type: "string", required: true, description: "Task message" },
        ],
        returnType: "{ jobId: string }",
      },
      {
        name: "list",
        description: "List all scheduled jobs",
        category: "cron",
        params: [],
        returnType: "Array<{ id: string; name: string; schedule: string; enabled: boolean }>",
      },
      {
        name: "enable",
        description: "Enable or disable a cron job",
        category: "cron",
        params: [
          { name: "jobId", type: "string", required: true, description: "Job ID" },
          { name: "enabled", type: "boolean", required: true, description: "Enable state" },
        ],
        returnType: "void",
      },
      {
        name: "runNow",
        description: "Trigger immediate execution of a cron job",
        category: "cron",
        params: [{ name: "jobId", type: "string", required: true, description: "Job ID" }],
        returnType: "{ result: string }",
      },
    ],
    health: [
      {
        name: "check",
        description: "Comprehensive system health check",
        category: "health",
        params: [],
        returnType: "HealthReport",
      },
      {
        name: "workspacePing",
        description: "Ping a workspace to check responsiveness",
        category: "health",
        params: [{ name: "workspaceId", type: "string", required: true, description: "Workspace ID" }],
        returnType: "{ responsive: boolean; latencyMs: number }",
      },
      {
        name: "bulkCheck",
        description: "Ping all active workspaces",
        category: "health",
        params: [],
        returnType: "Array<{ workspaceId: string; healthy: boolean }>",
      },
    ],
  };
}

// ── Code generation helpers ──────────────────────────────────────────

function generateToolFile(tool: ToolDef): string {
  const paramList = tool.params
    .map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`)
    .join("; ");

  const inputInterface = tool.params.length > 0
    ? `interface ${capitalize(tool.name)}Input {\n${tool.params.map((p) => `  /** ${p.description} */\n  ${p.name}${p.required ? "" : "?"}: ${p.type};`).join("\n")}\n}\n\n`
    : "";

  const funcParams = tool.params.length > 0
    ? `input: ${capitalize(tool.name)}Input`
    : "";

  return `// Auto-generated tool definition
// Server: ${tool.category} | Tool: ${tool.name}
import { callTool } from "../../runtime.js";

${inputInterface}/** ${tool.description} */
export async function ${tool.name}(${funcParams}): Promise<${tool.returnType}> {
  return callTool<${tool.returnType}>("${tool.category}", "${tool.name}"${tool.params.length > 0 ? ", input" : ""});
}
`;
}

function generateIndexFile(category: string, tools: ToolDef[]): string {
  const exports = tools.map((t) => `export { ${t.name} } from "./${t.name}.js";`);
  return `// ${category} tools — ${tools.length} available\n${exports.join("\n")}\n`;
}

function generateServerTree(): string {
  const catalog = getToolCatalog();
  const lines: string[] = ["servers/"];

  for (const [category, tools] of Object.entries(catalog)) {
    lines.push(`├── ${category}/`);
    for (let i = 0; i < tools.length; i++) {
      const prefix = i === tools.length - 1 ? "│   └──" : "│   ├──";
      lines.push(`${prefix} ${tools[i]!.name}.ts`);
    }
    lines.push(`│   └── index.ts`);
  }

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Filesystem generation ────────────────────────────────────────────

function getCodexDir(): string {
  return path.join(os.homedir(), ".lattice", "codex");
}

function ensureCodexGenerated(): string {
  const codexDir = getCodexDir();
  const serversDir = path.join(codexDir, "servers");

  // Only regenerate if missing
  if (fs.existsSync(path.join(serversDir, "workspace", "index.ts"))) {
    return codexDir;
  }

  const catalog = getToolCatalog();

  // Generate runtime.ts
  const runtimeCode = `/**
 * Codex Runtime — bridges code-execution calls to MCP tools
 *
 * When an agent writes: import { sendMessage } from './servers/workspace';
 * The actual call goes through MCP tool dispatch.
 */

// This runtime is injected by the MCP server at execution time
// Each function call maps to the corresponding MCP tool
export async function callTool<T>(server: string, tool: string, input?: unknown): Promise<T> {
  // The MCP server intercepts this and routes to the actual tool handler
  const response = await (globalThis as any).__mcp_call(server, tool, input);
  return response as T;
}
`;
  fs.mkdirSync(codexDir, { recursive: true });
  fs.writeFileSync(path.join(codexDir, "runtime.ts"), runtimeCode);

  // Generate server directories and tool files
  for (const [category, tools] of Object.entries(catalog)) {
    const categoryDir = path.join(serversDir, category);
    fs.mkdirSync(categoryDir, { recursive: true });

    // Generate individual tool files
    for (const tool of tools) {
      fs.writeFileSync(
        path.join(categoryDir, `${tool.name}.ts`),
        generateToolFile(tool)
      );
    }

    // Generate index.ts
    fs.writeFileSync(
      path.join(categoryDir, "index.ts"),
      generateIndexFile(category, tools)
    );
  }

  // Generate root README
  const readmeContent = `# Lattice Workbench — Code API

Explore this filesystem to discover available tools.
Import only what you need for your task.

## Quick Start

\`\`\`typescript
import * as workspace from './servers/workspace';
import * as swarm from './servers/swarm';

// Only these 2 modules are loaded — not all 53 tools
const ws = await workspace.createWorkspace({ projectPath: '/my/project', branchName: 'feature' });
await workspace.sendMessage({ workspaceId: ws.workspaceId, message: 'Build the API' });
\`\`\`

## Available Servers

${Object.entries(catalog).map(([cat, tools]) => `- **${cat}/** — ${tools.length} tools (${tools.map(t => t.name).join(', ')})`).join("\n")}

## Total: ${Object.values(catalog).reduce((a, b) => a + b.length, 0)} tools
`;

  fs.writeFileSync(path.join(codexDir, "README.md"), readmeContent);

  return codexDir;
}

// ── Register codex tools ─────────────────────────────────────────────

export function registerCodexTools(server: McpServer, _client: WorkbenchClient): void {

  // ── Search tools with progressive disclosure ───────────────────────

  server.tool(
    "codex_search_tools",
    `Search for available tools by keyword. Returns matching tools with progressive detail levels.

This is the entry point for the code-execution MCP pattern. Instead of loading all 53+ tool definitions into your context, search for what you need.

Detail levels:
- "names" — just tool names (cheapest)
- "brief" — name + one-line description
- "full" — complete definition with params, types, examples`,
    {
      query: z.string().optional().describe("Search query (keyword, category name, or action verb). Omit for overview."),
      category: z.string().optional().describe("Filter by category: workspace, project, channel, system, swarm, bootstrap, cron, health"),
      detail: z.enum(["names", "brief", "full"]).optional().describe("Detail level (default: brief)"),
    },
    async ({ query, category, detail }) => {
      const catalog = getToolCatalog();
      const detailLevel = detail ?? "brief";
      const results: Array<{ category: string; tool: ToolDef }> = [];

      // Collect matching tools
      for (const [cat, tools] of Object.entries(catalog)) {
        if (category && cat !== category) continue;

        for (const tool of tools) {
          if (!query) {
            results.push({ category: cat, tool });
            continue;
          }

          const q = query.toLowerCase();
          const searchText = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
          if (searchText.includes(q)) {
            results.push({ category: cat, tool });
          }
        }
      }

      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No tools matching "${query ?? ""}". Categories: ${Object.keys(catalog).join(", ")}`,
          }],
        };
      }

      // Format based on detail level
      const lines: string[] = [];
      lines.push(`🔍 Found ${results.length} tools${query ? ` matching "${query}"` : ""}${category ? ` in ${category}` : ""}\n`);

      if (detailLevel === "names") {
        const byCategory = new Map<string, string[]>();
        for (const r of results) {
          if (!byCategory.has(r.category)) byCategory.set(r.category, []);
          byCategory.get(r.category)!.push(r.tool.name);
        }
        for (const [cat, names] of byCategory) {
          lines.push(`${cat}: ${names.join(", ")}`);
        }
      } else if (detailLevel === "brief") {
        let currentCategory = "";
        for (const r of results) {
          if (r.category !== currentCategory) {
            currentCategory = r.category;
            lines.push(`\n📁 ${currentCategory}/`);
          }
          lines.push(`  ${r.tool.name} — ${r.tool.description}`);
        }
      } else {
        // Full detail
        for (const r of results) {
          lines.push(`\n━━━ ${r.category}/${r.tool.name} ━━━`);
          lines.push(`Description: ${r.tool.description}`);
          if (r.tool.params.length > 0) {
            lines.push("Parameters:");
            for (const p of r.tool.params) {
              lines.push(`  ${p.name}${p.required ? " (required)" : " (optional)"}: ${p.type} — ${p.description}`);
            }
          } else {
            lines.push("Parameters: none");
          }
          lines.push(`Returns: ${r.tool.returnType}`);
          lines.push(`Import: import { ${r.tool.name} } from './servers/${r.category}';`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  // ── Generate code API filesystem ───────────────────────────────────

  server.tool(
    "codex_generate",
    "Generate the code-execution filesystem at ~/.lattice/codex/servers/. Creates importable TypeScript files for all tools so agents can discover them via filesystem exploration.",
    {},
    async () => {
      try {
        const codexDir = ensureCodexGenerated();
        const catalog = getToolCatalog();
        const totalTools = Object.values(catalog).reduce((a, b) => a + b.length, 0);

        const tree = generateServerTree();

        return {
          content: [{
            type: "text" as const,
            text: `✅ Codex generated at: ${codexDir}\n\n${tree}\n\n${totalTools} tools across ${Object.keys(catalog).length} servers.\n\nAgents can now explore ./servers/ to discover tools on-demand.`,
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // ── Get tool definition (load on demand) ───────────────────────────

  server.tool(
    "codex_get_tool",
    "Get the full TypeScript source for a specific tool. Like reading a file from ./servers/<category>/<tool>.ts — loads just the definition you need.",
    {
      category: z.string().describe("Tool category (workspace, swarm, etc.)"),
      toolName: z.string().describe("Tool name"),
    },
    async ({ category, toolName }) => {
      const catalog = getToolCatalog();
      const tools = catalog[category];
      if (!tools) {
        return {
          content: [{ type: "text" as const, text: `Category "${category}" not found. Available: ${Object.keys(catalog).join(", ")}` }],
          isError: true,
        };
      }

      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        return {
          content: [{ type: "text" as const, text: `Tool "${toolName}" not found in ${category}. Available: ${tools.map(t => t.name).join(", ")}` }],
          isError: true,
        };
      }

      const code = generateToolFile(tool);
      return {
        content: [{ type: "text" as const, text: code }],
      };
    }
  );

  // ── Overview — minimal context summary ─────────────────────────────

  server.tool(
    "codex_overview",
    "Get a minimal overview of all available tool categories and counts. The cheapest way to understand what's available before diving deeper.",
    {},
    async () => {
      const catalog = getToolCatalog();

      const lines: string[] = [];
      lines.push("🐙 Lattice Workbench — Tool Overview\n");

      let total = 0;
      for (const [category, tools] of Object.entries(catalog)) {
        total += tools.length;
        lines.push(`📁 ${category}/ (${tools.length} tools)`);
        lines.push(`   ${tools.map(t => t.name).join(", ")}`);
      }

      lines.push(`\n📊 Total: ${total} tools across ${Object.keys(catalog).length} categories`);
      lines.push("\nUse codex_search_tools to find specific tools");
      lines.push("Use codex_get_tool to load a tool's full definition");

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
