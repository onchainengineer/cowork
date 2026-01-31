"""
MLX inference backend for Apple Silicon (M1-M4).

Uses Apple's MLX framework for Metal GPU-accelerated inference.
Supports MLX-format models from HuggingFace (mlx-community/).

Requirements:
  pip install mlx mlx-lm
"""

import sys
import time
from typing import Any, Dict, Generator, List, Optional

from .base import InferenceBackend

try:
    import mlx_lm

    HAS_MLX = True
except ImportError:
    HAS_MLX = False


class MLXBackend(InferenceBackend):
    """Apple Silicon MLX inference backend."""

    def __init__(self, model_path: str):
        if not HAS_MLX:
            raise RuntimeError(
                "MLX not installed. Run:\n"
                "  pip install mlx mlx-lm\n"
                "Or:\n"
                "  python3 -m venv ~/.lattice/inference-venv\n"
                "  ~/.lattice/inference-venv/bin/pip install mlx mlx-lm"
            )

        self.model_path = model_path
        print(f"[mlx] loading {model_path}...", file=sys.stderr)
        t0 = time.time()
        self.model, self.tokenizer = mlx_lm.load(model_path)
        print(f"[mlx] loaded in {time.time()-t0:.1f}s", file=sys.stderr)

    def name(self) -> str:
        return "mlx"

    def _apply_chat_template(self, messages: List[Dict[str, str]]) -> str:
        if hasattr(self.tokenizer, "apply_chat_template"):
            return self.tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
            )
        # Fallback for tokenizers without chat template
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

        print(
            f"[mlx] {comp_tokens} tokens in {elapsed:.2f}s "
            f"({comp_tokens/max(elapsed,.01):.1f} tok/s)",
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

            # Check stop sequences
            should_stop = False
            for seq in stop_seqs:
                if seq in text:
                    should_stop = True
                    break

            yield {"token": token_text, "done": False}

            if should_stop:
                break

            if resp.finish_reason is not None:
                break

        elapsed = time.time() - t0
        if elapsed > 0 and n > 0:
            print(
                f"[mlx] streamed {n} tokens in {elapsed:.2f}s "
                f"({n/elapsed:.1f} tok/s)",
                file=sys.stderr,
            )
