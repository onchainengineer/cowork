/**
 * Lattice Inference — Local on-device inference for Mux.
 *
 * Re-exports the public API for the inference subsystem.
 */

export { InferenceService } from "./inferenceService";
export type { InferenceServiceEvents } from "./inferenceService";
export { LatticeLanguageModel } from "./latticeLanguageModel";
export { PythonWorkerManager } from "./workerManager";
export { ModelRegistry } from "./modelRegistry";
export { HfDownloader } from "./hfDownloader";
export { detectPython, detectBackend, findWorkerScript, checkPythonDependencies } from "./backendDetection";
export type {
  ChatMessage,
  GenerateParams,
  GenerateResult,
  StreamToken,
  ModelInfo,
  ModelManifest,
  DownloadProgress,
} from "./types";
