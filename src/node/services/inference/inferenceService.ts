/**
 * Inference Service — Top-level orchestrator for local on-device inference.
 *
 * Owns the full lifecycle:
 * - Model registry (list, inspect, delete cached models)
 * - HuggingFace downloader (pull models with resume support)
 * - Python worker manager (spawn, health-check, shutdown)
 * - LatticeLanguageModel (Vercel AI SDK bridge)
 *
 * Used by AIService to provide `lattice-inference` as a local provider.
 */

import { EventEmitter } from "events";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { ModelRegistry } from "./modelRegistry";
import { HfDownloader } from "./hfDownloader";
import { PythonWorkerManager } from "./workerManager";
import { LatticeLanguageModel } from "./latticeLanguageModel";
import { detectPython, checkPythonDependencies } from "./backendDetection";
import type { DownloadProgress, ModelInfo } from "./types";
import { log } from "@/node/services/log";

const VENV_DIR = path.join(os.homedir(), ".lattice", "inference-venv");

export interface InferenceServiceEvents {
  "model-loaded": [modelId: string];
  "model-unloaded": [];
  "download-progress": [progress: DownloadProgress];
  error: [error: Error];
}

export class InferenceService extends EventEmitter {
  private registry: ModelRegistry;
  private downloader: HfDownloader;
  private workerManager: PythonWorkerManager | null = null;
  private activeModel: LatticeLanguageModel | null = null;
  private activeModelId: string | null = null;
  private pythonAvailable: boolean | null = null;
  private rootDir: string;

  constructor(rootDir: string, appResourcesPath?: string) {
    super();
    this.rootDir = rootDir;
    this.registry = new ModelRegistry();
    this.downloader = new HfDownloader(this.registry.getCacheDir());
    this.workerManager = new PythonWorkerManager(appResourcesPath);
  }

  /**
   * Initialize the inference service.
   * Checks for Python availability and backend dependencies.
   */
  async initialize(): Promise<void> {
    try {
      await this.ensurePythonEnv();
      const pythonPath = detectPython();
      const deps = await checkPythonDependencies(pythonPath);
      this.pythonAvailable = deps.available;
      log.info(
        `[inference] initialized: python=${pythonPath}, available=${deps.available}, backend=${deps.backend}`,
      );
    } catch (err) {
      this.pythonAvailable = false;
      log.warn("[inference] Python setup failed — local inference unavailable");
    }
  }

  /**
   * Whether local inference is available (Python + deps found).
   */
  get isAvailable(): boolean {
    return this.pythonAvailable === true;
  }

  /**
   * The currently loaded model ID, or null.
   */
  get loadedModelId(): string | null {
    return this.activeModelId;
  }

  // ─── Model Registry ─────────────────────────────────────────────────

  /**
   * List all cached models.
   */
  async listModels(): Promise<ModelInfo[]> {
    return this.registry.listModels();
  }

  /**
   * Get info for a specific model.
   */
  async getModel(id: string): Promise<ModelInfo | null> {
    return this.registry.getModel(id);
  }

  /**
   * Delete a cached model.
   */
  async deleteModel(id: string): Promise<void> {
    // Unload if this is the active model
    if (this.activeModelId === id) {
      await this.unloadModel();
    }
    await this.registry.deleteModel(id);
  }

  // ─── Model Download ─────────────────────────────────────────────────

  /**
   * Pull (download) a model from HuggingFace Hub.
   *
   * @param modelID - e.g. "mlx-community/Llama-3.2-3B-Instruct-4bit"
   * @param signal - Optional AbortSignal for cancellation
   * @returns Path to the downloaded model directory
   */
  async pullModel(
    modelID: string,
    signal?: AbortSignal,
  ): Promise<string> {
    // Forward download progress events
    const onProgress = (progress: DownloadProgress) => {
      this.emit("download-progress", progress);
    };

    this.downloader.on("progress", onProgress);

    try {
      const modelDir = await this.downloader.pull(modelID, signal);
      log.info(`[inference] pulled model ${modelID} → ${modelDir}`);
      return modelDir;
    } finally {
      this.downloader.off("progress", onProgress);
    }
  }

  // ─── Model Loading ──────────────────────────────────────────────────

  /**
   * Load a model and start the Python worker.
   *
   * @param modelID - HuggingFace model ID or partial name
   * @param backend - Optional backend override (mlx, llamacpp, etc.)
   */
  async loadModel(modelID: string, backend?: string): Promise<void> {
    // If already loaded, skip
    if (this.activeModelId === modelID && this.workerManager?.alive) {
      return;
    }

    // Find the model in the registry
    let model = await this.registry.getModel(modelID);

    if (!model) {
      // Try pulling it
      log.info(`[inference] model ${modelID} not found locally, pulling...`);
      await this.pullModel(modelID);
      model = await this.registry.getModel(modelID);
    }

    if (!model) {
      throw new Error(`Model ${modelID} not found and could not be downloaded`);
    }

    // Unload any existing model
    if (this.activeModelId) {
      await this.unloadModel();
    }

    // Start the Python worker
    if (!this.workerManager) {
      this.workerManager = new PythonWorkerManager();
    }

    await this.workerManager.start(model.localPath, backend);

    this.activeModelId = modelID;
    this.activeModel = new LatticeLanguageModel(modelID, this.workerManager);

    log.info(
      `[inference] model loaded: ${modelID} (backend=${this.workerManager.backend})`,
    );
    this.emit("model-loaded", modelID);
  }

  /**
   * Unload the current model and stop the Python worker.
   */
  async unloadModel(): Promise<void> {
    if (this.workerManager?.alive) {
      await this.workerManager.stop();
    }

    this.activeModel = null;
    this.activeModelId = null;

    log.info("[inference] model unloaded");
    this.emit("model-unloaded");
  }

  // ─── Language Model ─────────────────────────────────────────────────

  /**
   * Get the LanguageModelV2 for the currently loaded model.
   * This is what gets passed to `streamText()` in the AI SDK.
   */
  getLanguageModel(modelId?: string): LanguageModelV2 {
    if (!this.activeModel) {
      throw new Error(
        "No model loaded. Call loadModel() first.",
      );
    }

    // If a specific model is requested, verify it matches
    if (modelId && this.activeModelId !== modelId) {
      throw new Error(
        `Requested model ${modelId} but ${this.activeModelId} is loaded. Call loadModel() first.`,
      );
    }

    return this.activeModel;
  }

  // ─── Python Environment ─────────────────────────────────────────────

  /**
   * Auto-create the inference Python venv and install backend dependencies.
   * Runs once on first launch. Skips if venv already exists.
   *
   * Steps:
   *   1. Find system python3
   *   2. Create ~/.lattice/inference-venv if missing
   *   3. pip install mlx-lm (Apple Silicon) or llama-cpp-python (NVIDIA/CPU)
   */
  private async ensurePythonEnv(): Promise<void> {
    const venvPython = path.join(VENV_DIR, "bin", "python3");

    // Already set up
    if (fs.existsSync(venvPython)) {
      log.info("[inference] venv exists at " + VENV_DIR);
      return;
    }

    // Find system Python to bootstrap the venv
    let systemPython = "";
    for (const name of ["python3", "python"]) {
      try {
        systemPython = execSync(`which ${name}`, { encoding: "utf-8", timeout: 5000 }).trim();
        if (systemPython) break;
      } catch {
        // Not found
      }
    }

    if (!systemPython) {
      log.warn("[inference] No system Python found — cannot auto-setup venv");
      return;
    }

    log.info(`[inference] creating venv at ${VENV_DIR} using ${systemPython}...`);

    // Create the venv
    try {
      fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });
      execSync(`"${systemPython}" -m venv "${VENV_DIR}"`, {
        encoding: "utf-8",
        timeout: 60_000,
      });
    } catch (err) {
      log.warn(`[inference] failed to create venv: ${err}`);
      return;
    }

    // Install backend deps based on platform
    const pip = path.join(VENV_DIR, "bin", "pip");
    const deps =
      process.platform === "darwin" && process.arch === "arm64"
        ? "mlx mlx-lm"
        : "llama-cpp-python";

    log.info(`[inference] installing ${deps}...`);

    try {
      execSync(`"${pip}" install --upgrade pip ${deps}`, {
        encoding: "utf-8",
        timeout: 300_000, // 5 min for compilation
        env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: "1" },
      });
      log.info("[inference] Python environment ready");
    } catch (err) {
      log.warn(`[inference] failed to install deps: ${err}`);
      // Venv created but deps failed — checkPythonDependencies will report unavailable
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Dispose all resources. Called on app shutdown.
   */
  async dispose(): Promise<void> {
    await this.unloadModel();
    log.info("[inference] service disposed");
  }
}
