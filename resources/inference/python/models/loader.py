"""Smart model loader — detects format and routes to appropriate backend."""

import json
import platform
from pathlib import Path
from typing import Dict


def detect_format(model_path: str) -> str:
    """Detect model format from directory contents."""
    path = Path(model_path)
    if path.is_file() and path.suffix == ".gguf":
        return "gguf"
    if path.is_dir():
        exts = {f.suffix for f in path.iterdir() if f.is_file()}
        if ".gguf" in exts:
            return "gguf"
        if ".safetensors" in exts:
            return "mlx" if is_apple_silicon() else "safetensors"
        if ".bin" in exts:
            return "pytorch"
    return "unknown"


def detect_backend(model_path: str) -> str:
    """Determine the best backend for this hardware and model."""
    fmt = detect_format(model_path)
    if fmt == "gguf":
        return "llamacpp"
    if is_apple_silicon():
        return "mlx"
    return "llamacpp"


def is_apple_silicon() -> bool:
    return platform.system() == "Darwin" and platform.machine() == "arm64"


def get_model_info(model_path: str) -> Dict:
    """Get metadata about a local model."""
    path = Path(model_path)
    info = {
        "path": str(path.resolve()),
        "format": detect_format(model_path),
        "backend": detect_backend(model_path),
    }
    config_path = path / "config.json"
    if config_path.exists():
        try:
            config = json.loads(config_path.read_text())
            info["model_type"] = config.get("model_type", "unknown")
            h = config.get("hidden_size", 0)
            l = config.get("num_hidden_layers", 0)
            v = config.get("vocab_size", 0)
            if h and l:
                info["estimated_params"] = 12 * l * h * h + v * h
        except (json.JSONDecodeError, IOError):
            pass

    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) if path.is_dir() else 0
    info["size_bytes"] = total
    return info
