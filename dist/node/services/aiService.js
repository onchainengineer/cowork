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
exports.AIService = exports.ANTHROPIC_1M_CONTEXT_HEADER = void 0;
exports.normalizeAnthropicBaseURL = normalizeAnthropicBaseURL;
exports.buildAnthropicHeaders = buildAnthropicHeaders;
exports.buildAppAttributionHeaders = buildAppAttributionHeaders;
exports.preloadAISDKProviders = preloadAISDKProviders;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const assert_1 = __importDefault(require("../../common/utils/assert"));
const events_1 = require("events");
const credential_providers_1 = require("@aws-sdk/credential-providers");
const ai_1 = require("ai");
const applyToolOutputRedaction_1 = require("../../browser/utils/messages/applyToolOutputRedaction");
const sanitizeToolInput_1 = require("../../browser/utils/messages/sanitizeToolInput");
const bashOutputFiltering_1 = require("../../node/services/system1/bashOutputFiltering");
const bashCompactionPolicy_1 = require("../../node/services/system1/bashCompactionPolicy");
const system1AgentRunner_1 = require("../../node/services/system1/system1AgentRunner");
const bashTaskReport_1 = require("../../node/services/tools/bashTaskReport");
const abort_1 = require("../../node/utils/abort");
const inlineSvgAsTextForProvider_1 = require("../../node/utils/messages/inlineSvgAsTextForProvider");
const extractToolMediaAsUserMessages_1 = require("../../node/utils/messages/extractToolMediaAsUserMessages");
const sanitizeAnthropicDocumentFilename_1 = require("../../node/utils/messages/sanitizeAnthropicDocumentFilename");
const result_1 = require("../../common/types/result");
const schemas_1 = require("../../common/orpc/schemas");
const providers_1 = require("../../common/constants/providers");
const message_1 = require("../../common/types/message");
const streamManager_1 = require("./streamManager");
const tools_1 = require("../../common/utils/tools/tools");
const runtimeFactory_1 = require("../../node/runtime/runtimeFactory");
const initHook_1 = require("../../node/runtime/initHook");
const unixChat_1 = require("../../common/constants/unixChat");
const secrets_1 = require("../../common/types/secrets");
const log_1 = require("./log");
const fileAtMentions_1 = require("./fileAtMentions");
const modelMessageTransform_1 = require("../../browser/utils/messages/modelMessageTransform");
const models_1 = require("../../common/utils/ai/models");
const cacheStrategy_1 = require("../../common/utils/ai/cacheStrategy");
const sendMessageError_1 = require("./utils/sendMessageError");
const messageIds_1 = require("./utils/messageIds");
const usageAggregator_1 = require("../../common/utils/tokens/usageAggregator");
const systemMessage_1 = require("./systemMessage");
const tokenizer_1 = require("../../node/utils/main/tokenizer");
const utils_1 = require("../../common/telemetry/utils");
const workspaceMcpOverridesService_1 = require("./workspaceMcpOverridesService");
const providerOptions_1 = require("../../common/utils/ai/providerOptions");
const policy_1 = require("../../common/utils/thinking/policy");
const providerRequirements_1 = require("../../node/utils/providerRequirements");
const tasks_1 = require("../../common/types/tasks");
const toolPolicy_1 = require("../../common/utils/tools/toolPolicy");
const mockAiStreamPlayer_1 = require("./mock/mockAiStreamPlayer");
const undici_1 = require("undici");
const startHerePlanSummary_1 = require("../../common/utils/messages/startHerePlanSummary");
const planStorage_1 = require("../../common/utils/planStorage");
const modeUtils_1 = require("../../common/utils/ui/modeUtils");
const appAttribution_1 = require("../../constants/appAttribution");
const helpers_1 = require("../../node/utils/runtime/helpers");
const agentDefinitionsService_1 = require("../../node/services/agentDefinitions/agentDefinitionsService");
const resolveToolPolicy_1 = require("../../node/services/agentDefinitions/resolveToolPolicy");
const agentTools_1 = require("../../common/utils/agentTools");
const resolveAgentInheritanceChain_1 = require("../../node/services/agentDefinitions/resolveAgentInheritanceChain");
// Export a standalone version of getToolsForModel for use in backend
// Create undici agent with unlimited timeouts for AI streaming requests.
// Safe because users control cancellation via AbortSignal from the UI.
// Uses EnvHttpProxyAgent to automatically respect HTTP_PROXY, HTTPS_PROXY,
// and NO_PROXY environment variables for debugging/corporate network support.
const unlimitedTimeoutAgent = new undici_1.EnvHttpProxyAgent({
    bodyTimeout: 0, // No timeout - prevents BodyTimeoutError on long reasoning pauses
    headersTimeout: 0, // No timeout for headers
});
/**
 * Default fetch function with unlimited timeouts for AI streaming.
 * Uses undici Agent to remove artificial timeout limits while still
 * respecting user cancellation via AbortSignal.
 *
 * Note: If users provide custom fetch in providers.jsonc, they are
 * responsible for configuring timeouts appropriately. Custom fetch
 * implementations using undici should set bodyTimeout: 0 and
 * headersTimeout: 0 to prevent BodyTimeoutError on long-running
 * reasoning models.
 */
const defaultFetchWithUnlimitedTimeout = (async (input, init) => {
    // dispatcher is a Node.js undici-specific property for custom HTTP agents
    const requestInit = {
        ...(init ?? {}),
        dispatcher: unlimitedTimeoutAgent,
    };
    return fetch(input, requestInit);
});
const globalFetchWithExtras = fetch;
const defaultFetchWithExtras = defaultFetchWithUnlimitedTimeout;
let ptcModules = null;
async function getPTCModules() {
    if (ptcModules)
        return ptcModules;
    /* eslint-disable no-restricted-syntax -- Dynamic imports required here to avoid loading
       ~10MB of typescript/prettier/quickjs at startup (causes CI failures) */
    const [codeExecution, quickjs, toolBridge] = await Promise.all([
        Promise.resolve().then(() => __importStar(require("../../node/services/tools/code_execution"))),
        Promise.resolve().then(() => __importStar(require("../../node/services/ptc/quickjsRuntime"))),
        Promise.resolve().then(() => __importStar(require("../../node/services/ptc/toolBridge"))),
    ]);
    /* eslint-enable no-restricted-syntax */
    ptcModules = {
        createCodeExecutionTool: codeExecution.createCodeExecutionTool,
        QuickJSRuntimeFactory: quickjs.QuickJSRuntimeFactory,
        ToolBridge: toolBridge.ToolBridge,
        runtimeFactory: null,
    };
    return ptcModules;
}
if (typeof globalFetchWithExtras.preconnect === "function") {
    defaultFetchWithExtras.preconnect = globalFetchWithExtras.preconnect.bind(globalFetchWithExtras);
}
if (typeof globalFetchWithExtras.certificate === "function") {
    defaultFetchWithExtras.certificate =
        globalFetchWithExtras.certificate.bind(globalFetchWithExtras);
}
/**
 * Wrap fetch to inject Anthropic cache_control directly into the request body.
 * The AI SDK's providerOptions.anthropic.cacheControl doesn't get translated
 * to raw cache_control for tools or message content parts, so we inject it
 * at the HTTP level.
 *
 * Injects cache_control on:
 * 1. Last tool (caches all tool definitions)
 * 2. Last message's last content part (caches entire conversation)
 */
function wrapFetchWithAnthropicCacheControl(baseFetch) {
    const cachingFetch = async (input, init) => {
        // Only modify POST requests with JSON body
        if (init?.method?.toUpperCase() !== "POST" || typeof init?.body !== "string") {
            return baseFetch(input, init);
        }
        try {
            const json = JSON.parse(init.body);
            // Inject cache_control on the last tool if tools array exists
            if (Array.isArray(json.tools) && json.tools.length > 0) {
                const lastTool = json.tools[json.tools.length - 1];
                lastTool.cache_control ?? (lastTool.cache_control = { type: "ephemeral" });
            }
            // Inject cache_control on last message's last content part
            // This caches the entire conversation
            // Handle both formats:
            // - Direct Anthropic provider: json.messages (Anthropic API format)
            // - Gateway provider: json.prompt (AI SDK internal format)
            const messages = Array.isArray(json.messages)
                ? json.messages
                : Array.isArray(json.prompt)
                    ? json.prompt
                    : null;
            if (messages && messages.length >= 1) {
                const lastMsg = messages[messages.length - 1];
                // For gateway: add providerOptions.anthropic.cacheControl at message level
                // (gateway validates schema strictly, doesn't allow raw cache_control on messages)
                if (Array.isArray(json.prompt)) {
                    const providerOpts = (lastMsg.providerOptions ?? {});
                    const anthropicOpts = (providerOpts.anthropic ?? {});
                    anthropicOpts.cacheControl ?? (anthropicOpts.cacheControl = { type: "ephemeral" });
                    providerOpts.anthropic = anthropicOpts;
                    lastMsg.providerOptions = providerOpts;
                }
                // For direct Anthropic: add cache_control to last content part
                const content = lastMsg.content;
                if (Array.isArray(content) && content.length > 0) {
                    const lastPart = content[content.length - 1];
                    lastPart.cache_control ?? (lastPart.cache_control = { type: "ephemeral" });
                }
            }
            // Update body with modified JSON
            const newBody = JSON.stringify(json);
            const headers = new Headers(init?.headers);
            headers.delete("content-length"); // Body size changed
            return baseFetch(input, { ...init, headers, body: newBody });
        }
        catch {
            // If parsing fails, pass through unchanged
            return baseFetch(input, init);
        }
    };
    return Object.assign(cachingFetch, baseFetch);
}
/**
 * Get fetch function for provider - use custom if provided, otherwise unlimited timeout default
 */
function getProviderFetch(providerConfig) {
    return typeof providerConfig.fetch === "function"
        ? providerConfig.fetch
        : defaultFetchWithUnlimitedTimeout;
}
/**
 * Normalize Anthropic base URL to ensure it ends with /v1 suffix.
 *
 * The Anthropic SDK expects baseURL to include /v1 (default: https://api.anthropic.com/v1).
 * Many users configure base URLs without the /v1 suffix, which causes API calls to fail.
 * This function automatically appends /v1 if missing.
 *
 * @param baseURL - The base URL to normalize (may or may not have /v1)
 * @returns The base URL with /v1 suffix
 */
function normalizeAnthropicBaseURL(baseURL) {
    const trimmed = baseURL.replace(/\/+$/, ""); // Remove trailing slashes
    if (trimmed.endsWith("/v1")) {
        return trimmed;
    }
    return `${trimmed}/v1`;
}
/** Header value for Anthropic 1M context beta */
exports.ANTHROPIC_1M_CONTEXT_HEADER = "context-1m-2025-08-07";
/**
 * Build headers for Anthropic provider, optionally including the 1M context beta header.
 * Exported for testing.
 */
function buildAnthropicHeaders(existingHeaders, use1MContext) {
    if (!use1MContext) {
        return existingHeaders;
    }
    if (existingHeaders) {
        return { ...existingHeaders, "anthropic-beta": exports.ANTHROPIC_1M_CONTEXT_HEADER };
    }
    return { "anthropic-beta": exports.ANTHROPIC_1M_CONTEXT_HEADER };
}
/**
 * Build app attribution headers used by OpenRouter (and other compatible platforms).
 *
 * Attribution docs:
 * - OpenRouter: https://openrouter.ai/docs/app-attribution
 * - Vercel AI Gateway: https://vercel.com/docs/ai-gateway/app-attribution
 *
 * Exported for testing.
 */
function buildAppAttributionHeaders(existingHeaders) {
    // Clone to avoid mutating caller-provided objects.
    const headers = existingHeaders ? { ...existingHeaders } : {};
    // Header names are case-insensitive. Preserve user-provided values by never overwriting.
    const existingLowercaseKeys = new Set(Object.keys(headers).map((key) => key.toLowerCase()));
    if (!existingLowercaseKeys.has("http-referer")) {
        headers["HTTP-Referer"] = appAttribution_1.UNIX_APP_ATTRIBUTION_URL;
    }
    if (!existingLowercaseKeys.has("x-title")) {
        headers["X-Title"] = appAttribution_1.UNIX_APP_ATTRIBUTION_TITLE;
    }
    return headers;
}
/**
 * Preload AI SDK provider modules to avoid race conditions in concurrent test environments.
 * This function loads @ai-sdk/anthropic, @ai-sdk/openai, and ollama-ai-provider-v2 eagerly
 * so that subsequent dynamic imports in createModel() hit the module cache instead of racing.
 *
 * In production, providers are lazy-loaded on first use to optimize startup time.
 * In tests, we preload them once during setup to ensure reliable concurrent execution.
 */
async function preloadAISDKProviders() {
    // Preload providers to ensure they're in the module cache before concurrent tests run
    await Promise.all(Object.values(providers_1.PROVIDER_REGISTRY).map((importFn) => importFn()));
}
/**
 * Parse provider and model ID from model string.
 * Handles model IDs with colons (e.g., "ollama:gpt-oss:20b").
 * Only splits on the first colon to support Ollama model naming convention.
 *
 * @param modelString - Model string in format "provider:model-id"
 * @returns Tuple of [providerName, modelId]
 * @example
 * parseModelString("anthropic:claude-opus-4") // ["anthropic", "claude-opus-4"]
 * parseModelString("ollama:gpt-oss:20b") // ["ollama", "gpt-oss:20b"]
 */
function parseModelString(modelString) {
    const colonIndex = modelString.indexOf(":");
    const providerName = colonIndex !== -1 ? modelString.slice(0, colonIndex) : modelString;
    const modelId = colonIndex !== -1 ? modelString.slice(colonIndex + 1) : "";
    return [providerName, modelId];
}
function getTaskDepthFromConfig(config, workspaceId) {
    const parentById = new Map();
    for (const project of config.projects.values()) {
        for (const workspace of project.workspaces) {
            if (!workspace.id)
                continue;
            parentById.set(workspace.id, workspace.parentWorkspaceId);
        }
    }
    let depth = 0;
    let current = workspaceId;
    for (let i = 0; i < 32; i++) {
        const parent = parentById.get(current);
        if (!parent)
            break;
        depth += 1;
        current = parent;
    }
    if (depth >= 32) {
        throw new Error(`getTaskDepthFromConfig: possible parentWorkspaceId cycle starting at ${workspaceId}`);
    }
    return depth;
}
function cloneToolPreservingDescriptors(tool) {
    (0, assert_1.default)(tool && typeof tool === "object", "tool must be an object");
    // Clone without invoking getters.
    const prototype = Object.getPrototypeOf(tool);
    (0, assert_1.default)(prototype === null || typeof prototype === "object", "tool prototype must be an object or null");
    const clone = Object.create(prototype);
    Object.defineProperties(clone, Object.getOwnPropertyDescriptors(tool));
    return clone;
}
function appendToolNote(existing, extra) {
    if (!existing) {
        return extra;
    }
    return `${existing}\n\n${extra}`;
}
class AIService extends events_1.EventEmitter {
    streamManager;
    historyService;
    partialService;
    config;
    workspaceMcpOverridesService;
    mcpServerManager;
    telemetryService;
    initStateManager;
    mockModeEnabled;
    mockAiStreamPlayer;
    backgroundProcessManager;
    sessionUsageService;
    // Tracks in-flight stream startup (before StreamManager emits stream-start).
    // This enables user interrupts (Esc/Ctrl+C) during the UI "starting..." phase.
    pendingStreamStarts = new Map();
    // Debug: captured LLM request payloads for last send per workspace
    lastLlmRequestByWorkspace = new Map();
    taskService;
    extraTools;
    constructor(config, historyService, partialService, initStateManager, backgroundProcessManager, sessionUsageService, workspaceMcpOverridesService) {
        super();
        // Increase max listeners to accommodate multiple concurrent workspace listeners
        // Each workspace subscribes to stream events, and we expect >10 concurrent workspaces
        this.setMaxListeners(50);
        this.workspaceMcpOverridesService =
            workspaceMcpOverridesService ?? new workspaceMcpOverridesService_1.WorkspaceMcpOverridesService(config);
        this.config = config;
        this.historyService = historyService;
        this.partialService = partialService;
        this.initStateManager = initStateManager;
        this.backgroundProcessManager = backgroundProcessManager;
        this.sessionUsageService = sessionUsageService;
        this.streamManager = new streamManager_1.StreamManager(historyService, partialService, sessionUsageService);
        void this.ensureSessionsDir();
        this.setupStreamEventForwarding();
        this.mockModeEnabled = false;
        if (process.env.UNIX_MOCK_AI === "1") {
            log_1.log.info("AIService running in UNIX_MOCK_AI mode");
            this.enableMockMode();
        }
    }
    setTelemetryService(service) {
        this.telemetryService = service;
    }
    setMCPServerManager(manager) {
        this.mcpServerManager = manager;
        this.streamManager.setMCPServerManager(manager);
    }
    setTaskService(taskService) {
        this.taskService = taskService;
    }
    /**
     * Set extra tools to include in every tool call.
     * Used by CLI to inject tools like set_exit_code without modifying core tool definitions.
     */
    setExtraTools(tools) {
        this.extraTools = tools;
    }
    /**
     * Forward all stream events from StreamManager to AIService consumers
     */
    setupStreamEventForwarding() {
        this.streamManager.on("stream-start", (data) => this.emit("stream-start", data));
        this.streamManager.on("stream-delta", (data) => this.emit("stream-delta", data));
        this.streamManager.on("stream-end", (data) => {
            // Best-effort capture of the provider response for the "Last LLM request" debug modal.
            // Must never break live streaming.
            try {
                const snapshot = this.lastLlmRequestByWorkspace.get(data.workspaceId);
                if (snapshot) {
                    // If messageId is missing (legacy fixtures), attach anyway.
                    const shouldAttach = snapshot.messageId === data.messageId || snapshot.messageId == null;
                    if (shouldAttach) {
                        const updated = {
                            ...snapshot,
                            response: {
                                capturedAt: Date.now(),
                                metadata: data.metadata,
                                parts: data.parts,
                            },
                        };
                        const cloned = typeof structuredClone === "function"
                            ? structuredClone(updated)
                            : JSON.parse(JSON.stringify(updated));
                        this.lastLlmRequestByWorkspace.set(data.workspaceId, cloned);
                    }
                }
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                log_1.log.warn("Failed to capture debug LLM response snapshot", { error: errMsg });
            }
            this.emit("stream-end", data);
        });
        // Handle stream-abort: dispose of partial based on abandonPartial flag
        this.streamManager.on("stream-abort", (data) => {
            void (async () => {
                if (data.abandonPartial) {
                    // Caller requested discarding partial - delete without committing
                    await this.partialService.deletePartial(data.workspaceId);
                }
                else {
                    // Commit interrupted message to history with partial:true metadata
                    // This ensures /clear and /truncate can clean up interrupted messages
                    const partial = await this.partialService.readPartial(data.workspaceId);
                    if (partial) {
                        await this.partialService.commitToHistory(data.workspaceId);
                        await this.partialService.deletePartial(data.workspaceId);
                    }
                }
                // Forward abort event to consumers
                this.emit("stream-abort", data);
            })();
        });
        this.streamManager.on("error", (data) => this.emit("error", data));
        // Forward tool events
        this.streamManager.on("tool-call-start", (data) => this.emit("tool-call-start", data));
        this.streamManager.on("tool-call-delta", (data) => this.emit("tool-call-delta", data));
        this.streamManager.on("tool-call-end", (data) => this.emit("tool-call-end", data));
        // Forward reasoning events
        this.streamManager.on("reasoning-delta", (data) => this.emit("reasoning-delta", data));
        this.streamManager.on("reasoning-end", (data) => this.emit("reasoning-end", data));
        this.streamManager.on("usage-delta", (data) => this.emit("usage-delta", data));
    }
    async ensureSessionsDir() {
        try {
            await fs.mkdir(this.config.sessionsDir, { recursive: true });
        }
        catch (error) {
            log_1.log.error("Failed to create sessions directory:", error);
        }
    }
    isMockModeEnabled() {
        return this.mockModeEnabled;
    }
    releaseMockStreamStartGate(workspaceId) {
        this.mockAiStreamPlayer?.releaseStreamStartGate(workspaceId);
    }
    enableMockMode() {
        this.mockModeEnabled = true;
        this.mockAiStreamPlayer ?? (this.mockAiStreamPlayer = new mockAiStreamPlayer_1.MockAiStreamPlayer({
            aiService: this,
            historyService: this.historyService,
        }));
    }
    async getWorkspaceMetadata(workspaceId) {
        try {
            // Read from config.json (single source of truth)
            // getAllWorkspaceMetadata() handles migration from legacy metadata.json files
            const allMetadata = await this.config.getAllWorkspaceMetadata();
            const metadata = allMetadata.find((m) => m.id === workspaceId);
            if (!metadata) {
                return (0, result_1.Err)(`Workspace metadata not found for ${workspaceId}. Workspace may not be properly initialized.`);
            }
            return (0, result_1.Ok)(metadata);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to read workspace metadata: ${message}`);
        }
    }
    /**
     * Split assistant messages that have text after tool calls with results.
  
    /**
     * Create an AI SDK model from a model string (e.g., "anthropic:claude-opus-4-1")
     *
     * IMPORTANT: We ONLY use providers.jsonc as the single source of truth for provider configuration.
     * We DO NOT use environment variables or default constructors that might read them.
     * This ensures consistent, predictable configuration management.
     *
     * Provider configuration from providers.jsonc is passed verbatim to the provider
     * constructor, ensuring automatic parity with Vercel AI SDK - any configuration options
     * supported by the provider will work without modification.
     */
    async createModel(modelString, muxProviderOptions) {
        try {
            // Parse model string (format: "provider:model-id")
            // Parse provider and model ID from model string
            const [providerName, modelId] = parseModelString(modelString);
            if (!providerName || !modelId) {
                return (0, result_1.Err)({
                    type: "invalid_model_string",
                    message: `Invalid model string format: "${modelString}". Expected "provider:model-id"`,
                });
            }
            // Check if provider is supported (prevents silent failures when adding to PROVIDER_REGISTRY
            // but forgetting to implement handler below)
            if (!(providerName in providers_1.PROVIDER_REGISTRY)) {
                return (0, result_1.Err)({
                    type: "provider_not_supported",
                    provider: providerName,
                });
            }
            // Load providers configuration - the ONLY source of truth
            const providersConfig = this.config.loadProvidersConfig();
            let providerConfig = providersConfig?.[providerName] ?? {};
            // Map baseUrl to baseURL if present (SDK expects baseURL)
            const { baseUrl, ...configWithoutBaseUrl } = providerConfig;
            providerConfig = baseUrl
                ? { ...configWithoutBaseUrl, baseURL: baseUrl }
                : configWithoutBaseUrl;
            // Inject app attribution headers (used by OpenRouter and other compatible platforms).
            // We never overwrite user-provided values (case-insensitive header matching).
            providerConfig = {
                ...providerConfig,
                headers: buildAppAttributionHeaders(providerConfig.headers),
            };
            // Handle Anthropic provider
            if (providerName === "anthropic") {
                // Resolve credentials from config + env (single source of truth)
                const creds = (0, providerRequirements_1.resolveProviderCredentials)("anthropic", providerConfig);
                if (!creds.isConfigured) {
                    return (0, result_1.Err)({ type: "api_key_not_found", provider: providerName });
                }
                // Build config with resolved credentials
                const configWithApiKey = creds.apiKey
                    ? { ...providerConfig, apiKey: creds.apiKey }
                    : providerConfig;
                // Normalize base URL to ensure /v1 suffix (SDK expects it)
                const effectiveBaseURL = configWithApiKey.baseURL ?? creds.baseUrl?.trim();
                const normalizedConfig = effectiveBaseURL
                    ? { ...configWithApiKey, baseURL: normalizeAnthropicBaseURL(effectiveBaseURL) }
                    : configWithApiKey;
                // Add 1M context beta header if requested
                const headers = buildAnthropicHeaders(normalizedConfig.headers, muxProviderOptions?.anthropic?.use1MContext);
                // Lazy-load Anthropic provider to reduce startup time
                const { createAnthropic } = await providers_1.PROVIDER_REGISTRY.anthropic();
                // Wrap fetch to inject cache_control on tools and messages
                // (SDK doesn't translate providerOptions to cache_control for these)
                // Use getProviderFetch to preserve any user-configured custom fetch (e.g., proxies)
                const baseFetch = getProviderFetch(providerConfig);
                const fetchWithCacheControl = wrapFetchWithAnthropicCacheControl(baseFetch);
                const provider = createAnthropic({
                    ...normalizedConfig,
                    headers,
                    fetch: fetchWithCacheControl,
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            // Handle OpenAI provider (using Responses API)
            if (providerName === "openai") {
                // Resolve credentials from config + env (single source of truth)
                const creds = (0, providerRequirements_1.resolveProviderCredentials)("openai", providerConfig);
                if (!creds.isConfigured) {
                    return (0, result_1.Err)({ type: "api_key_not_found", provider: providerName });
                }
                // Merge resolved credentials into config
                const configWithCreds = {
                    ...providerConfig,
                    apiKey: creds.apiKey,
                    ...(creds.baseUrl && !providerConfig.baseURL && { baseURL: creds.baseUrl }),
                    ...(creds.organization && { organization: creds.organization }),
                };
                // Extract serviceTier from config to pass through to buildProviderOptions
                const configServiceTier = providerConfig.serviceTier;
                if (configServiceTier && muxProviderOptions) {
                    muxProviderOptions.openai = {
                        ...muxProviderOptions.openai,
                        serviceTier: configServiceTier,
                    };
                }
                const baseFetch = getProviderFetch(providerConfig);
                // Wrap fetch to default truncation to "disabled" for OpenAI Responses API calls.
                // This preserves our compaction handling while still allowing explicit truncation (e.g., auto).
                const fetchWithOpenAITruncation = Object.assign(async (input, init) => {
                    try {
                        const urlString = (() => {
                            if (typeof input === "string") {
                                return input;
                            }
                            if (input instanceof URL) {
                                return input.toString();
                            }
                            if (typeof input === "object" && input !== null && "url" in input) {
                                const possibleUrl = input.url;
                                if (typeof possibleUrl === "string") {
                                    return possibleUrl;
                                }
                            }
                            return "";
                        })();
                        const method = (init?.method ?? "GET").toUpperCase();
                        const isOpenAIResponses = /\/v1\/responses(\?|$)/.test(urlString);
                        const body = init?.body;
                        if (isOpenAIResponses && method === "POST" && typeof body === "string") {
                            // Clone headers to avoid mutating caller-provided objects
                            const headers = new Headers(init?.headers);
                            // Remove content-length if present, since body will change
                            headers.delete("content-length");
                            try {
                                const json = JSON.parse(body);
                                const truncation = json.truncation;
                                if (truncation !== "auto" && truncation !== "disabled") {
                                    json.truncation = "disabled";
                                }
                                const newBody = JSON.stringify(json);
                                const newInit = { ...init, headers, body: newBody };
                                return baseFetch(input, newInit);
                            }
                            catch {
                                // If body isn't JSON, fall through to normal fetch
                                return baseFetch(input, init);
                            }
                        }
                        // Default passthrough
                        return baseFetch(input, init);
                    }
                    catch {
                        // On any unexpected error, fall back to original fetch
                        return baseFetch(input, init);
                    }
                }, "preconnect" in baseFetch && typeof baseFetch.preconnect === "function"
                    ? {
                        preconnect: baseFetch.preconnect.bind(baseFetch),
                    }
                    : {});
                // Lazy-load OpenAI provider to reduce startup time
                const { createOpenAI } = await providers_1.PROVIDER_REGISTRY.openai();
                const provider = createOpenAI({
                    ...configWithCreds,
                    // Cast is safe: our fetch implementation is compatible with the SDK's fetch type.
                    // The preconnect method is optional in our implementation but required by the SDK type.
                    fetch: fetchWithOpenAITruncation,
                });
                // Use Responses API for persistence and built-in tools
                // OpenAI manages reasoning state via previousResponseId - no middleware needed
                const model = provider.responses(modelId);
                return (0, result_1.Ok)(model);
            }
            // Handle xAI provider
            if (providerName === "xai") {
                // Resolve credentials from config + env (single source of truth)
                const creds = (0, providerRequirements_1.resolveProviderCredentials)("xai", providerConfig);
                if (!creds.isConfigured) {
                    return (0, result_1.Err)({ type: "api_key_not_found", provider: providerName });
                }
                const baseFetch = getProviderFetch(providerConfig);
                const { apiKey: _apiKey, baseURL, headers, ...extraOptions } = providerConfig;
                const { searchParameters, ...restOptions } = extraOptions;
                if (searchParameters && muxProviderOptions) {
                    const existingXaiOverrides = muxProviderOptions.xai ?? {};
                    muxProviderOptions.xai = {
                        ...existingXaiOverrides,
                        searchParameters: existingXaiOverrides.searchParameters ??
                            searchParameters,
                    };
                }
                const { createXai } = await providers_1.PROVIDER_REGISTRY.xai();
                const provider = createXai({
                    apiKey: creds.apiKey,
                    baseURL: creds.baseUrl ?? baseURL,
                    headers,
                    ...restOptions,
                    fetch: baseFetch,
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            // Handle Ollama provider
            if (providerName === "ollama") {
                // Ollama doesn't require API key - it's a local service
                const baseFetch = getProviderFetch(providerConfig);
                // Lazy-load Ollama provider to reduce startup time
                const { createOllama } = await providers_1.PROVIDER_REGISTRY.ollama();
                const provider = createOllama({
                    ...providerConfig,
                    fetch: baseFetch,
                    // Use strict mode for better compatibility with Ollama API
                    compatibility: "strict",
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            // Handle OpenRouter provider
            if (providerName === "openrouter") {
                // Resolve credentials from config + env (single source of truth)
                const creds = (0, providerRequirements_1.resolveProviderCredentials)("openrouter", providerConfig);
                if (!creds.isConfigured) {
                    return (0, result_1.Err)({ type: "api_key_not_found", provider: providerName });
                }
                const baseFetch = getProviderFetch(providerConfig);
                // Extract standard provider settings (apiKey, baseUrl, headers, fetch)
                const { apiKey: _apiKey, baseUrl, headers, fetch: _fetch, ...extraOptions } = providerConfig;
                // OpenRouter routing options that need to be nested under "provider" in API request
                // See: https://openrouter.ai/docs/features/provider-routing
                const OPENROUTER_ROUTING_OPTIONS = [
                    "order",
                    "allow_fallbacks",
                    "only",
                    "ignore",
                    "require_parameters",
                    "data_collection",
                    "sort",
                    "quantizations",
                ];
                // Build extraBody: routing options go under "provider", others stay at root
                const routingOptions = {};
                const otherOptions = {};
                for (const [key, value] of Object.entries(extraOptions)) {
                    if (OPENROUTER_ROUTING_OPTIONS.includes(key)) {
                        routingOptions[key] = value;
                    }
                    else {
                        otherOptions[key] = value;
                    }
                }
                // Build extraBody with provider nesting if routing options exist
                let extraBody;
                if (Object.keys(routingOptions).length > 0) {
                    extraBody = { provider: routingOptions, ...otherOptions };
                }
                else if (Object.keys(otherOptions).length > 0) {
                    extraBody = otherOptions;
                }
                // Lazy-load OpenRouter provider to reduce startup time
                const { createOpenRouter } = await providers_1.PROVIDER_REGISTRY.openrouter();
                const provider = createOpenRouter({
                    apiKey: creds.apiKey,
                    baseURL: creds.baseUrl ?? baseUrl,
                    headers,
                    fetch: baseFetch,
                    extraBody,
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            // Handle Amazon Bedrock provider
            if (providerName === "bedrock") {
                // Resolve region from config + env (single source of truth)
                const creds = (0, providerRequirements_1.resolveProviderCredentials)("bedrock", providerConfig);
                if (!creds.isConfigured || !creds.region) {
                    return (0, result_1.Err)({ type: "api_key_not_found", provider: providerName });
                }
                const { region } = creds;
                const baseFetch = getProviderFetch(providerConfig);
                const { createAmazonBedrock } = await providers_1.PROVIDER_REGISTRY.bedrock();
                // Check if explicit credentials are provided in config
                const hasExplicitCredentials = providerConfig.accessKeyId && providerConfig.secretAccessKey;
                if (hasExplicitCredentials) {
                    // Use explicit credentials from providers.jsonc
                    const provider = createAmazonBedrock({
                        ...providerConfig,
                        region,
                        fetch: baseFetch,
                    });
                    return (0, result_1.Ok)(provider(modelId));
                }
                // Check for Bedrock bearer token (simplest auth) - from config or environment
                // The SDK's apiKey option maps to AWS_BEARER_TOKEN_BEDROCK
                const bearerToken = typeof providerConfig.bearerToken === "string" ? providerConfig.bearerToken : undefined;
                if (bearerToken) {
                    const provider = createAmazonBedrock({
                        region,
                        apiKey: bearerToken,
                        fetch: baseFetch,
                    });
                    return (0, result_1.Ok)(provider(modelId));
                }
                // Check if AWS_BEARER_TOKEN_BEDROCK env var is set
                if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
                    // SDK automatically picks this up via apiKey option
                    const provider = createAmazonBedrock({
                        region,
                        fetch: baseFetch,
                    });
                    return (0, result_1.Ok)(provider(modelId));
                }
                // Use AWS credential provider chain for flexible authentication:
                // - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
                // - Shared credentials file (~/.aws/credentials)
                // - EC2 instance profiles
                // - ECS task roles
                // - EKS service account (IRSA)
                // - SSO credentials
                // - And more...
                const provider = createAmazonBedrock({
                    region,
                    credentialProvider: (0, credential_providers_1.fromNodeProviderChain)(),
                    fetch: baseFetch,
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            // Handle GitHub Copilot provider (via VS Code LM Proxy)
            // Routes through a local OpenAI-compatible proxy that bridges to VS Code's
            // Language Model API, allowing use of Copilot models in airgapped environments.
            if (providerName === "github-copilot") {
                const { createOpenAI } = await providers_1.PROVIDER_REGISTRY["github-copilot"]();
                const proxyPort = providerConfig.proxyPort ?? 3941;
                const baseURL = providerConfig.baseURL ?? `http://127.0.0.1:${proxyPort}/v1`;
                const provider = createOpenAI({
                    apiKey: "copilot-lm-proxy", // Dummy key — proxy doesn't require auth
                    baseURL,
                    fetch: getProviderFetch(providerConfig),
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            // Handle GitHub Copilot Direct API (for non-airgapped environments)
            // Uses the ai-sdk-provider-github package which reads CLI credentials from
            // ~/.config/github-copilot/apps.json and auto-refreshes tokens.
            if (providerName === "github-copilot-direct") {
                const { createCopilot } = await providers_1.PROVIDER_REGISTRY["github-copilot-direct"]();
                const config = providerConfig;
                const copilotOptions = {};
                // Optional: provide OAuth token directly if user has one
                if (typeof config.oauthToken === "string" && config.oauthToken) {
                    copilotOptions.oauthToken = config.oauthToken;
                }
                // Optional: GitHub Enterprise support
                if (typeof config.enterpriseUrl === "string" && config.enterpriseUrl) {
                    copilotOptions.enterpriseUrl = config.enterpriseUrl;
                }
                const provider = createCopilot(copilotOptions);
                return (0, result_1.Ok)(provider(modelId));
            }
            // Generic handler for simple providers (standard API key + factory pattern)
            // Providers with custom logic (anthropic, openai, xai, ollama, openrouter, bedrock, github-copilot, github-copilot-direct)
            // are handled explicitly above. New providers using the standard pattern need only be
            // added to PROVIDER_DEFINITIONS - no code changes required here.
            const providerDef = providers_1.PROVIDER_DEFINITIONS[providerName];
            if (providerDef) {
                // Resolve credentials from config + env (single source of truth)
                const creds = (0, providerRequirements_1.resolveProviderCredentials)(providerName, providerConfig);
                if (providerDef.requiresApiKey && !creds.isConfigured) {
                    return (0, result_1.Err)({ type: "api_key_not_found", provider: providerName });
                }
                // Lazy-load and create provider using factoryName from definition
                const providerModule = (await providerDef.import());
                const factory = providerModule[providerDef.factoryName];
                if (!factory) {
                    return (0, result_1.Err)({
                        type: "provider_not_supported",
                        provider: providerName,
                    });
                }
                // Merge resolved credentials into config
                const configWithCreds = {
                    ...providerConfig,
                    ...(creds.apiKey && { apiKey: creds.apiKey }),
                    ...(creds.baseUrl && !providerConfig.baseURL && { baseURL: creds.baseUrl }),
                };
                const provider = factory({
                    ...configWithCreds,
                    fetch: getProviderFetch(providerConfig),
                });
                return (0, result_1.Ok)(provider(modelId));
            }
            return (0, result_1.Err)({
                type: "provider_not_supported",
                provider: providerName,
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)({ type: "unknown", raw: `Failed to create model: ${errorMessage}` });
        }
    }
    /**
     * Stream a message conversation to the AI model
     * @param messages Array of conversation messages
     * @param workspaceId Unique identifier for the workspace
     * @param modelString Model string (e.g., "anthropic:claude-opus-4-1") - required from frontend
     * @param thinkingLevel Optional thinking/reasoning level for AI models
     * @param toolPolicy Optional policy to filter available tools
     * @param abortSignal Optional signal to abort the stream
     * @param additionalSystemInstructions Optional additional system instructions to append
     * @param maxOutputTokens Optional maximum tokens for model output
     * @param muxProviderOptions Optional provider-specific options
     * @param agentId Optional agent id - determines tool policy and plan-file behavior
     * @param recordFileState Optional callback to record file state for external edit detection
     * @param changedFileAttachments Optional attachments for files that were edited externally
     * @param postCompactionAttachments Optional attachments to inject after compaction
     * @param disableWorkspaceAgents When true, read agent definitions from project path instead of workspace worktree
     * @param openaiTruncationModeOverride Optional OpenAI truncation override (e.g., compaction retry)
     * @returns Promise that resolves when streaming completes or fails
     */
    async streamMessage(messages, workspaceId, modelString, thinkingLevel, toolPolicy, abortSignal, additionalSystemInstructions, maxOutputTokens, muxProviderOptions, agentId, recordFileState, changedFileAttachments, postCompactionAttachments, experiments, system1Model, system1ThinkingLevel, disableWorkspaceAgents, hasQueuedMessage, openaiTruncationModeOverride) {
        // Support interrupts during startup (before StreamManager emits stream-start).
        // We register an AbortController up-front and let stopStream() abort it.
        const pendingAbortController = new AbortController();
        const startTime = Date.now();
        const syntheticMessageId = `starting-${startTime}-${Math.random().toString(36).substring(2, 11)}`;
        // Link external abort signal (if provided).
        const unlinkAbortSignal = (0, abort_1.linkAbortSignal)(abortSignal, pendingAbortController);
        this.pendingStreamStarts.set(workspaceId, {
            abortController: pendingAbortController,
            startTime,
            syntheticMessageId,
        });
        const combinedAbortSignal = pendingAbortController.signal;
        try {
            if (this.mockModeEnabled && this.mockAiStreamPlayer) {
                await this.initStateManager.waitForInit(workspaceId, combinedAbortSignal);
                if (combinedAbortSignal.aborted) {
                    return (0, result_1.Ok)(undefined);
                }
                return await this.mockAiStreamPlayer.play(messages, workspaceId, {
                    model: modelString,
                    abortSignal: combinedAbortSignal,
                });
            }
            // DEBUG: Log streamMessage call
            const lastMessage = messages[messages.length - 1];
            log_1.log.debug(`[STREAM MESSAGE] workspaceId=${workspaceId} messageCount=${messages.length} lastRole=${lastMessage?.role}`);
            // Before starting a new stream, commit any existing partial to history
            // This is idempotent - won't double-commit if already in chat.jsonl
            await this.partialService.commitToHistory(workspaceId);
            // Mode (plan|exec|compact) is derived from the selected agent definition.
            const effectiveUnixProviderOptions = muxProviderOptions ?? {};
            const effectiveThinkingLevel = thinkingLevel ?? "off";
            // For xAI models, swap between reasoning and non-reasoning variants based on thinking level
            // Similar to how OpenAI handles reasoning vs non-reasoning models
            let effectiveModelString = modelString;
            const [providerName] = parseModelString(modelString);
            const normalizedModelString = (0, models_1.normalizeGatewayModel)(modelString);
            const [normalizedProviderName, normalizedModelId] = parseModelString(normalizedModelString);
            const isUnixGatewayModel = providerName === "unix-gateway";
            if (normalizedProviderName === "xai" && normalizedModelId === "grok-4-1-fast") {
                // xAI Grok only supports full reasoning (no medium/low)
                // Map to appropriate variant based on thinking level
                const variant = effectiveThinkingLevel !== "off"
                    ? "grok-4-1-fast-reasoning"
                    : "grok-4-1-fast-non-reasoning";
                effectiveModelString = isUnixGatewayModel ? `unix-gateway:xai/${variant}` : `xai:${variant}`;
                log_1.log.debug("Mapping xAI Grok model to variant", {
                    original: modelString,
                    effective: effectiveModelString,
                    thinkingLevel: effectiveThinkingLevel,
                });
            }
            // Create model instance with early API key validation
            const modelResult = await this.createModel(effectiveModelString, effectiveUnixProviderOptions);
            if (!modelResult.success) {
                return (0, result_1.Err)(modelResult.error);
            }
            // Dump original messages for debugging
            log_1.log.debug_obj(`${workspaceId}/1_original_messages.json`, messages);
            // Normalize provider for provider-specific handling (Unix Gateway models should behave
            // like their underlying provider for message transforms and compliance checks).
            const providerForMessages = normalizedProviderName;
            // Tool names are needed for the mode transition sentinel injection.
            // Compute them once we know the effective agent + tool policy.
            let toolNamesForSentinel = [];
            // Filter out assistant messages with only reasoning (no text/tools)
            // EXCEPTION: When extended thinking is enabled, preserve reasoning-only messages
            // to comply with Extended Thinking API requirements
            const preserveReasoningOnly = providerForMessages === "anthropic" && effectiveThinkingLevel !== "off";
            const filteredMessages = (0, modelMessageTransform_1.filterEmptyAssistantMessages)(messages, preserveReasoningOnly);
            log_1.log.debug(`Filtered ${messages.length - filteredMessages.length} empty assistant messages`);
            log_1.log.debug_obj(`${workspaceId}/1a_filtered_messages.json`, filteredMessages);
            // OpenAI-specific: Keep reasoning parts in history
            // OpenAI manages conversation state via previousResponseId
            if (providerForMessages === "openai") {
                log_1.log.debug("Keeping reasoning parts for OpenAI (managed via previousResponseId)");
            }
            // Add [CONTINUE] sentinel to partial messages (for model context)
            const messagesWithSentinel = (0, modelMessageTransform_1.addInterruptedSentinel)(filteredMessages);
            // Note: Further message processing (mode transition, file changes, etc.) happens
            // after runtime is created below, as we need runtime to read the plan file
            // Get workspace metadata to retrieve workspace path
            const metadataResult = await this.getWorkspaceMetadata(workspaceId);
            if (!metadataResult.success) {
                return (0, result_1.Err)({ type: "unknown", raw: metadataResult.error });
            }
            const metadata = metadataResult.data;
            const workspaceLog = log_1.log.withFields({ workspaceId, workspaceName: metadata.name });
            // Get actual workspace path from config (handles both legacy and new format)
            const workspace = this.config.findWorkspace(workspaceId);
            if (!workspace) {
                return (0, result_1.Err)({ type: "unknown", raw: `Workspace ${workspaceId} not found in config` });
            }
            // Get workspace path - handle both worktree and in-place modes
            const runtime = (0, runtimeFactory_1.createRuntime)(metadata.runtimeConfig, {
                projectPath: metadata.projectPath,
                workspaceName: metadata.name,
            });
            // In-place workspaces (CLI/benchmarks) have projectPath === name
            // Use path directly instead of reconstructing via getWorkspacePath
            const isInPlace = metadata.projectPath === metadata.name;
            const workspacePath = isInPlace
                ? metadata.projectPath
                : runtime.getWorkspacePath(metadata.projectPath, metadata.name);
            // Wait for init to complete before any runtime I/O operations
            // (SSH/devcontainer may not be ready until init finishes pulling the container)
            await this.initStateManager.waitForInit(workspaceId, combinedAbortSignal);
            if (combinedAbortSignal.aborted) {
                return (0, result_1.Ok)(undefined);
            }
            // Verify runtime is actually reachable after init completes.
            // For Docker workspaces, this checks the container exists and starts it if stopped.
            // For Lattice workspaces, this may start a stopped workspace and wait for it.
            // If init failed during container creation, ensureReady() will return an error.
            const readyResult = await runtime.ensureReady({
                signal: combinedAbortSignal,
                statusSink: (status) => {
                    // Emit runtime-status events for frontend UX (StreamingBarrier)
                    this.emit("runtime-status", {
                        type: "runtime-status",
                        workspaceId,
                        phase: status.phase,
                        runtimeType: status.runtimeType,
                        detail: status.detail,
                    });
                },
            });
            if (!readyResult.ready) {
                // Generate message ID for the error event (frontend needs this for synthetic message)
                const errorMessageId = (0, messageIds_1.createAssistantMessageId)();
                const runtimeType = metadata.runtimeConfig?.type ?? "local";
                const runtimeLabel = runtimeType === "docker" ? "Container" : "Runtime";
                const errorMessage = readyResult.error || `${runtimeLabel} unavailable.`;
                // Use the errorType from ensureReady result (runtime_not_ready vs runtime_start_failed)
                const errorType = readyResult.errorType;
                // Emit error event so frontend receives it via stream subscription.
                // This mirrors the context_exceeded pattern - the fire-and-forget sendMessage
                // call in useCreationWorkspace.ts won't see the returned Err, but will receive
                // this event through the workspace chat subscription.
                this.emit("error", (0, sendMessageError_1.createErrorEvent)(workspaceId, {
                    messageId: errorMessageId,
                    error: errorMessage,
                    errorType,
                }));
                return (0, result_1.Err)({
                    type: errorType,
                    message: errorMessage,
                });
            }
            // Resolve the active agent definition.
            //
            // Precedence:
            // - Child workspaces (tasks) use their persisted agentId/agentType.
            // - Main workspaces use the requested agentId (frontend), falling back to exec.
            const requestedAgentIdRaw = workspaceId === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID
                ? unixChat_1.UNIX_HELP_CHAT_AGENT_ID
                : ((metadata.parentWorkspaceId ? (metadata.agentId ?? metadata.agentType) : undefined) ??
                    (typeof agentId === "string" ? agentId : undefined) ??
                    "exec");
            const requestedAgentIdNormalized = requestedAgentIdRaw.trim().toLowerCase();
            const parsedAgentId = schemas_1.AgentIdSchema.safeParse(requestedAgentIdNormalized);
            const effectiveAgentId = parsedAgentId.success ? parsedAgentId.data : "exec";
            // When disableWorkspaceAgents is true, skip workspace-specific agents entirely.
            // Use project path so only built-in/global agents are available. This allows "unbricking"
            // when iterating on agent files - a broken agent in the worktree won't affect message sending.
            const agentDiscoveryPath = disableWorkspaceAgents ? metadata.projectPath : workspacePath;
            let agentDefinition;
            try {
                agentDefinition = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, agentDiscoveryPath, effectiveAgentId);
            }
            catch (error) {
                workspaceLog.warn("Failed to load agent definition; falling back to exec", {
                    effectiveAgentId,
                    agentDiscoveryPath,
                    disableWorkspaceAgents,
                    error: error instanceof Error ? error.message : String(error),
                });
                agentDefinition = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, agentDiscoveryPath, "exec");
            }
            // Determine if agent is plan-like by checking if propose_plan is in its resolved tools
            // (including inherited tools from base agents).
            const agentsForInheritance = await (0, resolveAgentInheritanceChain_1.resolveAgentInheritanceChain)({
                runtime,
                workspacePath: agentDiscoveryPath,
                agentId: effectiveAgentId,
                agentDefinition,
                workspaceId,
            });
            const agentIsPlanLike = (0, agentTools_1.isPlanLikeInResolvedChain)(agentsForInheritance);
            const effectiveMode = effectiveAgentId === "compact" ? "compact" : agentIsPlanLike ? "plan" : "exec";
            const cfg = this.config.loadConfigOrDefault();
            const taskSettings = cfg.taskSettings ?? tasks_1.DEFAULT_TASK_SETTINGS;
            const taskDepth = getTaskDepthFromConfig(cfg, workspaceId);
            const shouldDisableTaskToolsForDepth = taskDepth >= taskSettings.maxTaskNestingDepth;
            const isSubagentWorkspace = Boolean(metadata.parentWorkspaceId);
            // NOTE: Caller-supplied policy is applied AFTER agent tool policy so callers can
            // further restrict the tool set (e.g., disable all tools for testing).
            // Agent policy establishes baseline (deny-all + enable whitelist + runtime restrictions).
            // Caller policy then narrows further if needed.
            const agentToolPolicy = (0, resolveToolPolicy_1.resolveToolPolicyForAgent)({
                agents: agentsForInheritance,
                isSubagent: isSubagentWorkspace,
                disableTaskToolsForDepth: shouldDisableTaskToolsForDepth,
            });
            // The Chat with Unix system workspace must remain sandboxed regardless of caller-supplied
            // toolPolicy (defense-in-depth).
            const systemWorkspaceToolPolicy = workspaceId === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID
                ? [
                    { regex_match: ".*", action: "disable" },
                    // Allow docs lookup via built-in skills (e.g. unix-docs), while keeping
                    // filesystem/binary execution locked down.
                    { regex_match: "agent_skill_read", action: "enable" },
                    { regex_match: "agent_skill_read_file", action: "enable" },
                    { regex_match: "unix_global_agents_read", action: "enable" },
                    { regex_match: "unix_global_agents_write", action: "enable" },
                    { regex_match: "ask_user_question", action: "enable" },
                    { regex_match: "todo_read", action: "enable" },
                    { regex_match: "todo_write", action: "enable" },
                    { regex_match: "status_set", action: "enable" },
                    { regex_match: "notify", action: "enable" },
                ]
                : undefined;
            const effectiveToolPolicy = toolPolicy || agentToolPolicy.length > 0 || systemWorkspaceToolPolicy
                ? [...agentToolPolicy, ...(toolPolicy ?? []), ...(systemWorkspaceToolPolicy ?? [])]
                : undefined;
            // Compute tool names for agent transition sentinel.
            const earlyRuntime = (0, runtimeFactory_1.createRuntime)({ type: "local", srcBaseDir: process.cwd() });
            const earlyAllTools = await (0, tools_1.getToolsForModel)(modelString, {
                cwd: process.cwd(),
                runtime: earlyRuntime,
                runtimeTempDir: os.tmpdir(),
                secrets: {},
                planFileOnly: agentIsPlanLike,
            }, "", // Empty workspace ID for early stub config
            this.initStateManager, undefined, undefined);
            const earlyTools = (0, toolPolicy_1.applyToolPolicy)(earlyAllTools, effectiveToolPolicy);
            toolNamesForSentinel = Object.keys(earlyTools);
            // Fetch workspace MCP overrides (for filtering servers and tools)
            // NOTE: Stored in <workspace>/.unix/mcp.local.jsonc (not ~/.unix/config.json).
            let mcpOverrides;
            try {
                mcpOverrides =
                    await this.workspaceMcpOverridesService.getOverridesForWorkspace(workspaceId);
            }
            catch (error) {
                log_1.log.warn("[MCP] Failed to load workspace MCP overrides; continuing without overrides", {
                    workspaceId,
                    error,
                });
                mcpOverrides = undefined;
            }
            // Fetch MCP server config for system prompt (before building message)
            // Pass overrides to filter out disabled servers
            const mcpServers = this.mcpServerManager && workspaceId !== unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID
                ? await this.mcpServerManager.listServers(metadata.projectPath, mcpOverrides)
                : undefined;
            // Construct plan mode instruction if in plan mode
            // This is done backend-side because we have access to the plan file path
            let effectiveAdditionalInstructions = additionalSystemInstructions;
            const unixHome = runtime.getUnixHome();
            const planFilePath = (0, planStorage_1.getPlanFilePath)(metadata.name, metadata.projectName, unixHome);
            // Read plan file (handles legacy migration transparently)
            const planResult = await (0, helpers_1.readPlanFile)(runtime, metadata.name, metadata.projectName, workspaceId);
            const chatHasStartHerePlanSummary = (0, startHerePlanSummary_1.hasStartHerePlanSummary)(filteredMessages);
            if (effectiveMode === "plan") {
                const planModeInstruction = (0, modeUtils_1.getPlanModeInstruction)(planFilePath, planResult.exists);
                effectiveAdditionalInstructions = additionalSystemInstructions
                    ? `${planModeInstruction}\n\n${additionalSystemInstructions}`
                    : planModeInstruction;
            }
            else if (planResult.exists && planResult.content.trim()) {
                // Users often use "Replace all chat history" after plan mode. In exec (or other non-plan)
                // modes, the model can lose the plan file location because plan path injection only
                // happens in plan mode.
                //
                // Exception: the ProposePlanToolCall "Start Here" flow already stores the full plan
                // (and plan path) directly in chat history. In that case, prompting the model to
                // re-open the plan file is redundant and often results in an extra "read …KB" step.
                if (!chatHasStartHerePlanSummary) {
                    const planFileHint = (0, modeUtils_1.getPlanFileHint)(planFilePath, planResult.exists);
                    if (planFileHint) {
                        effectiveAdditionalInstructions = effectiveAdditionalInstructions
                            ? `${planFileHint}\n\n${effectiveAdditionalInstructions}`
                            : planFileHint;
                    }
                }
                else {
                    workspaceLog.debug("Skipping plan file hint: Start Here already includes the plan in chat history.");
                }
            }
            if (shouldDisableTaskToolsForDepth) {
                const nestingInstruction = `Task delegation is disabled in this workspace (taskDepth=${taskDepth}, ` +
                    `maxTaskNestingDepth=${taskSettings.maxTaskNestingDepth}). Do not call task/task_await/task_list/task_terminate.`;
                effectiveAdditionalInstructions = effectiveAdditionalInstructions
                    ? `${effectiveAdditionalInstructions}\n\n${nestingInstruction}`
                    : nestingInstruction;
            }
            // Read plan content for agent transition (plan-like → exec-like)
            // Only read if switching to exec-like agent and last assistant was plan-like.
            let planContentForTransition;
            if (effectiveMode === "exec" && !chatHasStartHerePlanSummary) {
                const lastAssistantMessage = [...filteredMessages]
                    .reverse()
                    .find((m) => m.role === "assistant");
                const lastAgentId = lastAssistantMessage?.metadata?.agentId;
                if (lastAgentId && planResult.content.trim()) {
                    let lastAgentIsPlanLike = false;
                    if (lastAgentId === effectiveAgentId) {
                        lastAgentIsPlanLike = agentIsPlanLike;
                    }
                    else {
                        try {
                            const lastDefinition = await (0, agentDefinitionsService_1.readAgentDefinition)(runtime, agentDiscoveryPath, lastAgentId);
                            const lastChain = await (0, resolveAgentInheritanceChain_1.resolveAgentInheritanceChain)({
                                runtime,
                                workspacePath: agentDiscoveryPath,
                                agentId: lastAgentId,
                                agentDefinition: lastDefinition,
                                workspaceId,
                            });
                            lastAgentIsPlanLike = (0, agentTools_1.isPlanLikeInResolvedChain)(lastChain);
                        }
                        catch (error) {
                            workspaceLog.warn("Failed to resolve last agent definition for plan handoff", {
                                lastAgentId,
                                error: error instanceof Error ? error.message : String(error),
                            });
                        }
                    }
                    if (lastAgentIsPlanLike) {
                        planContentForTransition = planResult.content;
                    }
                }
            }
            else if (effectiveMode === "exec" && chatHasStartHerePlanSummary) {
                workspaceLog.debug("Skipping plan content injection for plan→exec transition: Start Here already includes the plan in chat history.");
            }
            // Now inject agent transition context with plan content (runtime is now available)
            const messagesWithAgentContext = (0, modelMessageTransform_1.injectAgentTransition)(messagesWithSentinel, effectiveAgentId, toolNamesForSentinel, planContentForTransition, planContentForTransition ? planFilePath : undefined);
            // Inject file change notifications as user messages (preserves system message cache)
            const messagesWithFileChanges = (0, modelMessageTransform_1.injectFileChangeNotifications)(messagesWithAgentContext, changedFileAttachments);
            // Inject post-compaction attachments (plan file, edited files) after compaction summary
            const messagesWithPostCompaction = (0, modelMessageTransform_1.injectPostCompactionAttachments)(messagesWithFileChanges, postCompactionAttachments);
            // Expand @file mentions (e.g. @src/foo.ts#L1-20) into an in-memory synthetic user message.
            // This keeps chat history clean while giving the model immediate file context.
            const messagesWithFileAtMentions = await (0, fileAtMentions_1.injectFileAtMentions)(messagesWithPostCompaction, {
                runtime,
                workspacePath,
                abortSignal: combinedAbortSignal,
            });
            // Apply centralized tool-output redaction BEFORE converting to provider ModelMessages
            // This keeps the persisted/UI history intact while trimming heavy fields for the request
            const redactedForProvider = (0, applyToolOutputRedaction_1.applyToolOutputRedaction)(messagesWithFileAtMentions);
            log_1.log.debug_obj(`${workspaceId}/2a_redacted_messages.json`, redactedForProvider);
            // Sanitize tool inputs to ensure they are valid objects (not strings or arrays)
            // This fixes cases where corrupted data in history has malformed tool inputs
            // that would cause API errors like "Input should be a valid dictionary"
            const sanitizedMessages = (0, sanitizeToolInput_1.sanitizeToolInputs)(redactedForProvider);
            log_1.log.debug_obj(`${workspaceId}/2b_sanitized_messages.json`, sanitizedMessages);
            // Inline SVG user attachments as text (providers generally don't accept image/svg+xml as an image input).
            // This is request-only (does not mutate persisted history).
            const messagesWithInlinedSvg = (0, inlineSvgAsTextForProvider_1.inlineSvgAsTextForProvider)(sanitizedMessages);
            // Sanitize PDF filenames for Anthropic (request-only, preserves original in UI/history).
            // Anthropic rejects document names containing periods, underscores, etc.
            const messagesWithSanitizedPdf = providerForMessages === "anthropic"
                ? (0, sanitizeAnthropicDocumentFilename_1.sanitizeAnthropicPdfFilenames)(messagesWithInlinedSvg)
                : messagesWithInlinedSvg;
            // Some MCP tools return images as base64 in tool results.
            // Providers can treat tool-result payloads as text/JSON, which can blow up context.
            // Rewrite those tool outputs to small text placeholders and attach the images as file parts.
            const messagesWithToolMediaExtracted = (0, extractToolMediaAsUserMessages_1.extractToolMediaAsUserMessages)(messagesWithSanitizedPdf);
            // Convert UnixMessage to ModelMessage format using Vercel AI SDK utility
            // Type assertion needed because UnixMessage has custom tool parts for interrupted tools
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            const rawModelMessages = (0, ai_1.convertToModelMessages)(messagesWithToolMediaExtracted, {
                // Drop unfinished tool calls (input-streaming/input-available) so downstream
                // transforms only see tool calls that actually produced outputs.
                ignoreIncompleteToolCalls: true,
            });
            // Self-healing: Filter out any empty ModelMessages that could brick the request.
            // The SDK's ignoreIncompleteToolCalls can drop all parts from a message, leaving
            // an assistant with empty content array. The API rejects these with "all messages
            // must have non-empty content except for the optional final assistant message".
            const modelMessages = rawModelMessages.filter((msg) => {
                if (msg.role !== "assistant")
                    return true;
                if (typeof msg.content === "string")
                    return msg.content.length > 0;
                return Array.isArray(msg.content) && msg.content.length > 0;
            });
            if (modelMessages.length < rawModelMessages.length) {
                log_1.log.debug(`Self-healing: Filtered ${rawModelMessages.length - modelMessages.length} empty ModelMessage(s)`);
            }
            log_1.log.debug_obj(`${workspaceId}/2_model_messages.json`, modelMessages);
            // Apply ModelMessage transforms based on provider requirements
            const transformedMessages = (0, modelMessageTransform_1.transformModelMessages)(modelMessages, providerForMessages, {
                anthropicThinkingEnabled: providerForMessages === "anthropic" && effectiveThinkingLevel !== "off",
            });
            // Apply cache control for Anthropic models AFTER transformation
            const finalMessages = (0, cacheStrategy_1.applyCacheControl)(transformedMessages, modelString);
            log_1.log.debug_obj(`${workspaceId}/3_final_messages.json`, finalMessages);
            // Validate the messages meet Anthropic requirements (Anthropic only)
            if (providerForMessages === "anthropic") {
                const validation = (0, modelMessageTransform_1.validateAnthropicCompliance)(finalMessages);
                if (!validation.valid) {
                    log_1.log.error(`Anthropic compliance validation failed: ${validation.error ?? "unknown error"}`);
                    // Continue anyway, as the API might be more lenient
                }
            }
            // Construct effective agent system prompt
            // 1. Resolve the body with inheritance (prompt.append merges with base)
            // 2. If running as subagent, append subagent.append_prompt
            // Note: Use agentDefinition.id (may have fallen back to exec) instead of effectiveAgentId
            const resolvedBody = await (0, agentDefinitionsService_1.resolveAgentBody)(runtime, agentDiscoveryPath, agentDefinition.id);
            const agentSystemPrompt = isSubagentWorkspace && agentDefinition.frontmatter.subagent?.append_prompt
                ? `${resolvedBody}\n\n${agentDefinition.frontmatter.subagent.append_prompt}`
                : resolvedBody;
            // Build system message from workspace metadata
            const systemMessage = await (0, systemMessage_1.buildSystemMessage)(metadata, runtime, workspacePath, effectiveAdditionalInstructions, modelString, mcpServers, { agentSystemPrompt });
            // Count system message tokens for cost tracking
            const tokenizer = await (0, tokenizer_1.getTokenizerForModel)(modelString);
            const systemMessageTokens = await tokenizer.countTokens(systemMessage);
            // Load project secrets (system workspace never gets secrets injected)
            const projectSecrets = workspaceId === unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID
                ? []
                : this.config.getProjectSecrets(metadata.projectPath);
            // Generate stream token and create temp directory for tools
            const streamToken = this.streamManager.generateStreamToken();
            let mcpTools;
            let mcpStats;
            let mcpSetupDurationMs = 0;
            if (this.mcpServerManager && workspaceId !== unixChat_1.UNIX_HELP_CHAT_WORKSPACE_ID) {
                const start = Date.now();
                try {
                    const result = await this.mcpServerManager.getToolsForWorkspace({
                        workspaceId,
                        projectPath: metadata.projectPath,
                        runtime,
                        workspacePath,
                        overrides: mcpOverrides,
                        projectSecrets: (0, secrets_1.secretsToRecord)(projectSecrets),
                    });
                    mcpTools = result.tools;
                    mcpStats = result.stats;
                }
                catch (error) {
                    workspaceLog.error("Failed to start MCP servers", { error });
                }
                finally {
                    mcpSetupDurationMs = Date.now() - start;
                }
            }
            const runtimeTempDir = await this.streamManager.createTempDirForStream(streamToken, runtime);
            // Extract tool-specific instructions from AGENTS.md files and agent definition
            const toolInstructions = await (0, systemMessage_1.readToolInstructions)(metadata, runtime, workspacePath, modelString, agentSystemPrompt);
            // Calculate cumulative session costs for UNIX_COSTS_USD env var
            let sessionCostsUsd;
            if (this.sessionUsageService) {
                const sessionUsage = await this.sessionUsageService.getSessionUsage(workspaceId);
                if (sessionUsage) {
                    const allUsage = (0, usageAggregator_1.sumUsageHistory)(Object.values(sessionUsage.byModel));
                    sessionCostsUsd = (0, usageAggregator_1.getTotalCost)(allUsage);
                }
            }
            // Get model-specific tools with workspace path (correct for local or remote)
            const allTools = await (0, tools_1.getToolsForModel)(modelString, {
                cwd: workspacePath,
                runtime,
                secrets: (0, secrets_1.secretsToRecord)(projectSecrets),
                muxEnv: (0, initHook_1.getUnixEnv)(metadata.projectPath, (0, initHook_1.getRuntimeType)(metadata.runtimeConfig), metadata.name, {
                    modelString,
                    thinkingLevel: thinkingLevel ?? "off",
                    costsUsd: sessionCostsUsd,
                }),
                runtimeTempDir,
                backgroundProcessManager: this.backgroundProcessManager,
                // Plan agent configuration for plan file access.
                // - read: plan file is readable in all agents (useful context)
                // - write: enforced by file_edit_* tools (plan file is read-only outside plan agent)
                planFileOnly: agentIsPlanLike,
                emitChatEvent: (event) => {
                    // Defensive: tools should only emit events for the workspace they belong to.
                    if ("workspaceId" in event && event.workspaceId !== workspaceId) {
                        return;
                    }
                    this.emit(event.type, event);
                },
                workspaceSessionDir: this.config.getSessionDir(workspaceId),
                planFilePath,
                workspaceId,
                // Only child workspaces (tasks) can report to a parent.
                enableAgentReport: Boolean(metadata.parentWorkspaceId),
                // External edit detection callback
                recordFileState,
                taskService: this.taskService,
                // PTC experiments for inheritance to subagents
                experiments,
            }, workspaceId, this.initStateManager, toolInstructions, mcpTools);
            // Merge in extra tools (e.g., CLI-specific tools like set_exit_code)
            // These bypass policy filtering since they're injected by the runtime, not user config
            const allToolsWithExtra = this.extraTools ? { ...allTools, ...this.extraTools } : allTools;
            // NOTE: effectiveToolPolicy is derived from the selected agent definition (plus hard-denies).
            // Apply tool policy FIRST - this must happen before PTC to ensure sandbox
            // respects allow/deny filters. The policy-filtered tools are passed to
            // ToolBridge so the unix.* API only exposes policy-allowed tools.
            const policyFilteredTools = (0, toolPolicy_1.applyToolPolicy)(allToolsWithExtra, effectiveToolPolicy);
            // Handle PTC experiments - add or replace tools with code_execution
            let toolsForModel = policyFilteredTools;
            if (experiments?.programmaticToolCalling || experiments?.programmaticToolCallingExclusive) {
                try {
                    // Lazy-load PTC modules only when experiments are enabled
                    const ptc = await getPTCModules();
                    // Create emit callback that forwards nested events to stream
                    // Only forward tool-call-start/end events, not console events
                    const emitNestedEvent = (event) => {
                        if (event.type === "tool-call-start" || event.type === "tool-call-end") {
                            this.streamManager.emitNestedToolEvent(workspaceId, assistantMessageId, event);
                        }
                        // Console events are not streamed (appear in final result only)
                    };
                    // ToolBridge uses policy-filtered tools - sandbox only exposes allowed tools
                    const toolBridge = new ptc.ToolBridge(policyFilteredTools);
                    // Singleton runtime factory (WASM module is expensive to load)
                    ptc.runtimeFactory ?? (ptc.runtimeFactory = new ptc.QuickJSRuntimeFactory());
                    const codeExecutionTool = await ptc.createCodeExecutionTool(ptc.runtimeFactory, toolBridge, emitNestedEvent);
                    if (experiments?.programmaticToolCallingExclusive) {
                        // Exclusive mode: code_execution is mandatory — it's the only way to use bridged
                        // tools. The experiment flag is the opt-in; policy cannot disable it here since
                        // that would leave no way to access tools. nonBridgeable is already policy-filtered.
                        const nonBridgeable = toolBridge.getNonBridgeableTools();
                        toolsForModel = { ...nonBridgeable, code_execution: codeExecutionTool };
                    }
                    else {
                        // Supplement mode: add code_execution, then apply policy to determine final set.
                        // This correctly handles all policy combinations (require, enable, disable).
                        toolsForModel = (0, toolPolicy_1.applyToolPolicy)({ ...policyFilteredTools, code_execution: codeExecutionTool }, effectiveToolPolicy);
                    }
                }
                catch (error) {
                    // Fall back to policy-filtered tools if PTC creation fails
                    log_1.log.error("Failed to create code_execution tool, falling back to base tools", { error });
                }
            }
            const tools = toolsForModel;
            const effectiveMcpStats = mcpStats ??
                {
                    enabledServerCount: 0,
                    startedServerCount: 0,
                    failedServerCount: 0,
                    autoFallbackCount: 0,
                    hasStdio: false,
                    hasHttp: false,
                    hasSse: false,
                    transportMode: "none",
                };
            const mcpToolNames = new Set(Object.keys(mcpTools ?? {}));
            const toolNames = Object.keys(tools);
            const mcpToolCount = toolNames.filter((name) => mcpToolNames.has(name)).length;
            const totalToolCount = toolNames.length;
            const builtinToolCount = Math.max(0, totalToolCount - mcpToolCount);
            this.telemetryService?.capture({
                event: "mcp_context_injected",
                properties: {
                    workspaceId,
                    model: modelString,
                    agentId: effectiveAgentId,
                    runtimeType: (0, utils_1.getRuntimeTypeForTelemetry)(metadata.runtimeConfig),
                    mcp_server_enabled_count: effectiveMcpStats.enabledServerCount,
                    mcp_server_started_count: effectiveMcpStats.startedServerCount,
                    mcp_server_failed_count: effectiveMcpStats.failedServerCount,
                    mcp_tool_count: mcpToolCount,
                    total_tool_count: totalToolCount,
                    builtin_tool_count: builtinToolCount,
                    mcp_transport_mode: effectiveMcpStats.transportMode,
                    mcp_has_http: effectiveMcpStats.hasHttp,
                    mcp_has_sse: effectiveMcpStats.hasSse,
                    mcp_has_stdio: effectiveMcpStats.hasStdio,
                    mcp_auto_fallback_count: effectiveMcpStats.autoFallbackCount,
                    mcp_setup_duration_ms_b2: (0, utils_1.roundToBase2)(mcpSetupDurationMs),
                },
            });
            log_1.log.info("AIService.streamMessage: tool configuration", {
                workspaceId,
                model: modelString,
                toolNames: Object.keys(tools),
                hasToolPolicy: Boolean(effectiveToolPolicy),
            });
            // Create assistant message placeholder with historySequence from backend
            if (combinedAbortSignal.aborted) {
                return (0, result_1.Ok)(undefined);
            }
            const assistantMessageId = (0, messageIds_1.createAssistantMessageId)();
            const assistantMessage = (0, message_1.createUnixMessage)(assistantMessageId, "assistant", "", {
                timestamp: Date.now(),
                model: modelString,
                systemMessageTokens,
                agentId: effectiveAgentId,
            });
            // Append to history to get historySequence assigned
            const appendResult = await this.historyService.appendToHistory(workspaceId, assistantMessage);
            if (!appendResult.success) {
                return (0, result_1.Err)({ type: "unknown", raw: appendResult.error });
            }
            // Get the assigned historySequence
            const historySequence = assistantMessage.metadata?.historySequence ?? 0;
            const forceContextLimitError = modelString.startsWith("openai:") &&
                effectiveUnixProviderOptions.openai?.forceContextLimitError === true;
            const simulateToolPolicyNoop = modelString.startsWith("openai:") &&
                effectiveUnixProviderOptions.openai?.simulateToolPolicyNoop === true;
            if (forceContextLimitError) {
                const errorMessage = "Context length exceeded: the conversation is too long to send to this OpenAI model. Please shorten the history and try again.";
                const errorPartialMessage = {
                    id: assistantMessageId,
                    role: "assistant",
                    metadata: {
                        historySequence,
                        timestamp: Date.now(),
                        model: modelString,
                        systemMessageTokens,
                        agentId: effectiveAgentId,
                        partial: true,
                        error: errorMessage,
                        errorType: "context_exceeded",
                    },
                    parts: [],
                };
                await this.partialService.writePartial(workspaceId, errorPartialMessage);
                const streamStartEvent = {
                    type: "stream-start",
                    workspaceId,
                    messageId: assistantMessageId,
                    model: modelString,
                    historySequence,
                    startTime: Date.now(),
                    agentId: effectiveAgentId,
                    mode: effectiveMode,
                };
                this.emit("stream-start", streamStartEvent);
                this.emit("error", (0, sendMessageError_1.createErrorEvent)(workspaceId, {
                    messageId: assistantMessageId,
                    error: errorMessage,
                    errorType: "context_exceeded",
                }));
                return (0, result_1.Ok)(undefined);
            }
            if (simulateToolPolicyNoop) {
                const noopMessage = (0, message_1.createUnixMessage)(assistantMessageId, "assistant", "", {
                    timestamp: Date.now(),
                    model: modelString,
                    systemMessageTokens,
                    agentId: effectiveAgentId,
                    toolPolicy: effectiveToolPolicy,
                });
                const parts = [
                    {
                        type: "text",
                        text: "Tool execution skipped because the requested tool is disabled by policy.",
                    },
                ];
                const streamStartEvent = {
                    type: "stream-start",
                    workspaceId,
                    messageId: assistantMessageId,
                    model: modelString,
                    historySequence,
                    startTime: Date.now(),
                    agentId: effectiveAgentId,
                    mode: effectiveMode,
                };
                this.emit("stream-start", streamStartEvent);
                const textParts = parts.filter((part) => part.type === "text");
                if (textParts.length === 0) {
                    throw new Error("simulateToolPolicyNoop requires at least one text part");
                }
                for (const textPart of textParts) {
                    if (textPart.text.length === 0) {
                        continue;
                    }
                    const streamDeltaEvent = {
                        type: "stream-delta",
                        workspaceId,
                        messageId: assistantMessageId,
                        delta: textPart.text,
                        tokens: 0, // Mock scenario - actual tokenization happens in streamManager
                        timestamp: Date.now(),
                    };
                    this.emit("stream-delta", streamDeltaEvent);
                }
                const streamEndEvent = {
                    type: "stream-end",
                    workspaceId,
                    messageId: assistantMessageId,
                    metadata: {
                        model: modelString,
                        systemMessageTokens,
                    },
                    parts,
                };
                this.emit("stream-end", streamEndEvent);
                const finalAssistantMessage = {
                    ...noopMessage,
                    metadata: {
                        ...noopMessage.metadata,
                        historySequence,
                    },
                    parts,
                };
                await this.partialService.deletePartial(workspaceId);
                await this.historyService.updateHistory(workspaceId, finalAssistantMessage);
                return (0, result_1.Ok)(undefined);
            }
            // Build provider options based on thinking level and message history
            const truncationMode = openaiTruncationModeOverride;
            // Pass filtered messages so OpenAI can extract previousResponseId for persistence
            // Also pass callback to filter out lost responseIds (OpenAI invalidated them)
            // Pass workspaceId to derive stable promptCacheKey for OpenAI caching
            const providerOptions = (0, providerOptions_1.buildProviderOptions)(modelString, effectiveThinkingLevel, filteredMessages, (id) => this.streamManager.isResponseIdLost(id), effectiveUnixProviderOptions, workspaceId, truncationMode);
            // Debug dump: Log the complete LLM request when UNIX_DEBUG_LLM_REQUEST is set
            // This helps diagnose issues with system prompts, messages, tools, etc.
            if (process.env.UNIX_DEBUG_LLM_REQUEST === "1") {
                const llmRequest = {
                    workspaceId,
                    model: modelString,
                    systemMessage,
                    messages: finalMessages,
                    tools: Object.fromEntries(Object.entries(tools).map(([name, tool]) => [
                        name,
                        {
                            description: tool.description,
                            inputSchema: tool.inputSchema,
                        },
                    ])),
                    providerOptions,
                    thinkingLevel: effectiveThinkingLevel,
                    maxOutputTokens,
                    mode: effectiveMode,
                    agentId: effectiveAgentId,
                    toolPolicy: effectiveToolPolicy,
                };
                log_1.log.info(`[UNIX_DEBUG_LLM_REQUEST] Full LLM request:\n${JSON.stringify(llmRequest, null, 2)}`);
            }
            if (combinedAbortSignal.aborted) {
                const deleteResult = await this.historyService.deleteMessage(workspaceId, assistantMessageId);
                if (!deleteResult.success) {
                    log_1.log.error(`Failed to delete aborted assistant placeholder (${assistantMessageId}): ${deleteResult.error}`);
                }
                return (0, result_1.Ok)(undefined);
            }
            // Capture request payload for the debug modal, then delegate to StreamManager.
            const snapshot = {
                capturedAt: Date.now(),
                workspaceId,
                messageId: assistantMessageId,
                model: modelString,
                providerName,
                thinkingLevel: effectiveThinkingLevel,
                mode: effectiveMode,
                agentId: effectiveAgentId,
                maxOutputTokens,
                systemMessage,
                messages: finalMessages,
            };
            try {
                const cloned = typeof structuredClone === "function"
                    ? structuredClone(snapshot)
                    : JSON.parse(JSON.stringify(snapshot));
                this.lastLlmRequestByWorkspace.set(workspaceId, cloned);
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                workspaceLog.warn("Failed to capture debug LLM request snapshot", { error: errMsg });
            }
            const toolsForStream = experiments?.system1 === true
                ? (() => {
                    const baseBashTool = tools.bash;
                    const baseBashOutputTool = tools.bash_output;
                    const baseTaskAwaitTool = tools.task_await;
                    if (!baseBashTool) {
                        return tools;
                    }
                    const baseBashToolRecord = baseBashTool;
                    const originalExecute = baseBashToolRecord.execute;
                    if (typeof originalExecute !== "function") {
                        return tools;
                    }
                    const executeFn = originalExecute;
                    const getExecuteFnForTool = (targetTool) => {
                        if (!targetTool) {
                            return undefined;
                        }
                        const toolRecord = targetTool;
                        const execute = toolRecord.execute;
                        if (typeof execute !== "function") {
                            return undefined;
                        }
                        return execute;
                    };
                    const bashOutputExecuteFn = getExecuteFnForTool(baseBashOutputTool);
                    const taskAwaitExecuteFn = getExecuteFnForTool(baseTaskAwaitTool);
                    const system1ModelString = typeof system1Model === "string" ? system1Model.trim() : "";
                    const effectiveSystem1ModelStringForThinking = system1ModelString || modelString;
                    const effectiveSystem1ThinkingLevel = (0, policy_1.enforceThinkingPolicy)(effectiveSystem1ModelStringForThinking, system1ThinkingLevel ?? "off");
                    let cachedSystem1Model;
                    let cachedSystem1ModelFailed = false;
                    const getSystem1ModelForStream = async () => {
                        if (!system1ModelString) {
                            return { modelString, model: modelResult.data };
                        }
                        if (cachedSystem1Model) {
                            return cachedSystem1Model;
                        }
                        if (cachedSystem1ModelFailed) {
                            return undefined;
                        }
                        const created = await this.createModel(system1ModelString, effectiveUnixProviderOptions);
                        if (!created.success) {
                            cachedSystem1ModelFailed = true;
                            log_1.log.debug("[system1] Failed to create System 1 model", {
                                workspaceId,
                                system1Model: system1ModelString,
                                error: created.error,
                            });
                            return undefined;
                        }
                        cachedSystem1Model = { modelString: system1ModelString, model: created.data };
                        return cachedSystem1Model;
                    };
                    const maybeFilterBashOutputWithSystem1 = async (params) => {
                        let system1TimedOut = false;
                        try {
                            if (typeof params.output !== "string" || params.output.length === 0) {
                                return undefined;
                            }
                            const minLines = taskSettings.bashOutputCompactionMinLines ??
                                tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinLines.default;
                            const minTotalBytes = taskSettings.bashOutputCompactionMinTotalBytes ??
                                tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMinTotalBytes.default;
                            const userMaxKeptLines = taskSettings.bashOutputCompactionMaxKeptLines ??
                                tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionMaxKeptLines.default;
                            const heuristicFallbackEnabled = taskSettings.bashOutputCompactionHeuristicFallback ??
                                tasks_1.DEFAULT_TASK_SETTINGS.bashOutputCompactionHeuristicFallback ??
                                true;
                            const timeoutMs = taskSettings.bashOutputCompactionTimeoutMs ??
                                tasks_1.SYSTEM1_BASH_OUTPUT_COMPACTION_LIMITS.bashOutputCompactionTimeoutMs.default;
                            const lines = (0, bashOutputFiltering_1.splitBashOutputLines)(params.output);
                            const bytes = Buffer.byteLength(params.output, "utf-8");
                            const decision = (0, bashCompactionPolicy_1.decideBashOutputCompaction)({
                                toolName: params.toolName,
                                script: params.script,
                                displayName: params.displayName,
                                planFilePath: effectiveMode === "plan" ? planFilePath : undefined,
                                totalLines: lines.length,
                                totalBytes: bytes,
                                minLines,
                                minTotalBytes,
                                maxKeptLines: userMaxKeptLines,
                            });
                            const triggeredByLines = decision.triggeredByLines;
                            const triggeredByBytes = decision.triggeredByBytes;
                            if (!triggeredByLines && !triggeredByBytes) {
                                return undefined;
                            }
                            if (!decision.shouldCompact) {
                                log_1.log.debug("[system1] Skipping bash output compaction", {
                                    workspaceId,
                                    toolName: params.toolName,
                                    skipReason: decision.skipReason,
                                    intent: decision.intent,
                                    alreadyTargeted: decision.alreadyTargeted,
                                    displayName: params.displayName,
                                    totalLines: lines.length,
                                    totalBytes: bytes,
                                    triggeredByLines,
                                    triggeredByBytes,
                                    minLines,
                                    minTotalBytes,
                                    userMaxKeptLines,
                                    heuristicFallbackEnabled,
                                    timeoutMs,
                                });
                                return undefined;
                            }
                            const maxKeptLines = decision.effectiveMaxKeptLines;
                            log_1.log.debug("[system1] Bash output compaction triggered", {
                                workspaceId,
                                toolName: params.toolName,
                                intent: decision.intent,
                                alreadyTargeted: decision.alreadyTargeted,
                                displayName: params.displayName,
                                totalLines: lines.length,
                                totalBytes: bytes,
                                triggeredByLines,
                                triggeredByBytes,
                                minLines,
                                minTotalBytes,
                                userMaxKeptLines,
                                maxKeptLines,
                                heuristicFallbackEnabled,
                                timeoutMs,
                            });
                            let fullOutputPath;
                            try {
                                // Use 8 hex characters for short, memorable temp file IDs.
                                const fileId = Math.random().toString(16).substring(2, 10);
                                fullOutputPath = path.posix.join(runtimeTempDir, `bash-full-${fileId}.txt`);
                                const writer = runtime.writeFile(fullOutputPath, params.abortSignal);
                                const encoder = new TextEncoder();
                                const writerInstance = writer.getWriter();
                                await writerInstance.write(encoder.encode(params.output));
                                await writerInstance.close();
                            }
                            catch (error) {
                                log_1.log.debug("[system1] Failed to save full bash output to temp file", {
                                    workspaceId,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                                fullOutputPath = undefined;
                            }
                            const system1 = await getSystem1ModelForStream();
                            if (!system1) {
                                return undefined;
                            }
                            const system1ProviderOptions = (0, providerOptions_1.buildProviderOptions)(system1.modelString, effectiveSystem1ThinkingLevel, undefined, undefined, effectiveUnixProviderOptions, workspaceId);
                            const numberedOutput = (0, bashOutputFiltering_1.formatNumberedLinesForSystem1)(lines);
                            const startTimeMs = Date.now();
                            if (typeof params.toolCallId === "string" && params.toolCallId.length > 0) {
                                this.emit("bash-output", {
                                    type: "bash-output",
                                    workspaceId,
                                    toolCallId: params.toolCallId,
                                    phase: "filtering",
                                    text: "",
                                    isError: false,
                                    timestamp: Date.now(),
                                });
                            }
                            let filterMethod = "system1";
                            let keepRangesCount = 0;
                            let finishReason;
                            let lastErrorName;
                            let lastErrorMessage;
                            let applied = undefined;
                            try {
                                const keepRangesResult = await (0, system1AgentRunner_1.runSystem1KeepRangesForBashOutput)({
                                    runtime,
                                    agentDiscoveryPath,
                                    runtimeTempDir,
                                    model: system1.model,
                                    modelString: system1.modelString,
                                    providerOptions: system1ProviderOptions,
                                    displayName: params.displayName,
                                    script: params.script,
                                    numberedOutput,
                                    maxKeptLines,
                                    timeoutMs,
                                    abortSignal: params.abortSignal,
                                    onTimeout: () => {
                                        system1TimedOut = true;
                                    },
                                });
                                if (keepRangesResult) {
                                    finishReason = keepRangesResult.finishReason;
                                    keepRangesCount = keepRangesResult.keepRanges.length;
                                    applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                                        rawOutput: params.output,
                                        keepRanges: keepRangesResult.keepRanges,
                                        maxKeptLines,
                                    });
                                }
                            }
                            catch (error) {
                                lastErrorName = error instanceof Error ? error.name : undefined;
                                lastErrorMessage = error instanceof Error ? error.message : String(error);
                            }
                            if (!applied || applied.keptLines === 0) {
                                const elapsedMs = Date.now() - startTimeMs;
                                const upstreamAborted = params.abortSignal?.aborted ?? false;
                                log_1.log.debug("[system1] Failed to generate keep_ranges", {
                                    workspaceId,
                                    toolName: params.toolName,
                                    system1Model: system1.modelString,
                                    elapsedMs,
                                    timedOut: system1TimedOut,
                                    upstreamAborted,
                                    keepRangesCount,
                                    errorName: lastErrorName,
                                    error: lastErrorMessage,
                                });
                                if (!heuristicFallbackEnabled || upstreamAborted) {
                                    return undefined;
                                }
                                const heuristicKeepRanges = (0, bashOutputFiltering_1.getHeuristicKeepRangesForBashOutput)({
                                    lines,
                                    maxKeptLines,
                                });
                                keepRangesCount = heuristicKeepRanges.length;
                                applied = (0, bashOutputFiltering_1.applySystem1KeepRangesToOutput)({
                                    rawOutput: params.output,
                                    keepRanges: heuristicKeepRanges,
                                    maxKeptLines,
                                });
                                filterMethod = "heuristic";
                            }
                            if (!applied || applied.keptLines === 0) {
                                log_1.log.debug("[system1] keep_ranges produced empty filtered output", {
                                    workspaceId,
                                    toolName: params.toolName,
                                    filterMethod,
                                    keepRangesCount,
                                    maxKeptLines,
                                    totalLines: lines.length,
                                });
                                return undefined;
                            }
                            const elapsedMs = Date.now() - startTimeMs;
                            const trigger = [
                                triggeredByLines ? "lines" : null,
                                triggeredByBytes ? "bytes" : null,
                            ]
                                .filter(Boolean)
                                .join("+");
                            const notice = (0, bashOutputFiltering_1.formatSystem1BashFilterNotice)({
                                keptLines: applied.keptLines,
                                totalLines: applied.totalLines,
                                trigger,
                                fullOutputPath,
                            });
                            log_1.log.debug("[system1] Filtered bash tool output", {
                                workspaceId,
                                toolName: params.toolName,
                                intent: decision.intent,
                                alreadyTargeted: decision.alreadyTargeted,
                                displayName: params.displayName,
                                userMaxKeptLines,
                                maxKeptLines,
                                system1Model: system1.modelString,
                                filterMethod,
                                keepRangesCount,
                                finishReason,
                                elapsedMs,
                                keptLines: applied.keptLines,
                                totalLines: applied.totalLines,
                                totalBytes: bytes,
                                triggeredByLines,
                                triggeredByBytes,
                                timeoutMs,
                            });
                            return { filteredOutput: applied.filteredOutput, notice };
                        }
                        catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            const errorName = error instanceof Error ? error.name : undefined;
                            const upstreamAborted = params.abortSignal?.aborted ?? false;
                            const isAbortError = errorName === "AbortError";
                            log_1.log.debug("[system1] Failed to filter bash tool output", {
                                workspaceId,
                                toolName: params.toolName,
                                error: errorMessage,
                                errorName,
                                timedOut: system1TimedOut,
                                upstreamAborted,
                                isAbortError,
                            });
                            return undefined;
                        }
                    };
                    const wrappedBashTool = cloneToolPreservingDescriptors(baseBashTool);
                    const wrappedBashToolRecord = wrappedBashTool;
                    wrappedBashToolRecord.execute = async (args, options) => {
                        const result = await executeFn.call(baseBashTool, args, options);
                        try {
                            const runInBackground = Boolean(args?.run_in_background) ||
                                (result && typeof result === "object" && "backgroundProcessId" in result);
                            if (runInBackground) {
                                return result;
                            }
                            const output = result?.output;
                            if (typeof output !== "string" || output.length === 0) {
                                return result;
                            }
                            const displayName = typeof args?.display_name ===
                                "string"
                                ? String(args.display_name).trim() ||
                                    undefined
                                : undefined;
                            const script = typeof args?.script === "string"
                                ? String(args.script)
                                : "";
                            const toolCallId = typeof options?.toolCallId ===
                                "string"
                                ? options.toolCallId
                                : undefined;
                            const filtered = await maybeFilterBashOutputWithSystem1({
                                toolName: "bash",
                                output,
                                script,
                                displayName,
                                toolCallId,
                                abortSignal: options
                                    ?.abortSignal,
                            });
                            if (!filtered) {
                                return result;
                            }
                            const existingNote = result?.note;
                            return {
                                ...result,
                                output: filtered.filteredOutput,
                                note: appendToolNote(typeof existingNote === "string" ? existingNote : undefined, filtered.notice),
                            };
                        }
                        catch (error) {
                            log_1.log.debug("[system1] Failed to filter bash tool output", {
                                workspaceId,
                                error: error instanceof Error ? error.message : String(error),
                            });
                            return result;
                        }
                    };
                    const wrappedTools = { ...tools, bash: wrappedBashTool };
                    if (baseBashOutputTool && bashOutputExecuteFn) {
                        const wrappedBashOutputTool = cloneToolPreservingDescriptors(baseBashOutputTool);
                        const wrappedBashOutputToolRecord = wrappedBashOutputTool;
                        wrappedBashOutputToolRecord.execute = async (args, options) => {
                            const result = await bashOutputExecuteFn.call(baseBashOutputTool, args, options);
                            try {
                                const output = result?.output;
                                if (typeof output !== "string" || output.length === 0) {
                                    return result;
                                }
                                const filtered = await maybeFilterBashOutputWithSystem1({
                                    toolName: "bash_output",
                                    output,
                                    script: "",
                                    abortSignal: options
                                        ?.abortSignal,
                                });
                                if (!filtered) {
                                    return result;
                                }
                                const existingNote = result?.note;
                                return {
                                    ...result,
                                    output: filtered.filteredOutput,
                                    note: appendToolNote(typeof existingNote === "string" ? existingNote : undefined, filtered.notice),
                                };
                            }
                            catch (error) {
                                log_1.log.debug("[system1] Failed to filter bash_output tool output", {
                                    workspaceId,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                                return result;
                            }
                        };
                        wrappedTools.bash_output = wrappedBashOutputTool;
                    }
                    if (baseTaskAwaitTool && taskAwaitExecuteFn) {
                        const wrappedTaskAwaitTool = cloneToolPreservingDescriptors(baseTaskAwaitTool);
                        const wrappedTaskAwaitToolRecord = wrappedTaskAwaitTool;
                        wrappedTaskAwaitToolRecord.execute = async (args, options) => {
                            const result = await taskAwaitExecuteFn.call(baseTaskAwaitTool, args, options);
                            try {
                                const resultsValue = result?.results;
                                if (!Array.isArray(resultsValue) || resultsValue.length === 0) {
                                    return result;
                                }
                                const filteredResults = await Promise.all(resultsValue.map(async (entry) => {
                                    if (!entry || typeof entry !== "object") {
                                        return entry;
                                    }
                                    const taskId = entry.taskId;
                                    if (typeof taskId !== "string" || !taskId.startsWith("bash:")) {
                                        return entry;
                                    }
                                    const status = entry.status;
                                    if (status === "running") {
                                        const output = entry.output;
                                        if (typeof output !== "string" || output.length === 0) {
                                            return entry;
                                        }
                                        const filtered = await maybeFilterBashOutputWithSystem1({
                                            toolName: "task_await",
                                            output,
                                            script: "",
                                            abortSignal: options
                                                ?.abortSignal,
                                        });
                                        if (!filtered) {
                                            return entry;
                                        }
                                        const existingNote = entry.note;
                                        return {
                                            ...entry,
                                            output: filtered.filteredOutput,
                                            note: appendToolNote(typeof existingNote === "string" ? existingNote : undefined, filtered.notice),
                                        };
                                    }
                                    if (status === "completed") {
                                        const reportMarkdown = entry
                                            .reportMarkdown;
                                        if (typeof reportMarkdown !== "string" || reportMarkdown.length === 0) {
                                            return entry;
                                        }
                                        const parsed = (0, bashTaskReport_1.tryParseBashOutputReport)(reportMarkdown);
                                        if (!parsed || parsed.output.length === 0) {
                                            return entry;
                                        }
                                        const filtered = await maybeFilterBashOutputWithSystem1({
                                            toolName: "task_await",
                                            output: parsed.output,
                                            script: "",
                                            abortSignal: options
                                                ?.abortSignal,
                                        });
                                        if (!filtered) {
                                            return entry;
                                        }
                                        const nextReportMarkdown = (0, bashTaskReport_1.formatBashOutputReport)({
                                            processId: parsed.processId,
                                            status: parsed.status,
                                            exitCode: parsed.exitCode,
                                            output: filtered.filteredOutput,
                                        });
                                        const existingNote = entry.note;
                                        return {
                                            ...entry,
                                            reportMarkdown: nextReportMarkdown,
                                            note: appendToolNote(typeof existingNote === "string" ? existingNote : undefined, filtered.notice),
                                        };
                                    }
                                    return entry;
                                }));
                                return {
                                    ...result,
                                    results: filteredResults,
                                };
                            }
                            catch (error) {
                                log_1.log.debug("[system1] Failed to filter task_await tool output", {
                                    workspaceId,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                                return result;
                            }
                        };
                        wrappedTools.task_await = wrappedTaskAwaitTool;
                    }
                    return wrappedTools;
                })()
                : tools;
            const streamResult = await this.streamManager.startStream(workspaceId, finalMessages, modelResult.data, modelString, historySequence, systemMessage, runtime, assistantMessageId, // Shared messageId ensures nested tool events match stream events
            combinedAbortSignal, toolsForStream, {
                systemMessageTokens,
                timestamp: Date.now(),
                agentId: effectiveAgentId,
                mode: effectiveMode,
            }, providerOptions, maxOutputTokens, effectiveToolPolicy, streamToken, // Pass the pre-generated stream token
            hasQueuedMessage, metadata.name);
            if (!streamResult.success) {
                // StreamManager already returns SendMessageError
                return (0, result_1.Err)(streamResult.error);
            }
            // If we were interrupted during StreamManager startup before the stream was registered,
            // make sure we don't leave an empty assistant placeholder behind.
            if (combinedAbortSignal.aborted && !this.streamManager.isStreaming(workspaceId)) {
                const deleteResult = await this.historyService.deleteMessage(workspaceId, assistantMessageId);
                if (!deleteResult.success) {
                    log_1.log.error(`Failed to delete aborted assistant placeholder (${assistantMessageId}): ${deleteResult.error}`);
                }
            }
            // StreamManager now handles history updates directly on stream-end
            // No need for event listener here
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log_1.log.error("Stream message error:", error);
            // Return as unknown error type
            return (0, result_1.Err)({ type: "unknown", raw: `Failed to stream message: ${errorMessage}` });
        }
        finally {
            unlinkAbortSignal();
            const pending = this.pendingStreamStarts.get(workspaceId);
            if (pending?.abortController === pendingAbortController) {
                this.pendingStreamStarts.delete(workspaceId);
            }
        }
    }
    async stopStream(workspaceId, options) {
        const pending = this.pendingStreamStarts.get(workspaceId);
        const isActuallyStreaming = this.mockModeEnabled && this.mockAiStreamPlayer
            ? this.mockAiStreamPlayer.isStreaming(workspaceId)
            : this.streamManager.isStreaming(workspaceId);
        if (pending) {
            pending.abortController.abort();
            // If we're still in pre-stream startup (no StreamManager stream yet), emit a synthetic
            // stream-abort so the renderer can exit the "starting..." UI immediately.
            const abortReason = options?.abortReason ?? "startup";
            if (!isActuallyStreaming) {
                this.emit("stream-abort", {
                    type: "stream-abort",
                    workspaceId,
                    abortReason,
                    messageId: pending.syntheticMessageId,
                    metadata: { duration: Date.now() - pending.startTime },
                    abandonPartial: options?.abandonPartial,
                });
            }
        }
        if (this.mockModeEnabled && this.mockAiStreamPlayer) {
            this.mockAiStreamPlayer.stop(workspaceId);
            return (0, result_1.Ok)(undefined);
        }
        return this.streamManager.stopStream(workspaceId, options);
    }
    /**
     * Check if a workspace is currently streaming
     */
    isStreaming(workspaceId) {
        if (this.mockModeEnabled && this.mockAiStreamPlayer) {
            return this.mockAiStreamPlayer.isStreaming(workspaceId);
        }
        return this.streamManager.isStreaming(workspaceId);
    }
    /**
     * Get the current stream state for a workspace
     */
    getStreamState(workspaceId) {
        if (this.mockModeEnabled && this.mockAiStreamPlayer) {
            return this.mockAiStreamPlayer.isStreaming(workspaceId) ? "streaming" : "idle";
        }
        return this.streamManager.getStreamState(workspaceId);
    }
    /**
     * Get the current stream info for a workspace if actively streaming
     * Used to re-establish streaming context on frontend reconnection
     */
    getStreamInfo(workspaceId) {
        if (this.mockModeEnabled && this.mockAiStreamPlayer) {
            return undefined;
        }
        return this.streamManager.getStreamInfo(workspaceId);
    }
    /**
     * Replay stream events
     * Emits the same events that would be emitted during live streaming
     */
    async replayStream(workspaceId) {
        if (this.mockModeEnabled && this.mockAiStreamPlayer) {
            await this.mockAiStreamPlayer.replayStream(workspaceId);
            return;
        }
        await this.streamManager.replayStream(workspaceId);
    }
    debugGetLastMockPrompt(workspaceId) {
        if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
            return (0, result_1.Err)("debugGetLastMockPrompt: workspaceId is required");
        }
        if (!this.mockModeEnabled || !this.mockAiStreamPlayer) {
            return (0, result_1.Ok)(null);
        }
        return (0, result_1.Ok)(this.mockAiStreamPlayer.debugGetLastPrompt(workspaceId));
    }
    debugGetLastLlmRequest(workspaceId) {
        if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
            return (0, result_1.Err)("debugGetLastLlmRequest: workspaceId is required");
        }
        return (0, result_1.Ok)(this.lastLlmRequestByWorkspace.get(workspaceId) ?? null);
    }
    /**
     * DEBUG ONLY: Trigger an artificial stream error for testing.
     * This is used by integration tests to simulate network errors mid-stream.
     * @returns true if an active stream was found and error was triggered
     */
    debugTriggerStreamError(workspaceId, errorMessage = "Test-triggered stream error") {
        return this.streamManager.debugTriggerStreamError(workspaceId, errorMessage);
    }
    /**
     * Wait for workspace initialization to complete (if running).
     * Public wrapper for agent discovery and other callers.
     */
    async waitForInit(workspaceId, abortSignal) {
        return this.initStateManager.waitForInit(workspaceId, abortSignal);
    }
    async deleteWorkspace(workspaceId) {
        try {
            const workspaceDir = this.config.getSessionDir(workspaceId);
            await fs.rm(workspaceDir, { recursive: true, force: true });
            return (0, result_1.Ok)(undefined);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to delete workspace: ${message}`);
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=aiService.js.map