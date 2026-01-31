import React, { useState } from "react";
import {
  Download,
  Loader2,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/browser/components/ui/button";
import { Input } from "@/browser/components/ui/input";
import { useInference } from "@/browser/hooks/useInference";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

const headerCellBase = "py-1.5 pr-2 text-xs font-medium text-muted";

export function LocalModelsSection() {
  const {
    status,
    models,
    loading,
    pulling,
    downloadProgress,
    pullModel,
    deleteModel,
    loadModel,
    unloadModel,
  } = useInference();

  const [modelIdInput, setModelIdInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handlePull = async () => {
    const id = modelIdInput.trim();
    if (!id) return;
    await pullModel(id);
    setModelIdInput("");
  };

  const handleLoad = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await loadModel(modelId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnload = async () => {
    setActionLoading("__unload__");
    try {
      await unloadModel();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (modelId: string) => {
    setActionLoading(modelId);
    try {
      await deleteModel(modelId);
    } finally {
      setActionLoading(null);
      setConfirmDelete(null);
    }
  };

  const progressPercent =
    downloadProgress && downloadProgress.totalBytes > 0
      ? Math.round((downloadProgress.downloadedBytes / downloadProgress.totalBytes) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Status Banner */}
      <div className="flex items-center gap-2 text-sm">
        {status?.available ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-foreground">
              Python inference backend ready
              {status.loadedModelId && (
                <span className="text-muted ml-1">
                  — active: <span className="text-foreground font-medium">{status.loadedModelId}</span>
                </span>
              )}
            </span>
          </>
        ) : status ? (
          <>
            <XCircle className="h-4 w-4 text-amber-500" />
            <span className="text-muted">
              Python inference not available. Install Python 3 and restart, or run{" "}
              <code className="bg-background-secondary rounded px-1 text-xs">
                pip install mlx mlx-lm
              </code>
            </span>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted" />
            <span className="text-muted">Checking inference availability...</span>
          </>
        )}
      </div>

      {/* Pull Model Form */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Pull Model from HuggingFace</label>
        <div className="flex gap-2">
          <Input
            value={modelIdInput}
            onChange={(e) => setModelIdInput(e.target.value)}
            placeholder="e.g. mlx-community/Qwen2.5-1.5B-Instruct-4bit"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pulling) void handlePull();
            }}
            disabled={pulling}
          />
          <Button
            size="sm"
            onClick={() => void handlePull()}
            disabled={pulling || !modelIdInput.trim()}
          >
            {pulling ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            Pull
          </Button>
        </div>

        {/* Download Progress */}
        {pulling && downloadProgress && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{downloadProgress.fileName}</span>
              <span>
                {formatBytes(downloadProgress.downloadedBytes)} / {formatBytes(downloadProgress.totalBytes)}
                {" "}({progressPercent}%)
              </span>
            </div>
            <div className="bg-background-secondary h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Models Table */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Cached Models</label>

        {loading ? (
          <div className="text-muted flex items-center gap-2 py-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading models...
          </div>
        ) : models.length === 0 ? (
          <div className="text-muted py-4 text-center text-sm">
            No local models cached. Pull a model from HuggingFace to get started.
          </div>
        ) : (
          <div className="border-border-medium overflow-hidden rounded-md border">
            <table className="w-full text-sm">
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
                {models.map((model) => {
                  const isActive = status?.loadedModelId === model.id;
                  const isThisLoading = actionLoading === model.id;

                  return (
                    <tr
                      key={model.id}
                      className={`border-border-medium border-b last:border-b-0 ${
                        isActive ? "bg-green-500/5" : ""
                      }`}
                    >
                      <td className="max-w-[200px] truncate py-2 pl-2 md:pl-3">
                        <span className="font-medium" title={model.id}>
                          {model.name}
                        </span>
                        {isActive && (
                          <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </td>
                      <td className="py-2 pr-2 uppercase text-muted">{model.format}</td>
                      <td className="py-2 pr-2 text-right text-muted">
                        {formatBytes(model.sizeBytes)}
                      </td>
                      <td className="py-2 pr-2 text-muted">{model.quantization ?? "—"}</td>
                      <td className="py-2 pr-2 text-right md:pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Load / Unload */}
                          {isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => void handleUnload()}
                              disabled={actionLoading === "__unload__"}
                              title="Unload model"
                            >
                              {actionLoading === "__unload__" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Square className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => void handleLoad(model.id)}
                              disabled={isThisLoading}
                              title="Load model"
                            >
                              {isThisLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}

                          {/* Delete */}
                          {confirmDelete === model.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 text-xs text-red-500 hover:text-red-600"
                                onClick={() => void handleDelete(model.id)}
                                disabled={isThisLoading}
                              >
                                Delete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 text-xs"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setConfirmDelete(model.id)}
                              disabled={isActive}
                              title={isActive ? "Unload model before deleting" : "Delete model"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        )}
      </div>
    </div>
  );
}
