import { describe, it, expect } from "bun:test";
import * as fs from "fs/promises";
import * as path from "path";
import type { ToolCallOptions } from "ai";

import {
  UNIX_HELP_CHAT_WORKSPACE_ID,
  UNIX_HELP_CHAT_WORKSPACE_NAME,
  UNIX_HELP_CHAT_WORKSPACE_TITLE,
} from "@/common/constants/unixChat";
import { FILE_EDIT_DIFF_OMITTED_MESSAGE } from "@/common/types/tools";

import { createUnixGlobalAgentsReadTool } from "./unix_global_agents_read";
import { createUnixGlobalAgentsWriteTool } from "./unix_global_agents_write";
import { TestTempDir, createTestToolConfig } from "./testHelpers";

const mockToolCallOptions: ToolCallOptions = {
  toolCallId: "test-call-id",
  messages: [],
};

describe("unix_global_agents_* tools", () => {
  it("reads ~/.unix/AGENTS.md (returns empty string if missing)", async () => {
    using unixHome = new TestTempDir("unix-global-agents");

    const workspaceSessionDir = path.join(unixHome.path, "sessions", UNIX_HELP_CHAT_WORKSPACE_ID);
    await fs.mkdir(workspaceSessionDir, { recursive: true });

    const config = createTestToolConfig(unixHome.path, {
      workspaceId: UNIX_HELP_CHAT_WORKSPACE_ID,
      sessionsDir: workspaceSessionDir,
    });

    const tool = createUnixGlobalAgentsReadTool(config);

    // Missing file -> empty
    const missing = (await tool.execute!({}, mockToolCallOptions)) as {
      success: boolean;
      content?: string;
    };
    expect(missing.success).toBe(true);
    if (missing.success) {
      expect(missing.content).toBe("");
    }

    // Present file -> contents
    const agentsPath = path.join(unixHome.path, "AGENTS.md");
    await fs.writeFile(
      agentsPath,
      `# ${UNIX_HELP_CHAT_WORKSPACE_TITLE}\n${UNIX_HELP_CHAT_WORKSPACE_NAME}\n`,
      "utf-8"
    );

    const result = (await tool.execute!({}, mockToolCallOptions)) as {
      success: boolean;
      content?: string;
    };
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.content).toContain(UNIX_HELP_CHAT_WORKSPACE_TITLE);
      expect(result.content).toContain(UNIX_HELP_CHAT_WORKSPACE_NAME);
    }
  });

  it("refuses to write without explicit confirmation", async () => {
    using unixHome = new TestTempDir("unix-global-agents");

    const workspaceSessionDir = path.join(unixHome.path, "sessions", UNIX_HELP_CHAT_WORKSPACE_ID);
    await fs.mkdir(workspaceSessionDir, { recursive: true });

    const config = createTestToolConfig(unixHome.path, {
      workspaceId: UNIX_HELP_CHAT_WORKSPACE_ID,
      sessionsDir: workspaceSessionDir,
    });

    const tool = createUnixGlobalAgentsWriteTool(config);

    const agentsPath = path.join(unixHome.path, "AGENTS.md");

    const result = (await tool.execute!(
      { newContent: "test", confirm: false },
      mockToolCallOptions
    )) as { success: boolean; error?: string };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("confirm");
    }

    let readError: unknown;
    try {
      await fs.readFile(agentsPath, "utf-8");
    } catch (error) {
      readError = error;
    }

    expect(readError).toMatchObject({ code: "ENOENT" });
  });

  it("writes ~/.unix/AGENTS.md and returns a diff", async () => {
    using unixHome = new TestTempDir("unix-global-agents");

    const workspaceSessionDir = path.join(unixHome.path, "sessions", UNIX_HELP_CHAT_WORKSPACE_ID);
    await fs.mkdir(workspaceSessionDir, { recursive: true });

    const config = createTestToolConfig(unixHome.path, {
      workspaceId: UNIX_HELP_CHAT_WORKSPACE_ID,
      sessionsDir: workspaceSessionDir,
    });

    const tool = createUnixGlobalAgentsWriteTool(config);

    const newContent = "# Global agents\n\nHello\n";

    const result = (await tool.execute!({ newContent, confirm: true }, mockToolCallOptions)) as {
      success: boolean;
      diff?: string;
      ui_only?: { file_edit?: { diff?: string } };
    };

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.diff).toBe(FILE_EDIT_DIFF_OMITTED_MESSAGE);
      expect(result.ui_only?.file_edit?.diff).toContain("AGENTS.md");
    }

    const written = await fs.readFile(path.join(unixHome.path, "AGENTS.md"), "utf-8");
    expect(written).toBe(newContent);
  });

  it("rejects symlink targets", async () => {
    using unixHome = new TestTempDir("unix-global-agents");

    const workspaceSessionDir = path.join(unixHome.path, "sessions", UNIX_HELP_CHAT_WORKSPACE_ID);
    await fs.mkdir(workspaceSessionDir, { recursive: true });

    const config = createTestToolConfig(unixHome.path, {
      workspaceId: UNIX_HELP_CHAT_WORKSPACE_ID,
      sessionsDir: workspaceSessionDir,
    });

    const readTool = createUnixGlobalAgentsReadTool(config);
    const writeTool = createUnixGlobalAgentsWriteTool(config);

    const agentsPath = path.join(unixHome.path, "AGENTS.md");
    const targetPath = path.join(unixHome.path, "target.txt");
    await fs.writeFile(targetPath, "secret", "utf-8");
    await fs.symlink(targetPath, agentsPath);

    const readResult = (await readTool.execute!({}, mockToolCallOptions)) as {
      success: boolean;
      error?: string;
    };
    expect(readResult.success).toBe(false);
    if (!readResult.success) {
      expect(readResult.error).toContain("symlink");
    }

    const writeResult = (await writeTool.execute!(
      { newContent: "nope", confirm: true },
      mockToolCallOptions
    )) as { success: boolean; error?: string };
    expect(writeResult.success).toBe(false);
    if (!writeResult.success) {
      expect(writeResult.error).toContain("symlink");
    }
  });
});
