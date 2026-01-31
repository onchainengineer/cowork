"""
llama.cpp inference backend for NVIDIA GPU and CPU.

Uses llama-cpp-python bindings. Supports:
  - NVIDIA GPU via CUDA (single and multi-GPU)
  - Apple Metal (via llama.cpp Metal support)
  - CPU fallback
  - GGUF model format

Requirements:
  pip install llama-cpp-python
  # For CUDA: CMAKE_ARGS="-DGGML_CUDA=on" pip install llama-cpp-python
  # For Metal: CMAKE_ARGS="-DGGML_METAL=on" pip install llama-cpp-python
"""

import glob
import os
import platform
import sys
import time
from typing import Any, Dict, Generator, List, Optional

from .base import InferenceBackend

try:
    from llama_cpp import Llama

    HAS_LLAMACPP = True
except ImportError:
    HAS_LLAMACPP = False


def _detect_gpu_layers() -> int:
    """Determine optimal number of GPU layers based on available hardware."""
    # Check for NVIDIA GPU
    try:
        from .cuda_utils import detect_nvidia_gpus
        gpus = detect_nvidia_gpus()
        if gpus:
            total_vram_mb = sum(g.memory_free_mb for g in gpus)
            print(f"[llamacpp] NVIDIA GPU detected: {gpus[0].name}, "
                  f"{total_vram_mb}MB free VRAM across {len(gpus)} GPU(s)", file=sys.stderr)
            return -1  # All layers
    except ImportError:
        pass

    # Check for Apple Metal
    if platform.system() == "Darwin":
        print("[llamacpp] Apple Metal available", file=sys.stderr)
        return -1

    print("[llamacpp] no GPU detected, using CPU", file=sys.stderr)
    return 0


class LlamaCppBackend(InferenceBackend):
    """llama.cpp inference backend for NVIDIA/Metal/CPU."""

    def __init__(self, model_path: str):
        if not HAS_LLAMACPP:
            raise RuntimeError(
                "llama-cpp-python not installed. Run:\n"
                "  pip install llama-cpp-python\n"
                "For NVIDIA GPU:\n"
                "  CMAKE_ARGS='-DGGML_CUDA=on' pip install llama-cpp-python\n"
                "For Apple Metal:\n"
                "  CMAKE_ARGS='-DGGML_METAL=on' pip install llama-cpp-python"
            )

        gguf_file = self._find_gguf(model_path)
        n_gpu_layers = _detect_gpu_layers()

        # Check for multi-GPU (tensor split)
        tensor_split = None
        try:
            from .cuda_utils import detect_nvidia_gpus
            gpus = detect_nvidia_gpus()
            if len(gpus) > 1:
                total_free = sum(g.memory_free_mb for g in gpus)
                tensor_split = [g.memory_free_mb / total_free for g in gpus]
                print(f"[llamacpp] multi-GPU tensor split: {tensor_split}", file=sys.stderr)
        except ImportError:
            pass

        print(f"[llamacpp] loading {gguf_file} (gpu_layers={n_gpu_layers})...", file=sys.stderr)
        t0 = time.time()

        kwargs: Dict[str, Any] = {
            "model_path": gguf_file,
            "n_ctx": 8192,
            "n_gpu_layers": n_gpu_layers,
            "verbose": False,
        }
        if tensor_split is not None:
            kwargs["tensor_split"] = tensor_split

        self.llm = Llama(**kwargs)
        print(f"[llamacpp] loaded in {time.time()-t0:.1f}s", file=sys.stderr)

    @staticmethod
    def _find_gguf(model_path: str) -> str:
        if model_path.endswith(".gguf"):
            return model_path
        files = glob.glob(os.path.join(model_path, "*.gguf"))
        if not files:
            raise FileNotFoundError(f"No .gguf file in {model_path}")
        preferred_quants = ["q4_k_m", "q4_0", "q5_k_m", "q8_0", "q4_k_s", "q6_k"]
        for f in sorted(files):
            if any(q in f.lower() for q in preferred_quants):
                return f
        return files[0]

    def name(self) -> str:
        return "llamacpp"

    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        kwargs: Dict[str, Any] = {"max_tokens": max_tokens}
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p
        if stop:
            kwargs["stop"] = stop

        t0 = time.time()
        result = self.llm.create_chat_completion(messages=messages, **kwargs)
        elapsed = time.time() - t0

        choice = result["choices"][0]
        usage = result.get("usage", {})
        ct = usage.get("completion_tokens", 0)
        print(f"[llamacpp] {ct} tokens in {elapsed:.2f}s ({ct/max(elapsed,.01):.1f} tok/s)", file=sys.stderr)

        return {
            "text": choice["message"]["content"],
            "finish_reason": choice.get("finish_reason", "stop"),
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": ct,
        }

    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        kwargs: Dict[str, Any] = {"max_tokens": max_tokens, "stream": True}
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p
        if stop:
            kwargs["stop"] = stop

        t0 = time.time()
        n = 0
        for chunk in self.llm.create_chat_completion(messages=messages, **kwargs):
            delta = chunk["choices"][0].get("delta", {})
            content = delta.get("content", "")
            if content:
                n += 1
                yield {"token": content, "done": False}

        elapsed = time.time() - t0
        if elapsed > 0 and n > 0:
            print(f"[llamacpp] streamed {n} tokens in {elapsed:.2f}s ({n/elapsed:.1f} tok/s)", file=sys.stderr)
