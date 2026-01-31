/**
 * Shared types for the Lattice Inference engine.
 *
 * These mirror the JSON-RPC protocol spoken by the Python worker (worker.py)
 * and the Go worker manager that we're replacing with Node.js.
 */

// ─── JSON-RPC 2.0 ──────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
}

// ─── Streaming ──────────────────────────────────────────────────────────

/** A single streaming token emitted by the Python worker. */
export interface StreamToken {
  token: string;
  done: boolean;
  error?: string;
}

// ─── Inference request / response ───────────────────────────────────────

export interface ChatMessage {
  role: string;
  content: string;
}

export interface GenerateParams {
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string[];
}

export interface GenerateResult {
  text: string;
  finish_reason: string;
  prompt_tokens: number;
  completion_tokens: number;
}

// ─── Model registry ─────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  huggingFaceRepo?: string;
  format: "mlx" | "gguf" | "pytorch" | "unknown";
  sizeBytes: number;
  parameterCount?: number;
  quantization?: string;
  localPath: string;
  backend?: string;
  pulledAt?: string; // ISO date
}

/** Manifest written to .lattice-model.json after a successful pull. */
export interface ModelManifest {
  id: string;
  name: string;
  huggingface_repo: string;
  local_path: string;
  pulled_at: string; // ISO date
  parameter_count?: number;
  quantization?: string;
}

// ─── Download progress ──────────────────────────────────────────────────

export interface DownloadProgress {
  fileName: string;
  downloadedBytes: number;
  totalBytes: number;
}

// ─── HuggingFace API ────────────────────────────────────────────────────

export interface HFFile {
  rfilename: string;
  size: number;
}

export interface HFRepoInfo {
  siblings: HFFile[];
}
