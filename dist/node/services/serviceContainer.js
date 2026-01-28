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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceContainer = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fsPromises = __importStar(require("fs/promises"));
const unixChat_1 = require("../../common/constants/unixChat");
const unixChat_2 = require("../../node/constants/unixChat");
const message_1 = require("../../common/types/message");
const log_1 = require("../../node/services/log");
const aiService_1 = require("../../node/services/aiService");
const historyService_1 = require("../../node/services/historyService");
const partialService_1 = require("../../node/services/partialService");
const initStateManager_1 = require("../../node/services/initStateManager");
const ptyService_1 = require("../../node/services/ptyService");
const projectService_1 = require("../../node/services/projectService");
const workspaceService_1 = require("../../node/services/workspaceService");
const providerService_1 = require("../../node/services/providerService");
const ExtensionMetadataService_1 = require("../../node/services/ExtensionMetadataService");
const terminalService_1 = require("../../node/services/terminalService");
const editorService_1 = require("../../node/services/editorService");
const windowService_1 = require("../../node/services/windowService");
const updateService_1 = require("../../node/services/updateService");
const tokenizerService_1 = require("../../node/services/tokenizerService");
const serverService_1 = require("../../node/services/serverService");
const menuEventService_1 = require("../../node/services/menuEventService");
const voiceService_1 = require("../../node/services/voiceService");
const telemetryService_1 = require("../../node/services/telemetryService");
const featureFlagService_1 = require("../../node/services/featureFlagService");
const sessionTimingService_1 = require("../../node/services/sessionTimingService");
const experimentsService_1 = require("../../node/services/experimentsService");
const backgroundProcessManager_1 = require("../../node/services/backgroundProcessManager");
const mcpConfigService_1 = require("../../node/services/mcpConfigService");
const workspaceMcpOverridesService_1 = require("../../node/services/workspaceMcpOverridesService");
const mcpServerManager_1 = require("../../node/services/mcpServerManager");
const sessionUsageService_1 = require("../../node/services/sessionUsageService");
const idleCompactionService_1 = require("../../node/services/idleCompactionService");
const taskService_1 = require("../../node/services/taskService");
const signingService_1 = require("../../node/services/signingService");
const latticeService_1 = require("../../node/services/latticeService");
const runtimeFactory_1 = require("../../node/runtime/runtimeFactory");
const UNIX_HELP_CHAT_WELCOME_MESSAGE_ID = "unix-chat-welcome";
const UNIX_HELP_CHAT_WELCOME_MESSAGE = `Hi, I'm Unix.

This is your built-in **Chat with Unix** workspace — a safe place to ask questions about Unix itself.

I can help you:
- Configure global agent behavior by editing **~/.unix/AGENTS.md** (I'll show a diff and ask before writing).
- Pick models/providers and explain Unix modes + tool policies.
- Troubleshoot common setup issues (keys, runtimes, workspaces, etc.).

Try asking:
- "What does AGENTS.md do?"
- "Help me write global instructions for code reviews"
- "How do I set up an OpenAI / Anthropic key in Unix?"
`;
/**
 * ServiceContainer - Central dependency container for all backend services.
 *
 * This class instantiates and wires together all services needed by the ORPC router.
 * Services are accessed via the ORPC context object.
 */
class ServiceContainer {
    config;
    historyService;
    partialService;
    aiService;
    projectService;
    workspaceService;
    taskService;
    providerService;
    terminalService;
    editorService;
    windowService;
    updateService;
    tokenizerService;
    serverService;
    menuEventService;
    voiceService;
    mcpConfigService;
    workspaceMcpOverridesService;
    mcpServerManager;
    telemetryService;
    featureFlagService;
    sessionTimingService;
    experimentsService;
    sessionUsageService;
    signingService;
    latticeService;
    initStateManager;
    extensionMetadata;
    ptyService;
    backgroundProcessManager;
    idleCompactionService;
    constructor(config) {
        this.config = config;
        this.historyService = new historyService_1.HistoryService(config);
        this.partialService = new partialService_1.PartialService(config, this.historyService);
        this.projectService = new projectService_1.ProjectService(config);
        this.initStateManager = new initStateManager_1.InitStateManager(config);
        this.workspaceMcpOverridesService = new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        this.mcpConfigService = new mcpConfigService_1.MCPConfigService();
        this.extensionMetadata = new ExtensionMetadataService_1.ExtensionMetadataService(path.join(config.rootDir, "extensionMetadata.json"));
        this.backgroundProcessManager = new backgroundProcessManager_1.BackgroundProcessManager(path.join(os.tmpdir(), "unix-bashes"));
        this.mcpServerManager = new mcpServerManager_1.MCPServerManager(this.mcpConfigService);
        this.sessionUsageService = new sessionUsageService_1.SessionUsageService(config, this.historyService);
        this.aiService = new aiService_1.AIService(config, this.historyService, this.partialService, this.initStateManager, this.backgroundProcessManager, this.sessionUsageService, this.workspaceMcpOverridesService);
        this.aiService.setMCPServerManager(this.mcpServerManager);
        this.workspaceService = new workspaceService_1.WorkspaceService(config, this.historyService, this.partialService, this.aiService, this.initStateManager, this.extensionMetadata, this.backgroundProcessManager, this.sessionUsageService);
        this.workspaceService.setMCPServerManager(this.mcpServerManager);
        this.taskService = new taskService_1.TaskService(config, this.historyService, this.partialService, this.aiService, this.workspaceService, this.initStateManager);
        this.aiService.setTaskService(this.taskService);
        // Idle compaction service - auto-compacts workspaces after configured idle period
        this.idleCompactionService = new idleCompactionService_1.IdleCompactionService(config, this.historyService, this.extensionMetadata, (workspaceId) => this.workspaceService.emitIdleCompactionNeeded(workspaceId));
        this.windowService = new windowService_1.WindowService();
        this.providerService = new providerService_1.ProviderService(config);
        // Terminal services - PTYService is cross-platform
        this.ptyService = new ptyService_1.PTYService();
        this.terminalService = new terminalService_1.TerminalService(config, this.ptyService);
        // Wire terminal service to workspace service for cleanup on removal
        this.workspaceService.setTerminalService(this.terminalService);
        // Editor service for opening workspaces in code editors
        this.editorService = new editorService_1.EditorService(config);
        this.updateService = new updateService_1.UpdateService();
        this.tokenizerService = new tokenizerService_1.TokenizerService(this.sessionUsageService);
        this.serverService = new serverService_1.ServerService();
        this.menuEventService = new menuEventService_1.MenuEventService();
        this.voiceService = new voiceService_1.VoiceService(config);
        this.telemetryService = new telemetryService_1.TelemetryService(config.rootDir);
        this.aiService.setTelemetryService(this.telemetryService);
        this.workspaceService.setTelemetryService(this.telemetryService);
        this.experimentsService = new experimentsService_1.ExperimentsService({
            telemetryService: this.telemetryService,
            unixHome: config.rootDir,
        });
        this.featureFlagService = new featureFlagService_1.FeatureFlagService(config, this.telemetryService);
        this.sessionTimingService = new sessionTimingService_1.SessionTimingService(config, this.telemetryService);
        this.workspaceService.setSessionTimingService(this.sessionTimingService);
        this.signingService = (0, signingService_1.getSigningService)();
        this.latticeService = latticeService_1.latticeService;
        // Register globally so all createRuntime calls can create LatticeSSHRuntime
        (0, runtimeFactory_1.setGlobalLatticeService)(this.latticeService);
        // Backend timing stats (behind feature flag).
        this.aiService.on("stream-start", (data) => this.sessionTimingService.handleStreamStart(data));
        this.aiService.on("stream-delta", (data) => this.sessionTimingService.handleStreamDelta(data));
        this.aiService.on("reasoning-delta", (data) => this.sessionTimingService.handleReasoningDelta(data));
        this.aiService.on("tool-call-start", (data) => this.sessionTimingService.handleToolCallStart(data));
        this.aiService.on("tool-call-delta", (data) => this.sessionTimingService.handleToolCallDelta(data));
        this.aiService.on("tool-call-end", (data) => this.sessionTimingService.handleToolCallEnd(data));
        this.aiService.on("stream-end", (data) => this.sessionTimingService.handleStreamEnd(data));
        this.aiService.on("stream-abort", (data) => this.sessionTimingService.handleStreamAbort(data));
        this.workspaceService.setExperimentsService(this.experimentsService);
    }
    async initialize() {
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
        // Refresh Lattice SSH config in background (handles binary path changes on restart)
        // Skip getLatticeInfo() to avoid caching "unavailable" if coder isn't installed yet
        void this.latticeService.ensureSSHConfig().catch(() => {
            // Ignore errors - coder may not be installed
        });
        // Ensure the built-in Chat with Unix system workspace exists.
        // Defensive: startup-time initialization must never crash the app.
        try {
            await this.ensureUnixChatWorkspace();
        }
        catch (error) {
            log_1.log.warn("[ServiceContainer] Failed to ensure Chat with Unix workspace", { error });
        }
    }
    async ensureUnixChatWorkspace() {
        const projectPath = (0, unixChat_2.getUnixHelpChatProjectPath)(this.config.rootDir);
        // Ensure the directory exists (LocalRuntime uses project dir directly).
        await fsPromises.mkdir(projectPath, { recursive: true });
        await this.config.editConfig((config) => {
            let projectConfig = config.projects.get(projectPath);
            if (!projectConfig) {
                projectConfig = { workspaces: [] };
                config.projects.set(projectPath, projectConfig);
            }
            const existing = projectConfig.workspaces.find((w) => w.id === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID);
            if (!existing) {
                projectConfig.workspaces.push({
                    path: projectPath,
                    id: unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID,
                    name: unixChat_1.UNIX_HELP_CHAT_WORKSPACE_NAME,
                    title: unixChat_1.UNIX_HELP_CHAT_WORKSPACE_TITLE,
                    agentId: unixChat_1.UNIX_HELP_CHAT_AGENT_ID,
                    createdAt: new Date().toISOString(),
                    runtimeConfig: { type: "local" },
                });
                return config;
            }
            // Self-heal: enforce invariants for the system workspace.
            existing.path = projectPath;
            existing.name = unixChat_1.UNIX_HELP_CHAT_WORKSPACE_NAME;
            existing.title = unixChat_1.UNIX_HELP_CHAT_WORKSPACE_TITLE;
            existing.agentId = unixChat_1.UNIX_HELP_CHAT_AGENT_ID;
            existing.createdAt ?? (existing.createdAt = new Date().toISOString());
            existing.runtimeConfig = { type: "local" };
            existing.archivedAt = undefined;
            return config;
        });
        await this.ensureUnixChatWelcomeMessage();
    }
    async ensureUnixChatWelcomeMessage() {
        const historyResult = await this.historyService.getHistory(unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID);
        if (!historyResult.success) {
            log_1.log.warn("[ServiceContainer] Failed to read unix-chat history for welcome message", {
                error: historyResult.error,
            });
            return;
        }
        if (historyResult.data.length > 0) {
            return;
        }
        const message = (0, message_1.createUnixMessage)(UNIX_HELP_CHAT_WELCOME_MESSAGE_ID, "assistant", UNIX_HELP_CHAT_WELCOME_MESSAGE, 
        // Note: This message should be visible in the UI, so it must NOT be marked synthetic.
        { timestamp: Date.now() });
        const appendResult = await this.historyService.appendToHistory(unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID, message);
        if (!appendResult.success) {
            log_1.log.warn("[ServiceContainer] Failed to seed unix-chat welcome message", {
                error: appendResult.error,
            });
        }
    }
    /**
     * Shutdown services that need cleanup
     */
    async shutdown() {
        this.idleCompactionService.stop();
        await this.telemetryService.shutdown();
    }
    setProjectDirectoryPicker(picker) {
        this.projectService.setDirectoryPicker(picker);
    }
    setTerminalWindowManager(manager) {
        this.terminalService.setTerminalWindowManager(manager);
    }
    /**
     * Dispose all services. Called on app quit to clean up resources.
     * Terminates all background processes to prevent orphans.
     */
    async dispose() {
        this.mcpServerManager.dispose();
        await this.backgroundProcessManager.terminateAll();
    }
}
exports.ServiceContainer = ServiceContainer;
//# sourceMappingURL=serviceContainer.js.map