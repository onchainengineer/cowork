import * as os from "os";
import * as path from "path";
import * as fsPromises from "fs/promises";
import {
  UNIX_HELP_CHAT_AGENT_ID,
  UNIX_HELP_CHAT_WORKSPACE_ID,
  UNIX_HELP_CHAT_WORKSPACE_NAME,
  UNIX_HELP_CHAT_WORKSPACE_TITLE,
} from "@/common/constants/unixChat";
import { getUnixHelpChatProjectPath } from "@/node/constants/unixChat";
import { createUnixMessage } from "@/common/types/message";
import { log } from "@/node/services/log";
import type { Config } from "@/node/config";
import { AIService } from "@/node/services/aiService";
import { HistoryService } from "@/node/services/historyService";
import { PartialService } from "@/node/services/partialService";
import { InitStateManager } from "@/node/services/initStateManager";
import { PTYService } from "@/node/services/ptyService";
import type { TerminalWindowManager } from "@/desktop/terminalWindowManager";
import { ProjectService } from "@/node/services/projectService";
import { WorkspaceService } from "@/node/services/workspaceService";
import { ProviderService } from "@/node/services/providerService";
import { ExtensionMetadataService } from "@/node/services/ExtensionMetadataService";
import { TerminalService } from "@/node/services/terminalService";
import { EditorService } from "@/node/services/editorService";
import { WindowService } from "@/node/services/windowService";
import { UpdateService } from "@/node/services/updateService";
import { TokenizerService } from "@/node/services/tokenizerService";
import { ServerService } from "@/node/services/serverService";
import { MenuEventService } from "@/node/services/menuEventService";
import { VoiceService } from "@/node/services/voiceService";
import { TelemetryService } from "@/node/services/telemetryService";
import type {
  ReasoningDeltaEvent,
  StreamAbortEvent,
  StreamDeltaEvent,
  StreamEndEvent,
  StreamStartEvent,
  ToolCallDeltaEvent,
  ToolCallEndEvent,
  ToolCallStartEvent,
} from "@/common/types/stream";
import { FeatureFlagService } from "@/node/services/featureFlagService";
import { SessionTimingService } from "@/node/services/sessionTimingService";
import { ExperimentsService } from "@/node/services/experimentsService";
import { BackgroundProcessManager } from "@/node/services/backgroundProcessManager";
import { MCPConfigService } from "@/node/services/mcpConfigService";
import { WorkspaceMcpOverridesService } from "@/node/services/workspaceMcpOverridesService";
import { MCPServerManager } from "@/node/services/mcpServerManager";
import { SessionUsageService } from "@/node/services/sessionUsageService";
import { IdleCompactionService } from "@/node/services/idleCompactionService";
import { TaskService } from "@/node/services/taskService";
import { getSigningService, type SigningService } from "@/node/services/signingService";
import { latticeService, type LatticeService } from "@/node/services/latticeService";
import { setGlobalLatticeService } from "@/node/runtime/runtimeFactory";
import { InferenceService } from "@/node/services/inference";
import { ChannelService } from "@/node/services/channelService";
import { ChannelSessionRouter } from "@/node/services/channelSessionRouter";

const UNIX_HELP_CHAT_WELCOME_MESSAGE_ID = "unix-chat-welcome";
const UNIX_HELP_CHAT_WELCOME_MESSAGE = `Welcome to Lattice Workbench — a system of AI agents for software development.

This is your built-in **Chat with Lattice** workspace — a safe place to ask questions about Lattice Workbench itself.

I can help you:
- Configure global agent behavior by editing **~/.unix/AGENTS.md** (I'll show a diff and ask before writing).
- Pick models/providers and explain Lattice modes + tool policies.
- Troubleshoot common setup issues (keys, runtimes, workspaces, etc.).

Try asking:
- "What does AGENTS.md do?"
- "Help me write global instructions for code reviews"
- "How do I set up an OpenAI / Anthropic key in Lattice Workbench?"
`;

/**
 * ServiceContainer - Central dependency container for all backend services.
 *
 * This class instantiates and wires together all services needed by the ORPC router.
 * Services are accessed via the ORPC context object.
 */
export class ServiceContainer {
  public readonly config: Config;
  private readonly historyService: HistoryService;
  private readonly partialService: PartialService;
  public readonly aiService: AIService;
  public readonly projectService: ProjectService;
  public readonly workspaceService: WorkspaceService;
  public readonly taskService: TaskService;
  public readonly providerService: ProviderService;
  public readonly terminalService: TerminalService;
  public readonly editorService: EditorService;
  public readonly windowService: WindowService;
  public readonly updateService: UpdateService;
  public readonly tokenizerService: TokenizerService;
  public readonly serverService: ServerService;
  public readonly menuEventService: MenuEventService;
  public readonly voiceService: VoiceService;
  public readonly mcpConfigService: MCPConfigService;
  public readonly workspaceMcpOverridesService: WorkspaceMcpOverridesService;
  public readonly mcpServerManager: MCPServerManager;
  public readonly telemetryService: TelemetryService;
  public readonly featureFlagService: FeatureFlagService;
  public readonly sessionTimingService: SessionTimingService;
  public readonly experimentsService: ExperimentsService;
  public readonly sessionUsageService: SessionUsageService;
  public readonly signingService: SigningService;
  public readonly latticeService: LatticeService;
  public readonly inferenceService: InferenceService;
  public readonly channelSessionRouter: ChannelSessionRouter;
  public readonly channelService: ChannelService;
  private readonly initStateManager: InitStateManager;
  private readonly extensionMetadata: ExtensionMetadataService;
  private readonly ptyService: PTYService;
  private readonly backgroundProcessManager: BackgroundProcessManager;
  public readonly idleCompactionService: IdleCompactionService;

  constructor(config: Config) {
    this.config = config;
    this.historyService = new HistoryService(config);
    this.partialService = new PartialService(config, this.historyService);
    this.projectService = new ProjectService(config);
    this.initStateManager = new InitStateManager(config);
    this.workspaceMcpOverridesService = new WorkspaceMcpOverridesService(config);
    this.mcpConfigService = new MCPConfigService();
    this.extensionMetadata = new ExtensionMetadataService(
      path.join(config.rootDir, "extensionMetadata.json")
    );
    this.backgroundProcessManager = new BackgroundProcessManager(
      path.join(os.tmpdir(), "unix-bashes")
    );
    this.mcpServerManager = new MCPServerManager(this.mcpConfigService, {
      bundledServers: {
        // Playwright browser automation — available to all agents by default.
        // Users can disable per-project in .lattice/mcp.jsonc:
        //   { "servers": { "playwright": { "disabled": true } } }
        playwright: {
          transport: "stdio" as const,
          command: "npx @anthropic/mcp-playwright",
          disabled: false,
        },
      },
    });
    this.sessionUsageService = new SessionUsageService(config, this.historyService);
    this.aiService = new AIService(
      config,
      this.historyService,
      this.partialService,
      this.initStateManager,
      this.backgroundProcessManager,
      this.sessionUsageService,
      this.workspaceMcpOverridesService
    );
    this.aiService.setMCPServerManager(this.mcpServerManager);
    this.workspaceService = new WorkspaceService(
      config,
      this.historyService,
      this.partialService,
      this.aiService,
      this.initStateManager,
      this.extensionMetadata,
      this.backgroundProcessManager,
      this.sessionUsageService
    );
    this.workspaceService.setMCPServerManager(this.mcpServerManager);
    this.channelSessionRouter = new ChannelSessionRouter(config, this.workspaceService, this.projectService);
    this.channelService = new ChannelService(config, this.workspaceService, this.channelSessionRouter);
    this.taskService = new TaskService(
      config,
      this.historyService,
      this.partialService,
      this.aiService,
      this.workspaceService,
      this.initStateManager
    );
    this.aiService.setTaskService(this.taskService);
    // Idle compaction service - auto-compacts workspaces after configured idle period
    this.idleCompactionService = new IdleCompactionService(
      config,
      this.historyService,
      this.extensionMetadata,
      (workspaceId) => this.workspaceService.emitIdleCompactionNeeded(workspaceId)
    );
    this.windowService = new WindowService();
    this.providerService = new ProviderService(config);
    // Terminal services - PTYService is cross-platform
    this.ptyService = new PTYService();
    this.terminalService = new TerminalService(config, this.ptyService);
    // Wire terminal service to workspace service for cleanup on removal
    this.workspaceService.setTerminalService(this.terminalService);
    // Editor service for opening workspaces in code editors
    this.editorService = new EditorService(config);
    this.updateService = new UpdateService();
    this.tokenizerService = new TokenizerService(this.sessionUsageService);
    this.serverService = new ServerService();
    this.menuEventService = new MenuEventService();
    this.voiceService = new VoiceService(config);
    this.telemetryService = new TelemetryService(config.rootDir);
    this.aiService.setTelemetryService(this.telemetryService);
    this.workspaceService.setTelemetryService(this.telemetryService);
    this.experimentsService = new ExperimentsService({
      telemetryService: this.telemetryService,
      unixHome: config.rootDir,
    });
    this.featureFlagService = new FeatureFlagService(config, this.telemetryService);
    this.sessionTimingService = new SessionTimingService(config, this.telemetryService);
    this.workspaceService.setSessionTimingService(this.sessionTimingService);
    this.signingService = getSigningService();
    this.latticeService = latticeService;
    // Register globally so all createRuntime calls can create LatticeSSHRuntime
    setGlobalLatticeService(this.latticeService);

    // Local on-device inference (Lattice Inference)
    this.inferenceService = new InferenceService(config.rootDir);
    this.aiService.setInferenceService(this.inferenceService);

    // Backend timing stats (behind feature flag).
    this.aiService.on("stream-start", (data: StreamStartEvent) =>
      this.sessionTimingService.handleStreamStart(data)
    );
    this.aiService.on("stream-delta", (data: StreamDeltaEvent) =>
      this.sessionTimingService.handleStreamDelta(data)
    );
    this.aiService.on("reasoning-delta", (data: ReasoningDeltaEvent) =>
      this.sessionTimingService.handleReasoningDelta(data)
    );
    this.aiService.on("tool-call-start", (data: ToolCallStartEvent) =>
      this.sessionTimingService.handleToolCallStart(data)
    );
    this.aiService.on("tool-call-delta", (data: ToolCallDeltaEvent) =>
      this.sessionTimingService.handleToolCallDelta(data)
    );
    this.aiService.on("tool-call-end", (data: ToolCallEndEvent) =>
      this.sessionTimingService.handleToolCallEnd(data)
    );
    this.aiService.on("stream-end", (data: StreamEndEvent) =>
      this.sessionTimingService.handleStreamEnd(data)
    );
    this.aiService.on("stream-abort", (data: StreamAbortEvent) =>
      this.sessionTimingService.handleStreamAbort(data)
    );
    this.workspaceService.setExperimentsService(this.experimentsService);
  }

  async initialize(): Promise<void> {
    await this.extensionMetadata.initialize();
    // Initialize telemetry service
    await this.telemetryService.initialize();

    // Initialize feature flag state (don't block startup on network).
    this.featureFlagService
      .getStatsTabState()
      .then((state) => this.sessionTimingService.setStatsTabState(state))
      .catch(() => {
        // Ignore feature flag failures.
      });
    await this.experimentsService.initialize();
    await this.taskService.initialize();
    // Start idle compaction checker
    this.idleCompactionService.start();

    // Initialize channel service (load saved configs, auto-connect enabled channels)
    void this.channelService.initialize().catch((err) => {
      log.warn("[ServiceContainer] Channel service init failed (non-fatal)", { error: err });
    });

    // Refresh Lattice SSH config in background (handles binary path changes on restart)
    // Skip getLatticeInfo() to avoid caching "unavailable" if coder isn't installed yet
    void this.latticeService.ensureSSHConfig().catch(() => {
      // Ignore errors - coder may not be installed
    });

    // Initialize local inference (Python detection, backend availability)
    void this.inferenceService.initialize().catch((err) => {
      log.warn("[ServiceContainer] Inference service init failed (non-fatal)", { error: err });
    });

    // Ensure the built-in Chat with Lattice system workspace exists.
    // Defensive: startup-time initialization must never crash the app.
    try {
      await this.ensureUnixChatWorkspace();
    } catch (error) {
      log.warn("[ServiceContainer] Failed to ensure Chat with Lattice workspace", { error });
    }
  }

  private async ensureUnixChatWorkspace(): Promise<void> {
    const projectPath = getUnixHelpChatProjectPath(this.config.rootDir);

    // Ensure the directory exists (LocalRuntime uses project dir directly).
    await fsPromises.mkdir(projectPath, { recursive: true });

    await this.config.editConfig((config) => {
      let projectConfig = config.projects.get(projectPath);
      if (!projectConfig) {
        projectConfig = { workspaces: [] };
        config.projects.set(projectPath, projectConfig);
      }

      const existing = projectConfig.workspaces.find((w) => w.id === UNIX_HELP_CHAT_WORKSPACE_ID);
      if (!existing) {
        projectConfig.workspaces.push({
          path: projectPath,
          id: UNIX_HELP_CHAT_WORKSPACE_ID,
          name: UNIX_HELP_CHAT_WORKSPACE_NAME,
          title: UNIX_HELP_CHAT_WORKSPACE_TITLE,
          agentId: UNIX_HELP_CHAT_AGENT_ID,
          createdAt: new Date().toISOString(),
          runtimeConfig: { type: "local" },
        });
        return config;
      }

      // Self-heal: enforce invariants for the system workspace.
      existing.path = projectPath;
      existing.name = UNIX_HELP_CHAT_WORKSPACE_NAME;
      existing.title = UNIX_HELP_CHAT_WORKSPACE_TITLE;
      existing.agentId = UNIX_HELP_CHAT_AGENT_ID;
      existing.createdAt ??= new Date().toISOString();
      existing.runtimeConfig = { type: "local" };
      existing.archivedAt = undefined;

      return config;
    });

    await this.ensureUnixChatWelcomeMessage();
  }

  private async ensureUnixChatWelcomeMessage(): Promise<void> {
    const historyResult = await this.historyService.getHistory(UNIX_HELP_CHAT_WORKSPACE_ID);
    if (!historyResult.success) {
      log.warn("[ServiceContainer] Failed to read unix-chat history for welcome message", {
        error: historyResult.error,
      });
      return;
    }

    if (historyResult.data.length > 0) {
      return;
    }

    const message = createUnixMessage(
      UNIX_HELP_CHAT_WELCOME_MESSAGE_ID,
      "assistant",
      UNIX_HELP_CHAT_WELCOME_MESSAGE,
      // Note: This message should be visible in the UI, so it must NOT be marked synthetic.
      { timestamp: Date.now() }
    );

    const appendResult = await this.historyService.appendToHistory(
      UNIX_HELP_CHAT_WORKSPACE_ID,
      message
    );
    if (!appendResult.success) {
      log.warn("[ServiceContainer] Failed to seed unix-chat welcome message", {
        error: appendResult.error,
      });
    }
  }

  /**
   * Shutdown services that need cleanup
   */
  async shutdown(): Promise<void> {
    this.idleCompactionService.stop();
    await this.channelService.shutdown();
    await this.inferenceService.dispose();
    await this.telemetryService.shutdown();
  }

  setProjectDirectoryPicker(picker: () => Promise<string | null>): void {
    this.projectService.setDirectoryPicker(picker);
  }

  setTerminalWindowManager(manager: TerminalWindowManager): void {
    this.terminalService.setTerminalWindowManager(manager);
  }

  /**
   * Dispose all services. Called on app quit to clean up resources.
   * Terminates all background processes to prevent orphans.
   */
  async dispose(): Promise<void> {
    this.mcpServerManager.dispose();
    await this.inferenceService.dispose();
    await this.backgroundProcessManager.terminateAll();
  }
}
