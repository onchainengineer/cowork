/**
 * WorkbenchClient — HTTP client for Lattice Workbench ORPC/REST API.
 *
 * Thin fetch() wrapper that talks to the running workbench server.
 * All methods correspond to ORPC routes exposed at /api/*.
 */

export interface WorkbenchClientOptions {
  baseUrl: string;
  authToken?: string;
}

export class WorkbenchClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(options: WorkbenchClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
    };
  }

  // ── Generic request helpers ───────────────────────────────────────

  private async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/orpc${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Workbench API error ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  // ── Health check ──────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Projects ──────────────────────────────────────────────────────

  async listProjects(): Promise<Array<{ path: string; config: unknown }>> {
    return this.post("/projects.list");
  }

  async createProject(projectPath: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/projects.create", { projectPath });
  }

  async listBranches(
    projectPath: string
  ): Promise<{ branches: string[]; recommendedTrunk: string | null }> {
    return this.post("/projects.listBranches", { projectPath });
  }

  // ── Workspaces ────────────────────────────────────────────────────

  async listWorkspaces(
    archived?: boolean
  ): Promise<Array<{ id: string; title: string; projectPath: string; [key: string]: unknown }>> {
    return this.post("/workspace.list", archived !== undefined ? { archived } : undefined);
  }

  async createWorkspace(params: {
    projectPath: string;
    branchName: string;
    trunkBranch?: string;
    title?: string;
  }): Promise<{ success: boolean; data?: { metadata: { id: string } }; error?: string }> {
    return this.post("/workspace.create", params);
  }

  async removeWorkspace(
    workspaceId: string,
    force?: boolean
  ): Promise<{ success: boolean; error?: string }> {
    return this.post("/workspace.remove", { workspaceId, force });
  }

  async getWorkspaceInfo(workspaceId: string): Promise<unknown> {
    return this.post("/workspace.getInfo", { workspaceId });
  }

  async renameWorkspace(workspaceId: string, title: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/workspace.rename", { workspaceId, title });
  }

  async forkWorkspace(workspaceId: string, branchName: string, title?: string): Promise<{ success: boolean; data?: { metadata: { id: string } }; error?: string }> {
    return this.post("/workspace.fork", { workspaceId, branchName, title });
  }

  async archiveWorkspace(workspaceId: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/workspace.archive", { workspaceId });
  }

  async unarchiveWorkspace(workspaceId: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/workspace.unarchive", { workspaceId });
  }

  async getFullReplay(workspaceId: string): Promise<unknown[]> {
    return this.post("/workspace.getFullReplay", { workspaceId });
  }

  /**
   * Send a message to a workspace agent.
   * This triggers the agent loop — the response streams back asynchronously.
   * Use pollForResponse() after calling this to get the assistant's reply.
   */
  async sendMessage(
    workspaceId: string,
    message: string,
    options?: { model?: string; agentId?: string }
  ): Promise<{ success: boolean; error?: string }> {
    return this.post("/workspace.sendMessage", {
      workspaceId,
      message,
      ...options,
    });
  }

  async interruptStream(workspaceId: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/workspace.interruptStream", { workspaceId });
  }

  /**
   * Execute a bash script in a workspace runtime.
   */
  async executeBash(
    workspaceId: string,
    script: string,
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.post("/workspace.executeBash", {
      workspaceId,
      script,
      ...(timeout ? { timeout } : {}),
    });
  }

  // ── Channels ──────────────────────────────────────────────────────

  async listChannels(): Promise<
    Array<{
      type: string;
      accountId: string;
      status: string;
      enabled: boolean;
      sessionCount: number;
    }>
  > {
    return this.post("/channels.list");
  }

  async connectChannel(accountId: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/channels.connect", { accountId });
  }

  async disconnectChannel(accountId: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/channels.disconnect", { accountId });
  }

  async sendChannelMessage(
    accountId: string,
    to: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.post("/channels.sendMessage", {
      accountId,
      message: { to: { id: to }, text },
    });
  }

  async getChannel(accountId: string): Promise<{
    type: string;
    accountId: string;
    enabled: boolean;
    defaultProjectPath: string;
    sessionScope: string;
    credentials: Record<string, string>;
    settings?: Record<string, unknown>;
  }> {
    return this.post("/channels.get", { accountId });
  }

  async createChannel(config: {
    type: string;
    accountId: string;
    enabled: boolean;
    defaultProjectPath: string;
    sessionScope?: string;
    credentials: Record<string, string>;
    settings?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    return this.post("/channels.create", config);
  }

  async updateChannel(config: {
    type: string;
    accountId: string;
    enabled: boolean;
    defaultProjectPath: string;
    sessionScope?: string;
    credentials: Record<string, string>;
    settings?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    return this.post("/channels.update", config);
  }

  async removeChannel(accountId: string): Promise<{ success: boolean; error?: string }> {
    return this.post("/channels.remove", { accountId });
  }

  async listChannelSessions(accountId?: string): Promise<
    Array<{
      sessionKey: string;
      workspaceId: string;
      channelType: string;
      accountId: string;
      peerId: string;
      peerKind: string;
      displayName?: string;
      lastMessageAt: number;
      createdAt: number;
    }>
  > {
    return this.post("/channels.sessions.list", accountId ? { accountId } : {});
  }

  // ── Providers ─────────────────────────────────────────────────────

  async listProviders(): Promise<unknown[]> {
    return this.post("/providers.list");
  }

  // ── Inference / Models ──────────────────────────────────────────────

  async listModels(): Promise<
    Array<{
      id: string;
      name: string;
      format?: string;
      sizeBytes?: number;
      quantization?: string;
      localPath?: string;
      backend?: string;
    }>
  > {
    return this.post("/inference.listModels");
  }

  async getInferenceStatus(): Promise<{ available: boolean; loadedModelId: string | null }> {
    return this.post("/inference.getStatus");
  }

  // ── Workspace Activity ──────────────────────────────────────────────

  async listWorkspaceActivity(): Promise<Record<string, {
    status?: string;
    streaming?: boolean;
    lastActivity?: number;
    [key: string]: unknown;
  }>> {
    return this.post("/workspace.activity.list");
  }

  // ── File / Directory Operations ─────────────────────────────────────

  async listDirectory(dirPath: string): Promise<unknown> {
    return this.post("/general.listDirectory", { path: dirPath });
  }

  async createDirectory(dirPath: string): Promise<{ success: boolean; data?: { normalizedPath: string }; error?: string }> {
    return this.post("/general.createDirectory", { path: dirPath });
  }

  // ── Polling helper for send_message ───────────────────────────────

  /**
   * After sending a message, poll getFullReplay until a new assistant
   * message appears. Returns the assistant's response text.
   *
   * Simple v1 approach — polls every 2s up to timeoutMs.
   */
  async pollForResponse(
    workspaceId: string,
    previousMessageCount: number,
    timeoutMs: number = 120_000
  ): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));

      try {
        const replay = await this.getFullReplay(workspaceId);
        const messages = replay as Array<{ role?: string; type?: string; content?: string; text?: string }>;

        // Look for new assistant messages beyond what we had before
        if (messages.length > previousMessageCount) {
          // Find the last assistant message
          const assistantMessages = messages.filter(
            (m) => m.role === "assistant" || m.type === "assistant"
          );

          if (assistantMessages.length > 0) {
            const last = assistantMessages[assistantMessages.length - 1]!;
            const text = last.content ?? last.text ?? "";

            // Check if streaming is done by looking for stream-end type messages
            // or if the message has content (non-empty = likely done)
            if (text.length > 0) {
              // Wait one more poll to make sure streaming is complete
              await new Promise((r) => setTimeout(r, pollInterval));
              const final = await this.getFullReplay(workspaceId);
              const finalMessages = final as Array<{
                role?: string;
                type?: string;
                content?: string;
                text?: string;
              }>;
              const finalAssistant = finalMessages.filter(
                (m) => m.role === "assistant" || m.type === "assistant"
              );
              if (finalAssistant.length > 0) {
                const finalLast = finalAssistant[finalAssistant.length - 1]!;
                return finalLast.content ?? finalLast.text ?? text;
              }
              return text;
            }
          }
        }
      } catch {
        // Transient error — keep polling
      }
    }

    return "[Timeout: agent did not respond within the time limit]";
  }
}
