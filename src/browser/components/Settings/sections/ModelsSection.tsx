import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cable,
  CheckCircle2,
  ClipboardCopy,
  ClipboardCheck,
  Download,
  Loader2,
  Monitor,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Square,
  Timer,
  Trash2,
  Wifi,
  XCircle,
  Zap,
  Network,
} from "lucide-react";
import { Button } from "@/browser/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/browser/components/ui/select";
import { useAPI } from "@/browser/contexts/API";
import { getSuggestedModels, useModelsFromSettings } from "@/browser/hooks/useModelsFromSettings";
import { usePersistedState } from "@/browser/hooks/usePersistedState";
import { useProvidersConfig } from "@/browser/hooks/useProvidersConfig";
import { useInference } from "@/browser/hooks/useInference";
import { SearchableModelSelect } from "../components/SearchableModelSelect";
import { KNOWN_MODELS } from "@/common/constants/knownModels";
import { PROVIDER_DISPLAY_NAMES, SUPPORTED_PROVIDERS } from "@/common/constants/providers";
import {
  LAST_CUSTOM_MODEL_PROVIDER_KEY,
  PREFERRED_COMPACTION_MODEL_KEY,
} from "@/common/constants/storage";
import { ModelRow } from "./ModelRow";

// Shared header cell styles
const headerCellBase = "py-1.5 pr-2 text-xs font-medium text-muted";

// Table header component to avoid duplication
function ModelsTableHeader() {
  return (
    <thead>
      <tr className="border-border-medium bg-background-secondary/50 border-b">
        <th className={`${headerCellBase} pl-2 text-left md:pl-3`}>Provider</th>
        <th className={`${headerCellBase} text-left`}>Model</th>
        <th className={`${headerCellBase} w-16 text-right md:w-20`}>Context</th>
        <th className={`${headerCellBase} w-28 text-right md:w-32 md:pr-3`}>Actions</th>
      </tr>
    </thead>
  );
}

interface EditingState {
  provider: string;
  originalModelId: string;
  newModelId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-background-secondary flex flex-col gap-0.5 rounded-md px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function ModelsSection() {
  const { api } = useAPI();
  const { config, loading, updateModelsOptimistically } = useProvidersConfig();
  const [lastProvider, setLastProvider] = usePersistedState(LAST_CUSTOM_MODEL_PROVIDER_KEY, "");
  const [newModelId, setNewModelId] = useState("");
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectableProviders = SUPPORTED_PROVIDERS;
  const { defaultModel, setDefaultModel, hiddenModels, hideModel, unhideModel } =
    useModelsFromSettings();

  // Compaction model preference
  const [compactionModel, setCompactionModel] = usePersistedState<string>(
    PREFERRED_COMPACTION_MODEL_KEY,
    "",
    { listener: true }
  );

  // All models (including hidden) for the settings dropdowns
  const allModels = getSuggestedModels(config);

  // ── Local inference state ──────────────────────────────────────────────
  const {
    status: inferenceStatus,
    models: localModels,
    loading: localLoading,
    pulling,
    downloadProgress,
    poolStatus,
    clusterStatus,
    metrics,
    transportStatus,
    lastError: inferenceError,
    lastSuccess: inferenceSuccess,
    pullModel,
    deleteModel: deleteLocalModel,
    loadModel,
    unloadModel,
    discoverNodes,
    runBenchmark,
    clearMessages: clearInferenceMessages,
    refreshPoolStatus,
    refreshClusterStatus,
    refreshMetrics,
    refreshTransportStatus,
  } = useInference();

  const [modelIdInput, setModelIdInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showTransport, setShowTransport] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [metricsCopied, setMetricsCopied] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    tokensPerSecond: number;
    timeToFirstToken: number;
    totalTime: number;
  } | null>(null);

  // Auto-dismiss success messages after 4 seconds
  useEffect(() => {
    if (!inferenceSuccess) return;
    const timer = setTimeout(() => clearInferenceMessages(), 4000);
    return () => clearTimeout(timer);
  }, [inferenceSuccess, clearInferenceMessages]);

  // Auto-refresh metrics when visible
  useEffect(() => {
    if (!showMetrics) return;
    void refreshMetrics();
    const interval = setInterval(() => void refreshMetrics(), 5000);
    return () => clearInterval(interval);
  }, [showMetrics, refreshMetrics]);

  // Auto-refresh transport status when visible
  useEffect(() => {
    if (!showTransport) return;
    void refreshTransportStatus();
    const interval = setInterval(() => void refreshTransportStatus(), 5000);
    return () => clearInterval(interval);
  }, [showTransport, refreshTransportStatus]);

  const handleDiscoverNodes = async () => {
    setDiscovering(true);
    try {
      await discoverNodes();
    } finally {
      setDiscovering(false);
    }
  };

  const handleRunBenchmark = async (modelId: string) => {
    setBenchmarking(true);
    setBenchmarkResult(null);
    try {
      const result = await runBenchmark(modelId);
      setBenchmarkResult({
        tokensPerSecond: result.tokens_per_second,
        timeToFirstToken: result.time_to_first_token_ms,
        totalTime: result.total_time_ms,
      });
    } catch {
      // Benchmark failed silently — metrics section shows "no data"
    } finally {
      setBenchmarking(false);
    }
  };

  // Parse Prometheus text
  const parsedMetrics = React.useMemo(() => {
    if (!metrics) return null;
    const lines = metrics.split("\n");
    const vals: Record<string, number> = {};
    for (const line of lines) {
      if (line.startsWith("#") || !line.trim()) continue;
      const match = line.match(/^(\S+?)(?:\{.*?\})?\s+([\d.eE+-]+)/);
      if (match) {
        vals[match[1]] = parseFloat(match[2]);
      }
    }
    return vals;
  }, [metrics]);

  const progressPercent =
    downloadProgress && downloadProgress.totalBytes > 0
      ? Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)
      : 0;

  const handlePullModel = async () => {
    const id = modelIdInput.trim();
    if (!id) return;
    await pullModel(id);
    setModelIdInput("");
  };

  const handleLoadModel = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await loadModel(modelId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnloadModel = async () => {
    setActionLoading("__unload__");
    try {
      await unloadModel();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteLocalModel = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await deleteLocalModel(modelId);
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  // ── Cloud model management ─────────────────────────────────────────────
  const modelExists = useCallback(
    (provider: string, modelId: string, excludeOriginal?: string): boolean => {
      if (!config) return false;
      const currentModels = config[provider]?.models ?? [];
      return currentModels.some((m) => m === modelId && m !== excludeOriginal);
    },
    [config]
  );

  const handleAddModel = useCallback(() => {
    if (!config || !lastProvider || !newModelId.trim()) return;
    const trimmedModelId = newModelId.trim();
    if (modelExists(lastProvider, trimmedModelId)) {
      setError(`Model "${trimmedModelId}" already exists for this provider`);
      return;
    }
    if (!api) return;
    setError(null);
    const updatedModels = updateModelsOptimistically(lastProvider, (models) => [
      ...models,
      trimmedModelId,
    ]);
    setNewModelId("");
    void api.providers.setModels({ provider: lastProvider, models: updatedModels });
  }, [api, lastProvider, newModelId, config, modelExists, updateModelsOptimistically]);

  const handleRemoveModel = useCallback(
    (provider: string, modelId: string) => {
      if (!config || !api) return;
      const updatedModels = updateModelsOptimistically(provider, (models) =>
        models.filter((m) => m !== modelId)
      );
      void api.providers.setModels({ provider, models: updatedModels });
    },
    [api, config, updateModelsOptimistically]
  );

  const handleStartEdit = useCallback((provider: string, modelId: string) => {
    setEditing({ provider, originalModelId: modelId, newModelId: modelId });
    setError(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditing(null);
    setError(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!config || !editing || !api) return;
    const trimmedModelId = editing.newModelId.trim();
    if (!trimmedModelId) {
      setError("Model ID cannot be empty");
      return;
    }
    if (trimmedModelId !== editing.originalModelId) {
      if (modelExists(editing.provider, trimmedModelId)) {
        setError(`Model "${trimmedModelId}" already exists for this provider`);
        return;
      }
    }
    setError(null);
    const updatedModels = updateModelsOptimistically(editing.provider, (models) =>
      models.map((m) => (m === editing.originalModelId ? trimmedModelId : m))
    );
    setEditing(null);
    void api.providers.setModels({ provider: editing.provider, models: updatedModels });
  }, [api, editing, config, modelExists, updateModelsOptimistically]);

  // Show loading state while config is being fetched
  if (loading || !config) {
    return (
      <div className="flex items-center justify-center gap-2 py-12">
        <Loader2 className="text-muted h-5 w-5 animate-spin" />
        <span className="text-muted text-sm">Loading settings...</span>
      </div>
    );
  }

  // Get all custom models across providers
  const getCustomModels = (): Array<{ provider: string; modelId: string; fullId: string }> => {
    const models: Array<{ provider: string; modelId: string; fullId: string }> = [];
    for (const [provider, providerConfig] of Object.entries(config)) {
      if (providerConfig.models) {
        for (const modelId of providerConfig.models) {
          models.push({ provider, modelId, fullId: `${provider}:${modelId}` });
        }
      }
    }
    return models;
  };

  // Get built-in models from KNOWN_MODELS
  const builtInModels = Object.values(KNOWN_MODELS).map((model) => ({
    provider: model.provider,
    modelId: model.providerModelId,
    fullId: model.id,
    aliases: model.aliases,
  }));

  const customModels = getCustomModels();

  return (
    <div className="space-y-4">
      {/* ── Model Defaults ─────────────────────────────────────────────── */}
      <div className="border-border-medium overflow-hidden rounded-md border">
        <div className="border-border-medium bg-background-secondary/50 border-b px-2 py-1.5 md:px-3">
          <span className="text-muted text-xs font-medium">Model Defaults</span>
        </div>
        <div className="divide-border-medium divide-y">
          <div className="flex items-center gap-4 px-2 py-2 md:px-3">
            <div className="w-28 shrink-0 md:w-32">
              <div className="text-muted text-xs">Default Model</div>
              <div className="text-muted-light text-[10px]">New workspaces</div>
            </div>
            <div className="min-w-0 flex-1">
              <SearchableModelSelect
                value={defaultModel}
                onChange={setDefaultModel}
                models={allModels}
                placeholder="Select model"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 px-2 py-2 md:px-3">
            <div className="w-28 shrink-0 md:w-32">
              <div className="text-muted text-xs">Compaction Model</div>
              <div className="text-muted-light text-[10px]">History summary</div>
            </div>
            <div className="min-w-0 flex-1">
              <SearchableModelSelect
                value={compactionModel}
                onChange={setCompactionModel}
                models={allModels}
                emptyOption={{ value: "", label: "Use workspace model" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Custom Models ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-muted text-xs font-medium tracking-wide uppercase">Custom Models</div>

        <div className="border-border-medium overflow-hidden rounded-md border">
          <div className="border-border-medium bg-background-secondary/50 flex flex-wrap items-center gap-1.5 border-b px-2 py-1.5 md:px-3">
            <Select value={lastProvider} onValueChange={setLastProvider}>
              <SelectTrigger className="bg-background border-border-medium focus:border-accent h-7 w-auto shrink-0 rounded border px-2 text-xs">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {selectableProviders.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {PROVIDER_DISPLAY_NAMES[provider]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="text"
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder="model-id"
              className="bg-background border-border-medium focus:border-accent min-w-0 flex-1 rounded border px-2 py-1 font-mono text-xs focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddModel();
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddModel}
              disabled={!lastProvider || !newModelId.trim()}
              className="h-7 shrink-0 gap-1 px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {error && !editing && (
            <div className="text-error px-2 py-1.5 text-xs md:px-3">{error}</div>
          )}
        </div>

        {customModels.length > 0 && (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <table className="w-full">
              <ModelsTableHeader />
              <tbody>
                {customModels.map((model) => {
                  const isModelEditing =
                    editing?.provider === model.provider &&
                    editing?.originalModelId === model.modelId;
                  return (
                    <ModelRow
                      key={model.fullId}
                      provider={model.provider}
                      modelId={model.modelId}
                      fullId={model.fullId}
                      isCustom={true}
                      isDefault={defaultModel === model.fullId}
                      isEditing={isModelEditing}
                      editValue={isModelEditing ? editing.newModelId : undefined}
                      editError={isModelEditing ? error : undefined}
                      saving={false}
                      hasActiveEdit={editing !== null}
                      onSetDefault={() => setDefaultModel(model.fullId)}
                      onStartEdit={() => handleStartEdit(model.provider, model.modelId)}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                      onEditChange={(value) =>
                        setEditing((prev) => (prev ? { ...prev, newModelId: value } : null))
                      }
                      onRemove={() => handleRemoveModel(model.provider, model.modelId)}
                      isHiddenFromSelector={hiddenModels.includes(model.fullId)}
                      onToggleVisibility={() =>
                        hiddenModels.includes(model.fullId)
                          ? unhideModel(model.fullId)
                          : hideModel(model.fullId)
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Local Models (On-Device Inference) ─────────────────────────── */}
      <div className="space-y-3">
        <div className="text-muted text-xs font-medium tracking-wide uppercase">Local Models</div>

        {/* Error/Success Messages */}
        {inferenceError && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
            <span className="min-w-0 flex-1 text-xs text-red-400">{inferenceError}</span>
            <button
              onClick={clearInferenceMessages}
              className="shrink-0 text-xs text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}
        {inferenceSuccess && !inferenceError && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
            <span className="min-w-0 flex-1 text-xs text-green-400">{inferenceSuccess}</span>
          </div>
        )}

        {/* Status */}
        <div className="border-border-medium overflow-hidden rounded-md border">
          <div className="border-border-medium bg-background-secondary/50 border-b px-2 py-1.5 md:px-3">
            <div className="flex items-center gap-2 text-xs">
              {inferenceStatus?.available ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-foreground">
                    Inference backend ready
                    {inferenceStatus.loadedModelId && (
                      <span className="text-muted ml-1">
                        — active:{" "}
                        <span className="text-foreground font-medium">
                          {inferenceStatus.loadedModelId}
                        </span>
                      </span>
                    )}
                  </span>
                </>
              ) : inferenceStatus ? (
                <>
                  <XCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-muted">
                    Inference not available. Install Python 3 +{" "}
                    <code className="bg-background rounded px-1 text-[10px]">pip install mlx mlx-lm</code>
                  </span>
                </>
              ) : (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
                  <span className="text-muted">Checking availability...</span>
                </>
              )}
            </div>
          </div>

          {/* Pull form */}
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 md:px-3">
            <input
              type="text"
              value={modelIdInput}
              onChange={(e) => setModelIdInput(e.target.value)}
              placeholder="e.g. mlx-community/Qwen2.5-1.5B-Instruct-4bit"
              className="bg-background border-border-medium focus:border-accent min-w-0 flex-1 rounded border px-2 py-1 font-mono text-xs focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pulling) void handlePullModel();
              }}
              disabled={pulling}
            />
            <Button
              size="sm"
              onClick={() => void handlePullModel()}
              disabled={pulling || !modelIdInput.trim()}
              className="h-7 shrink-0 gap-1 px-2 text-xs"
            >
              {pulling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Pull
            </Button>
          </div>

          {/* Download Progress */}
          {pulling && downloadProgress && (
            <div className="border-border-medium border-t px-2 py-1.5 md:px-3">
              <div className="flex items-center justify-between text-[10px] text-muted">
                <span className="truncate">{downloadProgress.fileName}</span>
                <span>
                  {formatBytes(downloadProgress.downloadedBytes)} /{" "}
                  {formatBytes(downloadProgress.totalBytes)} ({progressPercent}%)
                </span>
              </div>
              <div className="bg-background-secondary mt-1 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cached local models table */}
        {localLoading ? (
          <div className="text-muted flex items-center gap-2 py-3 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading models...
          </div>
        ) : localModels.length > 0 ? (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-border-medium bg-background-secondary/50 border-b">
                  <th className={`${headerCellBase} pl-2 text-left md:pl-3`}>Model</th>
                  <th className={`${headerCellBase} text-left`}>Format</th>
                  <th className={`${headerCellBase} text-right`}>Size</th>
                  <th className={`${headerCellBase} text-left`}>Quant</th>
                  <th className={`${headerCellBase} w-24 text-right md:pr-3`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {localModels.map((model) => {
                  const isActive = inferenceStatus?.loadedModelId === model.id;
                  const isThisLoading = actionLoading === model.id;

                  return (
                    <tr
                      key={model.id}
                      className={`border-border-medium border-b last:border-b-0 ${
                        isActive ? "bg-green-500/5" : ""
                      }`}
                    >
                      <td className="max-w-[200px] truncate py-1.5 pl-2 md:pl-3">
                        <span className="text-xs font-medium" title={model.id}>
                          {model.name}
                        </span>
                        {isActive && (
                          <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-xs uppercase text-muted">{model.format}</td>
                      <td className="py-1.5 pr-2 text-right text-xs text-muted">
                        {formatBytes(model.sizeBytes)}
                      </td>
                      <td className="py-1.5 pr-2 text-xs text-muted">
                        {model.quantization ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right md:pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => void handleUnloadModel()}
                              disabled={actionLoading === "__unload__"}
                              title="Unload model"
                            >
                              {actionLoading === "__unload__" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Square className="h-3 w-3" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => void handleLoadModel(model.id)}
                              disabled={isThisLoading}
                              title="Load model"
                            >
                              {isThisLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </Button>
                          )}

                          {confirmDelete === model.id ? (
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1 text-[10px] text-red-500 hover:text-red-600"
                                onClick={() => void handleDeleteLocalModel(model.id)}
                                disabled={isThisLoading}
                              >
                                Delete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1 text-[10px]"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setConfirmDelete(model.id)}
                              disabled={isActive}
                              title={isActive ? "Unload model before deleting" : "Delete model"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-muted py-2 text-center text-xs">
            No local models cached. Pull a model from HuggingFace above.
          </div>
        )}

        {/* Pool Status */}
        {poolStatus && poolStatus.modelsLoaded > 0 && (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <div className="border-border-medium bg-background-secondary/50 flex items-center justify-between border-b px-2 py-1.5 md:px-3">
              <span className="text-muted text-xs font-medium">Model Pool</span>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <span>
                  {poolStatus.modelsLoaded}/{poolStatus.maxLoadedModels} loaded
                </span>
                <span>·</span>
                <span>
                  {formatBytes(poolStatus.estimatedVramBytes)} /{" "}
                  {formatBytes(poolStatus.memoryBudgetBytes)} VRAM
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => void refreshPoolStatus()}
                  title="Refresh"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
            {poolStatus.memoryBudgetBytes > 0 && (
              <div className="px-2 pt-1.5 md:px-3">
                <div className="bg-background-secondary h-1 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((poolStatus.estimatedVramBytes / poolStatus.memoryBudgetBytes) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-border-medium border-b">
                  <th className={`${headerCellBase} pl-2 text-left md:pl-3`}>Model</th>
                  <th className={`${headerCellBase} text-left`}>Backend</th>
                  <th className={`${headerCellBase} text-right`}>Memory</th>
                  <th className={`${headerCellBase} text-right`}>Uses</th>
                  <th className={`${headerCellBase} text-right md:pr-3`}>Last Used</th>
                </tr>
              </thead>
              <tbody>
                {poolStatus.loadedModels.map((m) => (
                  <tr key={m.model_id} className="border-border-medium border-b last:border-b-0">
                    <td className="max-w-[160px] truncate py-1.5 pl-2 text-xs md:pl-3">
                      <span className="font-medium" title={m.model_id}>
                        {m.model_id.split("/").pop() ?? m.model_id}
                      </span>
                      {m.alive && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-[10px] uppercase text-muted">{m.backend}</td>
                    <td className="py-1.5 pr-2 text-right text-xs text-muted">
                      {formatBytes(m.estimated_bytes)}
                    </td>
                    <td className="py-1.5 pr-2 text-right text-xs text-muted">{m.use_count}</td>
                    <td className="py-1.5 pr-2 text-right text-xs text-muted md:pr-3">
                      {m.last_used_at ? timeAgo(m.last_used_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cluster */}
        {inferenceStatus?.available && (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <div className="border-border-medium bg-background-secondary/50 flex items-center justify-between border-b px-2 py-1.5 md:px-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Network className="h-3 w-3" />
                LAN Cluster
              </span>
              <div className="flex items-center gap-2 text-[10px] text-muted">
                {clusterStatus && clusterStatus.total_nodes > 0 && (
                  <>
                    <span>
                      {clusterStatus.total_nodes} node{clusterStatus.total_nodes !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>
                      {clusterStatus.total_models} model{clusterStatus.total_models !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 gap-1 px-1.5 text-[10px]"
                  onClick={() => void handleDiscoverNodes()}
                  disabled={discovering}
                  title="Scan LAN for inference nodes via mDNS"
                >
                  {discovering ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <Radar className="h-2.5 w-2.5" />
                  )}
                  Discover
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => void refreshClusterStatus()}
                  title="Refresh"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
            {clusterStatus && clusterStatus.total_nodes > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-border-medium border-b">
                    <th className={`${headerCellBase} pl-2 text-left md:pl-3`}>Node</th>
                    <th className={`${headerCellBase} text-left`}>Status</th>
                    <th className={`${headerCellBase} text-left`}>GPU</th>
                    <th className={`${headerCellBase} text-right`}>Memory</th>
                    <th className={`${headerCellBase} text-right`}>Models</th>
                    <th className={`${headerCellBase} text-right`}>Active</th>
                    <th className={`${headerCellBase} text-right md:pr-3`}>tok/s</th>
                  </tr>
                </thead>
                <tbody>
                  {clusterStatus.nodes.map((node) => {
                    const memPercent =
                      node.total_memory_bytes > 0
                        ? Math.round((node.used_memory_bytes / node.total_memory_bytes) * 100)
                        : 0;
                    const isOnline = node.status === "online" || node.status === "active";

                    return (
                      <tr key={node.id} className="border-border-medium border-b last:border-b-0">
                        <td className="max-w-[120px] truncate py-1.5 pl-2 text-xs md:pl-3">
                          <span
                            className="font-medium"
                            title={`${node.name} (${node.address})`}
                          >
                            {node.name}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] ${
                              isOnline ? "text-green-500" : "text-amber-500"
                            }`}
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                isOnline ? "bg-green-500" : "bg-amber-500"
                              }`}
                            />
                            {node.status}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-[10px] text-muted">
                          {node.gpu_type || "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-xs text-muted">
                          <span
                            title={`${formatBytes(node.used_memory_bytes)} / ${formatBytes(node.total_memory_bytes)}`}
                          >
                            {memPercent}%
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-right text-xs text-muted">
                          {node.loaded_models.length}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-xs text-muted">
                          {node.active_inferences}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-xs text-muted md:pr-3">
                          {node.tokens_per_second_avg > 0
                            ? `${node.tokens_per_second_avg.toFixed(1)}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="px-2 py-2 text-center text-[10px] text-muted md:px-3">
                No nodes discovered yet. Click &ldquo;Discover&rdquo; to scan your LAN via mDNS.
              </div>
            )}
          </div>
        )}

        {/* Benchmark */}
        {inferenceStatus?.available && inferenceStatus.loadedModelId && (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <div className="bg-background-secondary/50 flex items-center justify-between px-2 py-1.5 md:px-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Timer className="h-3 w-3" />
                Quick Benchmark
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[10px]"
                onClick={() => void handleRunBenchmark(inferenceStatus.loadedModelId!)}
                disabled={benchmarking}
              >
                {benchmarking ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Play className="h-2.5 w-2.5" />
                )}
                {benchmarking ? "Running..." : "Run"}
              </Button>
            </div>
            {benchmarkResult && (
              <div className="border-border-medium grid grid-cols-3 gap-1.5 border-t px-2 py-2 md:px-3">
                <MetricCard
                  label="Tokens/sec"
                  value={benchmarkResult.tokensPerSecond > 0 ? benchmarkResult.tokensPerSecond.toFixed(1) : "—"}
                />
                <MetricCard
                  label="TTFT"
                  value={`${benchmarkResult.timeToFirstToken.toFixed(0)}ms`}
                />
                <MetricCard
                  label="Total Time"
                  value={`${(benchmarkResult.totalTime / 1000).toFixed(2)}s`}
                />
              </div>
            )}
          </div>
        )}

        {/* Metrics */}
        {inferenceStatus?.available && (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <div className="bg-background-secondary/50 flex items-center justify-between px-2 py-1.5 md:px-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Activity className="h-3 w-3" />
                Performance Metrics
              </span>
              <div className="flex items-center gap-1">
                {showMetrics && metrics && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 gap-1 px-1.5 text-[10px]"
                    onClick={() => {
                      void navigator.clipboard.writeText(metrics).then(() => {
                        setMetricsCopied(true);
                        setTimeout(() => setMetricsCopied(false), 2000);
                      });
                    }}
                    title="Copy Prometheus metrics (paste into Grafana)"
                  >
                    {metricsCopied ? (
                      <ClipboardCheck className="h-2.5 w-2.5 text-green-500" />
                    ) : (
                      <ClipboardCopy className="h-2.5 w-2.5" />
                    )}
                    {metricsCopied ? "Copied!" : "Copy"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px]"
                  onClick={() => setShowMetrics(!showMetrics)}
                >
                  {showMetrics ? "Hide" : "Show"}
                </Button>
              </div>
            </div>

            {showMetrics && (
              <div className="border-border-medium space-y-2 border-t px-2 py-2 md:px-3">
                {parsedMetrics && Object.keys(parsedMetrics).length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                    {parsedMetrics["inference_tokens_per_second"] != null && (
                      <MetricCard
                        label="Tokens/sec"
                        value={parsedMetrics["inference_tokens_per_second"].toFixed(1)}
                      />
                    )}
                    {parsedMetrics["inference_requests_total"] != null && (
                      <MetricCard
                        label="Total Requests"
                        value={Math.round(
                          parsedMetrics["inference_requests_total"]
                        ).toString()}
                      />
                    )}
                    {parsedMetrics["inference_active_requests"] != null && (
                      <MetricCard
                        label="Active"
                        value={Math.round(
                          parsedMetrics["inference_active_requests"]
                        ).toString()}
                      />
                    )}
                    {parsedMetrics["pool_loaded_models"] != null && (
                      <MetricCard
                        label="Loaded Models"
                        value={Math.round(parsedMetrics["pool_loaded_models"]).toString()}
                      />
                    )}
                    {parsedMetrics["pool_memory_used_bytes"] != null && (
                      <MetricCard
                        label="Memory Used"
                        value={formatBytes(parsedMetrics["pool_memory_used_bytes"])}
                      />
                    )}
                    {parsedMetrics["inference_latency_seconds"] != null && (
                      <MetricCard
                        label="Latency"
                        value={`${(parsedMetrics["inference_latency_seconds"] * 1000).toFixed(0)}ms`}
                      />
                    )}
                    {parsedMetrics["cluster_total_nodes"] != null && (
                      <MetricCard
                        label="Cluster Nodes"
                        value={Math.round(parsedMetrics["cluster_total_nodes"]).toString()}
                      />
                    )}
                    {parsedMetrics["inference_time_to_first_token_seconds"] != null && (
                      <MetricCard
                        label="TTFT"
                        value={`${(parsedMetrics["inference_time_to_first_token_seconds"] * 1000).toFixed(0)}ms`}
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-muted py-1 text-center text-[10px]">
                    No metrics yet. Run an inference to generate metrics.
                  </div>
                )}

                {metrics && (
                  <details className="text-[10px]">
                    <summary className="cursor-pointer text-muted hover:text-foreground">
                      Raw Prometheus metrics
                    </summary>
                    <pre className="bg-background-secondary mt-1 max-h-36 overflow-auto rounded p-1.5 text-[9px] leading-tight text-muted">
                      {metrics}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Transport & RDMA ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-muted flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <Cable className="h-3.5 w-3.5" />
            Transport & RDMA
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setShowTransport(!showTransport)}
          >
            {showTransport ? "Hide" : "Show"}
          </Button>
        </div>

        {showTransport && (
          <div className="border-border-medium space-y-3 rounded-md border p-3">
            {transportStatus ? (
              <>
                {/* RDMA Status Cards */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricCard
                    label="Mode"
                    value={transportStatus.rdma.mode || "none"}
                    icon={<Zap className="h-3 w-3" />}
                  />
                  <MetricCard
                    label="Backend"
                    value={transportStatus.rdma.backend || "tcp"}
                    icon={<Cable className="h-3 w-3" />}
                  />
                  <MetricCard
                    label="Bandwidth"
                    value={transportStatus.rdma.bandwidth_gbps > 0
                      ? `${transportStatus.rdma.bandwidth_gbps} Gbps`
                      : "N/A"
                    }
                    icon={<Activity className="h-3 w-3" />}
                  />
                  <MetricCard
                    label="RDMA"
                    value={transportStatus.rdma.available ? "Available" : "Unavailable"}
                    icon={transportStatus.rdma.available
                      ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                      : <XCircle className="h-3 w-3 text-muted" />
                    }
                  />
                </div>

                {/* RDMA status message */}
                {transportStatus.rdma.available ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-green-500">
                    <Zap className="h-3 w-3" />
                    {transportStatus.rdma.mode === "rdma-verbs"
                      ? "True zero-copy RDMA active — ~80-120 Gbps tensor transfer"
                      : "TCP-RDMA fallback active — ~40-80 Gbps optimized transfer"}
                  </div>
                ) : (
                  <div className="text-muted text-[10px]">
                    {transportStatus.rdma.error || "RDMA not available on this system. Using TCP transport."}
                  </div>
                )}

                {/* Device info */}
                {transportStatus.rdma.device && (
                  <div className="text-muted text-[10px]">
                    <span className="font-medium">Device:</span> {transportStatus.rdma.device}
                    {transportStatus.rdma.max_message_size > 0 && (
                      <span className="ml-2">
                        <span className="font-medium">Max msg:</span>{" "}
                        {(transportStatus.rdma.max_message_size / 1024 / 1024).toFixed(0)} MB
                      </span>
                    )}
                    {transportStatus.rdma.latency_us > 0 && (
                      <span className="ml-2">
                        <span className="font-medium">Latency:</span> {transportStatus.rdma.latency_us} μs
                      </span>
                    )}
                  </div>
                )}

                {/* Peer Transports Table */}
                {transportStatus.peer_transports.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-muted text-[10px] font-medium">Peer Topology</div>
                    <div className="border-border-medium overflow-hidden rounded border">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-border-medium bg-background-secondary/50 border-b">
                            <th className={`${headerCellBase} pl-2 text-left`}>Peer</th>
                            <th className={`${headerCellBase} text-left`}>Transport</th>
                            <th className={`${headerCellBase} text-right`}>Bandwidth</th>
                            <th className={`${headerCellBase} text-right`}>Latency</th>
                            <th className={`${headerCellBase} pr-2 text-right`}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transportStatus.peer_transports.map((peer) => (
                            <tr key={peer.peer_id} className="border-border-medium border-b last:border-b-0">
                              <td className="py-1 pl-2 font-mono">{peer.peer_name || peer.peer_id.slice(0, 8)}</td>
                              <td className="py-1">
                                <span className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-medium ${
                                  peer.transport === "rdma-verbs"
                                    ? "bg-green-500/10 text-green-500"
                                    : peer.transport === "tcp-rdma-fallback"
                                      ? "bg-yellow-500/10 text-yellow-500"
                                      : "bg-background-secondary text-muted"
                                }`}>
                                  {peer.transport === "rdma-verbs" && <Zap className="h-2.5 w-2.5" />}
                                  {peer.transport === "tcp-rdma-fallback" && <Cable className="h-2.5 w-2.5" />}
                                  {peer.transport === "tcp" && <Wifi className="h-2.5 w-2.5" />}
                                  {peer.transport}
                                </span>
                              </td>
                              <td className="py-1 text-right font-mono">{peer.bandwidth_gbps > 0 ? `${peer.bandwidth_gbps} Gbps` : "—"}</td>
                              <td className="py-1 text-right font-mono">{peer.latency_us > 0 ? `${peer.latency_us} μs` : "—"}</td>
                              <td className="py-1 pr-2 text-right">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${peer.connected ? "bg-green-500" : "bg-red-500"}`} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted py-2 text-center text-[10px]">
                Transport information unavailable. Go inference binary may not be running.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Device Hardware ────────────────────────────────────────────── */}
      {poolStatus && (
        <div className="space-y-3">
          <div className="text-muted flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <Monitor className="h-3.5 w-3.5" />
            Device Hardware
          </div>
          <div className="border-border-medium rounded-md border p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard label="Platform" value={navigator.platform || "Unknown"} />
              <MetricCard label="CPU Cores" value={String(navigator.hardwareConcurrency || "?")} />
              <MetricCard
                label="Memory Budget"
                value={poolStatus.memoryBudgetBytes > 0
                  ? `${(poolStatus.memoryBudgetBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
                  : "Unlimited"
                }
              />
              <MetricCard
                label="Est. VRAM Used"
                value={poolStatus.estimatedVramBytes > 0
                  ? `${(poolStatus.estimatedVramBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
                  : "0 GB"
                }
              />
            </div>
            {/* Memory usage bar */}
            {poolStatus.memoryBudgetBytes > 0 && (
              <div className="mt-2 space-y-0.5">
                <div className="flex justify-between text-[10px] text-muted">
                  <span>Memory Usage</span>
                  <span>{((poolStatus.estimatedVramBytes / poolStatus.memoryBudgetBytes) * 100).toFixed(0)}%</span>
                </div>
                <div className="bg-background-secondary h-1.5 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${
                      poolStatus.estimatedVramBytes / poolStatus.memoryBudgetBytes > 0.9
                        ? "bg-red-500"
                        : poolStatus.estimatedVramBytes / poolStatus.memoryBudgetBytes > 0.7
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (poolStatus.estimatedVramBytes / poolStatus.memoryBudgetBytes) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Built-in Models ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-muted text-xs font-medium tracking-wide uppercase">
          Built-in Models
        </div>
        <div className="border-border-medium overflow-hidden rounded-md border">
          <table className="w-full">
            <ModelsTableHeader />
            <tbody>
              {builtInModels.map((model) => (
                <ModelRow
                  key={model.fullId}
                  provider={model.provider}
                  modelId={model.modelId}
                  fullId={model.fullId}
                  aliases={model.aliases}
                  isCustom={false}
                  isDefault={defaultModel === model.fullId}
                  isEditing={false}
                  onSetDefault={() => setDefaultModel(model.fullId)}
                  isHiddenFromSelector={hiddenModels.includes(model.fullId)}
                  onToggleVisibility={() =>
                    hiddenModels.includes(model.fullId)
                      ? unhideModel(model.fullId)
                      : hideModel(model.fullId)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
