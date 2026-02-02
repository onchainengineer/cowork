/**
 * Cron / Scheduled Task MCP tools — recurring autonomous operations.
 *
 * Ported from OpenClaw's cron system: the octopus can schedule recurring
 * tasks that execute automatically in workspace agents.
 *
 * Use cases:
 *   - Daily code review sweeps
 *   - Periodic dependency updates
 *   - Scheduled test runs
 *   - Health checks on deployed services
 *   - Recurring data collection/analysis
 *   - Automated git operations (pull, merge, rebase)
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WorkbenchClient } from "../client.js";

// ── Types ────────────────────────────────────────────────────────────

interface CronJob {
  id: string;
  name: string;
  schedule: string; // cron expression or interval string
  intervalMs: number; // parsed interval
  workspaceId: string;
  task: string; // message to send
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastResult?: string;
  lastError?: string;
  runCount: number;
  nextRunAt: number;
  timerId?: ReturnType<typeof setTimeout>;
}

interface CronState {
  jobs: Map<string, CronJob>;
  counter: number;
}

const cronState: CronState = {
  jobs: new Map(),
  counter: 0,
};

function genCronId(): string {
  return `cron-${(++cronState.counter).toString().padStart(3, "0")}`;
}

// ── Simple interval parser ───────────────────────────────────────────
// Supports: "30s", "5m", "1h", "6h", "1d", "every 30 minutes", etc.

function parseInterval(schedule: string): number {
  const s = schedule.trim().toLowerCase();

  // Direct ms
  const msMatch = s.match(/^(\d+)\s*ms$/);
  if (msMatch) return parseInt(msMatch[1]!);

  // Seconds
  const secMatch = s.match(/^(\d+)\s*s(?:ec(?:ond)?s?)?$/);
  if (secMatch) return parseInt(secMatch[1]!) * 1000;

  // Minutes
  const minMatch = s.match(/^(\d+)\s*m(?:in(?:ute)?s?)?$/);
  if (minMatch) return parseInt(minMatch[1]!) * 60 * 1000;

  // Hours
  const hourMatch = s.match(/^(\d+)\s*h(?:(?:ou)?rs?)?$/);
  if (hourMatch) return parseInt(hourMatch[1]!) * 60 * 60 * 1000;

  // Days
  const dayMatch = s.match(/^(\d+)\s*d(?:ays?)?$/);
  if (dayMatch) return parseInt(dayMatch[1]!) * 24 * 60 * 60 * 1000;

  // "every X minutes/hours/etc"
  const everyMatch = s.match(/^every\s+(\d+)\s+(second|minute|hour|day)s?$/);
  if (everyMatch) {
    const n = parseInt(everyMatch[1]!);
    const unit = everyMatch[2]!;
    switch (unit) {
      case "second": return n * 1000;
      case "minute": return n * 60 * 1000;
      case "hour": return n * 60 * 60 * 1000;
      case "day": return n * 24 * 60 * 60 * 1000;
    }
  }

  // Default: treat as minutes
  const numOnly = parseInt(s);
  if (!isNaN(numOnly)) return numOnly * 60 * 1000;

  throw new Error(`Cannot parse schedule: "${schedule}". Use formats like "30s", "5m", "1h", "1d", or "every 30 minutes".`);
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

// ── Job execution ────────────────────────────────────────────────────

function scheduleNextRun(client: WorkbenchClient, job: CronJob): void {
  // Clear existing timer
  if (job.timerId) {
    clearTimeout(job.timerId);
    job.timerId = undefined;
  }

  if (!job.enabled) return;

  const delay = Math.max(job.nextRunAt - Date.now(), 1000);

  job.timerId = setTimeout(async () => {
    if (!job.enabled) return;

    job.lastRunAt = Date.now();
    job.runCount++;

    try {
      // Send the task to the workspace
      const sendResult = await client.sendMessage(job.workspaceId, `[CRON: ${job.name}]\n${job.task}`);

      if (!sendResult.success) {
        job.lastError = sendResult.error ?? "Send failed";
        job.lastResult = undefined;
      } else {
        // Poll for response (shorter timeout for cron — 3 min)
        try {
          const response = await client.pollForResponse(job.workspaceId, 0, 180_000);
          job.lastResult = response;
          job.lastError = undefined;
        } catch (pollErr) {
          job.lastResult = undefined;
          job.lastError = `Poll failed: ${pollErr instanceof Error ? pollErr.message : String(pollErr)}`;
        }
      }
    } catch (error) {
      job.lastError = error instanceof Error ? error.message : String(error);
      job.lastResult = undefined;
    }

    // Schedule next run
    job.nextRunAt = Date.now() + job.intervalMs;
    scheduleNextRun(client, job);
  }, delay);
}

// ── Register cron tools ──────────────────────────────────────────────

export function registerCronTools(server: McpServer, client: WorkbenchClient): void {

  server.tool(
    "cron_create",
    `Schedule a recurring task in a workspace agent. The task will be sent as a message at each interval.

Schedule formats: "30s", "5m", "1h", "6h", "1d", "every 30 minutes"

Examples:
- "every 6 hours" + "Run the test suite and report failures"
- "1d" + "Check for dependency updates and create a PR if any found"
- "30m" + "Monitor the deployment health endpoint and alert if down"`,
    {
      name: z.string().describe("Human-readable job name"),
      workspaceId: z.string().describe("Workspace to send task to"),
      schedule: z.string().describe("Interval: '30s', '5m', '1h', '1d', 'every 30 minutes'"),
      task: z.string().describe("The message/instruction to send at each interval"),
      startImmediately: z.boolean().optional().describe("Run the first execution immediately (default: false)"),
    },
    async ({ name, workspaceId, schedule, task, startImmediately }) => {
      try {
        const intervalMs = parseInterval(schedule);

        if (intervalMs < 10_000) {
          return {
            content: [{ type: "text" as const, text: "Minimum interval is 10 seconds." }],
            isError: true,
          };
        }

        const id = genCronId();
        const now = Date.now();

        const job: CronJob = {
          id,
          name,
          schedule,
          intervalMs,
          workspaceId,
          task,
          enabled: true,
          createdAt: now,
          runCount: 0,
          nextRunAt: startImmediately ? now + 1000 : now + intervalMs,
        };

        cronState.jobs.set(id, job);
        scheduleNextRun(client, job);

        return {
          content: [{
            type: "text" as const,
            text: `⏰ Cron job created: ${id}\n  Name: ${name}\n  Schedule: every ${formatDuration(intervalMs)}\n  Workspace: ${workspaceId}\n  Next run: ${startImmediately ? "~now" : `in ${formatDuration(intervalMs)}`}\n  Task: ${task.slice(0, 100)}${task.length > 100 ? "..." : ""}`,
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

  server.tool(
    "cron_list",
    "List all scheduled cron jobs with their status, last run info, and next run time.",
    {},
    async () => {
      const jobs = Array.from(cronState.jobs.values());

      if (jobs.length === 0) {
        return { content: [{ type: "text" as const, text: "No cron jobs scheduled." }] };
      }

      const lines: string[] = [];
      lines.push(`⏰ SCHEDULED JOBS (${jobs.length})\n`);

      for (const job of jobs) {
        const icon = job.enabled ? "🟢" : "🔴";
        const nextIn = job.enabled ? formatDuration(Math.max(0, job.nextRunAt - Date.now())) : "disabled";

        lines.push(`${icon} ${job.id} "${job.name}"`);
        lines.push(`   Schedule: every ${formatDuration(job.intervalMs)} | Runs: ${job.runCount}`);
        lines.push(`   Workspace: ${job.workspaceId}`);
        lines.push(`   Next run: ${nextIn}`);

        if (job.lastRunAt) {
          const ago = formatDuration(Date.now() - job.lastRunAt);
          lines.push(`   Last run: ${ago} ago`);
          if (job.lastResult) {
            lines.push(`   Last result: ${job.lastResult.slice(0, 150)}${job.lastResult.length > 150 ? "..." : ""}`);
          }
          if (job.lastError) {
            lines.push(`   ⚠️ Last error: ${job.lastError}`);
          }
        }
        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }
  );

  server.tool(
    "cron_enable",
    "Enable or disable a cron job.",
    {
      jobId: z.string().describe("Cron job ID"),
      enabled: z.boolean().describe("true to enable, false to disable"),
    },
    async ({ jobId, enabled }) => {
      const job = cronState.jobs.get(jobId);
      if (!job) return { content: [{ type: "text" as const, text: `Job ${jobId} not found` }], isError: true };

      job.enabled = enabled;

      if (enabled) {
        job.nextRunAt = Date.now() + job.intervalMs;
        scheduleNextRun(client, job);
        return { content: [{ type: "text" as const, text: `✅ Job "${job.name}" enabled. Next run in ${formatDuration(job.intervalMs)}` }] };
      } else {
        if (job.timerId) {
          clearTimeout(job.timerId);
          job.timerId = undefined;
        }
        return { content: [{ type: "text" as const, text: `🔴 Job "${job.name}" disabled.` }] };
      }
    }
  );

  server.tool(
    "cron_delete",
    "Delete a cron job permanently.",
    { jobId: z.string() },
    async ({ jobId }) => {
      const job = cronState.jobs.get(jobId);
      if (!job) return { content: [{ type: "text" as const, text: `Job ${jobId} not found` }], isError: true };

      if (job.timerId) clearTimeout(job.timerId);
      cronState.jobs.delete(jobId);

      return { content: [{ type: "text" as const, text: `🗑️ Job "${job.name}" (${jobId}) deleted. Ran ${job.runCount} times.` }] };
    }
  );

  server.tool(
    "cron_run_now",
    "Trigger an immediate execution of a cron job (doesn't affect the regular schedule).",
    { jobId: z.string() },
    async ({ jobId }) => {
      const job = cronState.jobs.get(jobId);
      if (!job) return { content: [{ type: "text" as const, text: `Job ${jobId} not found` }], isError: true };

      job.lastRunAt = Date.now();
      job.runCount++;

      try {
        const sendResult = await client.sendMessage(job.workspaceId, `[CRON: ${job.name} — manual trigger]\n${job.task}`);
        if (!sendResult.success) {
          job.lastError = sendResult.error ?? "Send failed";
          return { content: [{ type: "text" as const, text: `❌ Failed to trigger: ${sendResult.error}` }], isError: true };
        }

        // Poll for response
        const response = await client.pollForResponse(job.workspaceId, 0, 180_000);
        job.lastResult = response;
        job.lastError = undefined;

        return {
          content: [{ type: "text" as const, text: `✅ Job "${job.name}" executed.\n\nResult:\n${response}` }],
        };
      } catch (error) {
        job.lastError = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `❌ Error: ${job.lastError}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "cron_edit",
    "Edit an existing cron job's schedule or task.",
    {
      jobId: z.string(),
      schedule: z.string().optional().describe("New schedule"),
      task: z.string().optional().describe("New task message"),
      name: z.string().optional().describe("New name"),
    },
    async ({ jobId, schedule, task, name }) => {
      const job = cronState.jobs.get(jobId);
      if (!job) return { content: [{ type: "text" as const, text: `Job ${jobId} not found` }], isError: true };

      const changes: string[] = [];

      if (name) {
        job.name = name;
        changes.push(`name → "${name}"`);
      }
      if (schedule) {
        job.intervalMs = parseInterval(schedule);
        job.schedule = schedule;
        job.nextRunAt = Date.now() + job.intervalMs;
        changes.push(`schedule → every ${formatDuration(job.intervalMs)}`);
      }
      if (task) {
        job.task = task;
        changes.push(`task updated (${task.length} chars)`);
      }

      // Reschedule if running
      if (job.enabled) {
        scheduleNextRun(client, job);
      }

      return {
        content: [{ type: "text" as const, text: `✏️ Job ${jobId} updated:\n  ${changes.join("\n  ")}` }],
      };
    }
  );
}
