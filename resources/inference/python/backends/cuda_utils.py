"""
CUDA/GPU detection utilities for the llama.cpp backend.

Detects:
  - NVIDIA GPUs via nvidia-smi
  - CUDA availability via torch or llama-cpp-python
  - VRAM per GPU
  - Multi-GPU configuration

Used by the Go server to report hardware capabilities and
by the llama.cpp backend to configure GPU layers.
"""

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class GPUInfo:
    """Information about a single GPU."""
    index: int
    name: str
    memory_total_mb: int
    memory_used_mb: int
    memory_free_mb: int
    temperature: int
    utilization: int
    driver_version: str
    cuda_version: str


def detect_nvidia_gpus() -> List[GPUInfo]:
    """Detect NVIDIA GPUs using nvidia-smi."""
    if not shutil.which("nvidia-smi"):
        return []

    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=index,name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu,driver_version",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return []

        gpus = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 8:
                continue

            gpus.append(GPUInfo(
                index=int(parts[0]),
                name=parts[1],
                memory_total_mb=int(parts[2]),
                memory_used_mb=int(parts[3]),
                memory_free_mb=int(parts[4]),
                temperature=int(parts[5]) if parts[5].isdigit() else 0,
                utilization=int(parts[6]) if parts[6].isdigit() else 0,
                driver_version=parts[7],
                cuda_version=_detect_cuda_version(),
            ))

        return gpus

    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        return []


def _detect_cuda_version() -> str:
    """Detect CUDA version from nvidia-smi or torch."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            # nvidia-smi reports CUDA version in its header
            header = subprocess.run(
                ["nvidia-smi"], capture_output=True, text=True, timeout=5,
            )
            for line in header.stdout.split("\n"):
                if "CUDA Version" in line:
                    parts = line.split("CUDA Version:")
                    if len(parts) > 1:
                        return parts[1].strip().split()[0]
    except Exception:
        pass

    try:
        import torch
        if torch.cuda.is_available():
            return torch.version.cuda or "unknown"
    except ImportError:
        pass

    return "unknown"


def detect_gpu_type() -> str:
    """Detect the type of GPU acceleration available."""
    import platform

    if platform.system() == "Darwin" and platform.machine() == "arm64":
        return "apple-metal"

    gpus = detect_nvidia_gpus()
    if gpus:
        return "nvidia-cuda"

    return "cpu"


def get_hardware_info() -> Dict:
    """Get comprehensive hardware information for this node."""
    import platform

    info = {
        "platform": platform.system(),
        "arch": platform.machine(),
        "gpu_type": detect_gpu_type(),
        "gpus": [],
    }

    # Apple Silicon
    if info["gpu_type"] == "apple-metal":
        import os
        # Get unified memory from sysctl
        try:
            result = subprocess.run(
                ["sysctl", "-n", "hw.memsize"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                mem_bytes = int(result.stdout.strip())
                info["total_memory_bytes"] = mem_bytes
                info["gpu_memory_bytes"] = mem_bytes  # Unified memory
        except Exception:
            pass

        # Get chip info
        try:
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                info["chip"] = result.stdout.strip()
        except Exception:
            pass

        return info

    # NVIDIA
    gpus = detect_nvidia_gpus()
    if gpus:
        info["gpus"] = [
            {
                "index": g.index,
                "name": g.name,
                "memory_total_mb": g.memory_total_mb,
                "memory_used_mb": g.memory_used_mb,
                "memory_free_mb": g.memory_free_mb,
                "temperature": g.temperature,
                "utilization": g.utilization,
                "cuda_version": g.cuda_version,
            }
            for g in gpus
        ]
        info["total_memory_bytes"] = sum(g.memory_total_mb for g in gpus) * 1024 * 1024
        info["gpu_memory_bytes"] = sum(g.memory_total_mb for g in gpus) * 1024 * 1024
        return info

    # CPU fallback
    import os
    try:
        info["total_memory_bytes"] = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
    except (ValueError, AttributeError):
        pass

    return info


if __name__ == "__main__":
    """Print hardware info as JSON when run directly."""
    info = get_hardware_info()
    print(json.dumps(info, indent=2))
