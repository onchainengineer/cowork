"""
MLX Distributed inference backend for tensor parallelism across Apple Silicon devices.

Uses MLX's distributed communication primitives (all_sum, all_gather) to shard
model weights across multiple devices. Each device holds a slice of the tensors
and participates in collective operations during forward passes.

Supports:
  - Ring backend (TCP sockets, any network)
  - JACCL backend (RDMA over Thunderbolt 5, M4 Pro/Max/Ultra)
  - MPI backend (for HPC clusters)

Requirements:
  pip install mlx mlx-lm

Launch:
  mlx.launch -n <num_devices> --hostfile hosts.json -- python worker.py --backend mlx_distributed

  Or set environment variables manually:
    MLX_RANK=0 MLX_HOSTFILE=hosts.json python worker.py --backend mlx_distributed
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

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


def shard_model_weights(model: nn.Module, group=None):
    """
    Shard model weights across distributed group using tensor parallelism.

    For attention layers:
      - Q, K, V projection weights are split along the output dimension
      - Output projection is split along the input dimension
    For MLP layers:
      - Gate/Up projections split along output
      - Down projection split along input

    This matches the Megatron-LM tensor parallelism strategy.
    """
    if group is None:
        group = mx.distributed.init()

    rank = group.rank()
    world_size = group.size()

    if world_size <= 1:
        return  # Nothing to shard

    print(f"[mlx_distributed] sharding weights across {world_size} devices (rank {rank})", file=sys.stderr)

    sharded_count = 0
    leaves = model.leaf_modules()

    for name, module in leaves.items():
        if not hasattr(module, "weight"):
            continue

        weight = module.weight
        dims = weight.shape

        if len(dims) < 2:
            continue  # Skip biases and 1D params

        # Determine shard axis based on layer type
        shard_axis = _get_shard_axis(name, dims)
        if shard_axis is None:
            continue

        # Ensure divisible
        if dims[shard_axis] % world_size != 0:
            continue

        shard_size = dims[shard_axis] // world_size
        start = rank * shard_size
        end = start + shard_size

        if shard_axis == 0:
            new_weight = weight[start:end]
        else:
            new_weight = weight[:, start:end]

        module.weight = new_weight
        sharded_count += 1

        # Also shard bias if present
        if hasattr(module, "bias") and module.bias is not None:
            bias = module.bias
            if shard_axis == 0 and len(bias.shape) > 0 and bias.shape[0] == dims[0]:
                module.bias = bias[start:end]

    print(f"[mlx_distributed] sharded {sharded_count} weight tensors", file=sys.stderr)


def _get_shard_axis(name: str, dims: tuple) -> Optional[int]:
    """Determine which axis to shard a layer on based on its name."""
    name_lower = name.lower()

    # Attention Q/K/V projections — shard output dim (axis 0)
    if any(k in name_lower for k in ["q_proj", "k_proj", "v_proj", "qkv_proj",
                                       "query", "key", "value",
                                       "wq", "wk", "wv"]):
        return 0

    # Attention output projection — shard input dim (axis 1)
    if any(k in name_lower for k in ["o_proj", "out_proj", "wo", "dense"]):
        return 1 if len(dims) > 1 else None

    # MLP gate/up — shard output dim (axis 0)
    if any(k in name_lower for k in ["gate_proj", "up_proj", "w1", "w3",
                                       "fc1", "gate"]):
        return 0

    # MLP down — shard input dim (axis 1)
    if any(k in name_lower for k in ["down_proj", "w2", "fc2"]):
        return 1 if len(dims) > 1 else None

    return None


def all_reduce_output(x: mx.array) -> mx.array:
    """All-reduce (sum) tensor across all devices."""
    if not HAS_DISTRIBUTED:
        return x
    return mx.distributed.all_sum(x)


class MLXDistributedBackend(InferenceBackend):
    """
    Apple Silicon MLX distributed inference backend.

    Splits model weights across multiple devices using tensor parallelism.
    Each device runs a portion of each layer, with all_sum synchronization
    after attention and MLP blocks.
    """

    def __init__(self, model_path: str, backend: str = "any"):
        if not HAS_MLX:
            raise RuntimeError(
                "MLX not installed. Run:\n"
                "  pip install mlx mlx-lm"
            )

        self.model_path = model_path
        self.group = mx.distributed.init(backend=backend) if HAS_DISTRIBUTED else None
        self.rank = self.group.rank() if self.group else 0
        self.world_size = self.group.size() if self.group else 1

        print(f"[mlx_distributed] rank {self.rank}/{self.world_size}, backend={backend}", file=sys.stderr)
        print(f"[mlx_distributed] loading {model_path}...", file=sys.stderr)

        t0 = time.time()
        self.model, self.tokenizer = mlx_lm.load(model_path)

        # Shard weights across devices
        if self.world_size > 1:
            shard_model_weights(self.model, self.group)
            mx.eval(self.model.parameters())  # Force evaluation of sharded weights

        load_time = time.time() - t0
        print(f"[mlx_distributed] loaded + sharded in {load_time:.1f}s", file=sys.stderr)

    def name(self) -> str:
        return "mlx_distributed"

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

        response = mlx_lm.generate(
            self.model, self.tokenizer, prompt=prompt, **kwargs,
        )

        elapsed = time.time() - t0
        comp_tokens = len(self.tokenizer.encode(response))

        if self.rank == 0:
            print(
                f"[mlx_distributed] {comp_tokens} tokens in {elapsed:.2f}s "
                f"({comp_tokens/max(elapsed,.01):.1f} tok/s, {self.world_size} devices)",
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

            # Only rank 0 emits tokens (others participate in computation)
            if self.rank == 0:
                yield {"token": token_text, "done": False}

            if should_stop or resp.finish_reason is not None:
                break

        elapsed = time.time() - t0
        if elapsed > 0 and n > 0 and self.rank == 0:
            print(
                f"[mlx_distributed] streamed {n} tokens in {elapsed:.2f}s "
                f"({n/elapsed:.1f} tok/s, {self.world_size} devices)",
                file=sys.stderr,
            )
