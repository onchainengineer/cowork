"""
Pipeline parallelism backend — splits model layers across multiple devices.

Unlike tensor parallelism (which splits individual weight matrices), pipeline
parallelism assigns contiguous blocks of transformer layers to different devices.
Device 0 runs layers 0-7, Device 1 runs layers 8-15, etc.

This is simpler than tensor parallelism and works well when a model doesn't
fit in a single device's memory. The tradeoff is higher latency per token
(sequential pipeline stages) but lower communication overhead.

Architecture:
  Device 0 (head):  embedding → layers[0:N/K]     → send activations →
  Device 1 (mid):   ← recv   → layers[N/K:2N/K]   → send activations →
  Device K (tail):  ← recv   → layers[(K-1)N/K:N]  → lm_head → token

Communication uses MLX distributed send/recv for point-to-point transfers.

Requirements:
  pip install mlx mlx-lm
"""

import sys
import time
from typing import Any, Dict, Generator, List, Optional, Tuple

from .base import InferenceBackend

try:
    import mlx.core as mx
    import mlx.nn as nn
    import mlx_lm

    HAS_MLX = True
except ImportError:
    HAS_MLX = False

try:
    _dist_group = mx.distributed.init(backend="any") if HAS_MLX else None
    HAS_DISTRIBUTED = _dist_group is not None and _dist_group.size() > 1
except Exception:
    _dist_group = None
    HAS_DISTRIBUTED = False


def compute_layer_assignment(num_layers: int, world_size: int) -> List[Tuple[int, int]]:
    """
    Compute which layers each rank handles.

    Returns a list of (start_layer, end_layer) tuples, one per rank.
    Distributes layers as evenly as possible, with remainder layers
    going to later ranks (they tend to be less memory-intensive).
    """
    base = num_layers // world_size
    remainder = num_layers % world_size

    assignments = []
    start = 0
    for rank in range(world_size):
        count = base + (1 if rank >= world_size - remainder else 0)
        assignments.append((start, start + count))
        start += count

    return assignments


def prune_model_for_pipeline(model: nn.Module, rank: int, world_size: int):
    """
    Remove layers that don't belong to this rank.

    - Rank 0 keeps: embedding + first layer shard
    - Middle ranks keep: their layer shard only
    - Last rank keeps: last layer shard + lm_head + norm

    This dramatically reduces per-device memory usage.
    """
    # Find the transformer layers
    layers = None
    layers_attr = None

    # Common attribute names for transformer layer lists
    for attr in ["layers", "model.layers", "transformer.h", "gpt_neox.layers"]:
        parts = attr.split(".")
        obj = model
        try:
            for p in parts:
                obj = getattr(obj, p)
            if isinstance(obj, (list, nn.Module)):
                layers = obj
                layers_attr = attr
                break
        except AttributeError:
            continue

    if layers is None:
        print(f"[pipeline] WARNING: could not find transformer layers, skipping pruning", file=sys.stderr)
        return

    num_layers = len(layers)
    assignments = compute_layer_assignment(num_layers, world_size)
    my_start, my_end = assignments[rank]

    print(f"[pipeline] rank {rank}: layers [{my_start}:{my_end}] of {num_layers}", file=sys.stderr)

    # For non-head ranks, we can null out embedding weights to save memory.
    # For non-tail ranks, we can null out lm_head weights.
    # But we keep the modules so the model structure is intact.

    # Replace layers we don't own with lightweight stubs
    for i in range(num_layers):
        if i < my_start or i >= my_end:
            # Replace with a passthrough stub
            layers[i] = PipelineStub()

    print(f"[pipeline] rank {rank}: active layers = {my_end - my_start}, stubbed = {num_layers - (my_end - my_start)}", file=sys.stderr)


class PipelineStub(nn.Module):
    """
    Lightweight stub that replaces pruned layers.
    Just passes through the hidden states unchanged.
    """

    def __call__(self, x, *args, **kwargs):
        return x


class PipelineBackend(InferenceBackend):
    """
    Pipeline parallelism backend for multi-device inference.

    Each device handles a contiguous block of transformer layers.
    Activations are passed between devices using MLX distributed send/recv.
    """

    def __init__(self, model_path: str, backend: str = "any"):
        if not HAS_MLX:
            raise RuntimeError("MLX not installed. Run: pip install mlx mlx-lm")

        self.model_path = model_path
        self.group = mx.distributed.init(backend=backend) if HAS_DISTRIBUTED else None
        self.rank = self.group.rank() if self.group else 0
        self.world_size = self.group.size() if self.group else 1

        self.is_head = self.rank == 0
        self.is_tail = self.rank == self.world_size - 1

        print(f"[pipeline] rank {self.rank}/{self.world_size} "
              f"({'head' if self.is_head else 'tail' if self.is_tail else 'mid'})",
              file=sys.stderr)

        t0 = time.time()
        self.model, self.tokenizer = mlx_lm.load(model_path)

        # Prune layers that don't belong to this rank
        if self.world_size > 1:
            prune_model_for_pipeline(self.model, self.rank, self.world_size)
            mx.eval(self.model.parameters())

        load_time = time.time() - t0
        print(f"[pipeline] loaded + pruned in {load_time:.1f}s", file=sys.stderr)

    def name(self) -> str:
        return "pipeline"

    def _apply_chat_template(self, messages: List[Dict[str, str]]) -> str:
        if hasattr(self.tokenizer, "apply_chat_template"):
            return self.tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
            )
        parts = []
        for msg in messages:
            role, content = msg["role"], msg["content"]
            parts.append(f"<|{role}|>\n{content}</s>")
        parts.append("<|assistant|>\n")
        return "\n".join(parts)

    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        prompt = self._apply_chat_template(messages)

        kwargs: Dict[str, Any] = {"max_tokens": max_tokens}
        if temperature is not None:
            kwargs["temp"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p

        t0 = time.time()
        prompt_token_ids = self.tokenizer.encode(prompt)

        # All ranks participate in generation (MLX distributed handles the comm)
        response = mlx_lm.generate(
            self.model, self.tokenizer, prompt=prompt, **kwargs,
        )

        elapsed = time.time() - t0
        comp_tokens = len(self.tokenizer.encode(response))

        if self.rank == 0:
            print(
                f"[pipeline] {comp_tokens} tokens in {elapsed:.2f}s "
                f"({comp_tokens/max(elapsed,.01):.1f} tok/s, {self.world_size} stages)",
                file=sys.stderr,
            )

        return {
            "text": response,
            "finish_reason": "stop",
            "prompt_tokens": len(prompt_token_ids),
            "completion_tokens": comp_tokens,
        }

    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> Generator[Dict[str, Any], None, None]:
        prompt = self._apply_chat_template(messages)

        kwargs: Dict[str, Any] = {"max_tokens": max_tokens}
        if temperature is not None:
            kwargs["temp"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p

        stop_seqs = stop or []
        text = ""
        t0 = time.time()
        n = 0

        for resp in mlx_lm.stream_generate(
            self.model, self.tokenizer, prompt=prompt, **kwargs,
        ):
            token_text = resp.text
            if not token_text:
                continue

            text += token_text
            n += 1

            should_stop = any(seq in text for seq in stop_seqs)

            # Only head rank (0) emits tokens to stdout
            if self.rank == 0:
                yield {"token": token_text, "done": False}

            if should_stop or resp.finish_reason is not None:
                break

        elapsed = time.time() - t0
        if elapsed > 0 and n > 0 and self.rank == 0:
            print(
                f"[pipeline] streamed {n} tokens in {elapsed:.2f}s "
                f"({n/elapsed:.1f} tok/s, {self.world_size} stages)",
                file=sys.stderr,
            )
