import { useEffect, useState, useCallback } from "react";
import { useAPI } from "@/browser/contexts/API";

interface ModelInfo {
  id: string;
  name: string;
  huggingFaceRepo?: string;
  format: "mlx" | "gguf" | "pytorch" | "unknown";
  sizeBytes: number;
  parameterCount?: number;
  quantization?: string;
  localPath: string;
  backend?: string;
  pulledAt?: string;
}

interface InferenceStatus {
  available: boolean;
  loadedModelId: string | null;
}

interface DownloadProgress {
  fileName: string;
  downloadedBytes: number;
  totalBytes: number;
}

export function useInference() {
  const { api } = useAPI();
  const [status, setStatus] = useState<InferenceStatus | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [pulling, setPulling] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshModels = useCallback(async () => {
    if (!api) return;
    try {
      const list = await api.inference.listModels();
      setModels(list);
    } catch {
      // Service may not be available
    }
  }, [api]);

  // Initial fetch + subscriptions
  useEffect(() => {
    if (!api) return;
    const ac = new AbortController();

    void refreshModels().finally(() => setLoading(false));

    // Subscribe to status changes (yields initial value)
    void (async () => {
      try {
        const iter = await api.inference.onStatusChanged(undefined, { signal: ac.signal });
        for await (const s of iter) {
          if (ac.signal.aborted) break;
          setStatus(s);
        }
      } catch {
        // Aborted or unavailable
      }
    })();

    // Subscribe to download progress
    void (async () => {
      try {
        const iter = await api.inference.onDownloadProgress(undefined, { signal: ac.signal });
        for await (const p of iter) {
          if (ac.signal.aborted) break;
          setDownloadProgress(p);
        }
      } catch {
        // Aborted or unavailable
      }
    })();

    return () => ac.abort();
  }, [api, refreshModels]);

  const pullModel = useCallback(
    async (modelId: string) => {
      if (!api) return;
      setPulling(true);
      setDownloadProgress(null);
      try {
        await api.inference.pullModel({ modelId });
        await refreshModels();
      } finally {
        setPulling(false);
        setDownloadProgress(null);
      }
    },
    [api, refreshModels],
  );

  const deleteModel = useCallback(
    async (modelId: string) => {
      if (!api) return;
      await api.inference.deleteModel({ modelId });
      await refreshModels();
    },
    [api, refreshModels],
  );

  const loadModel = useCallback(
    async (modelId: string, backend?: string) => {
      if (!api) return;
      await api.inference.loadModel({ modelId, backend });
    },
    [api],
  );

  const unloadModel = useCallback(async () => {
    if (!api) return;
    await api.inference.unloadModel();
  }, [api]);

  return {
    status,
    models,
    loading,
    pulling,
    downloadProgress,
    pullModel,
    deleteModel,
    loadModel,
    unloadModel,
    refreshModels,
  };
}
