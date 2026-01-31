#!/usr/bin/env python3
"""
Lattice Inference Worker — JSON-RPC server for model inference.

Managed by the Go inference server (inferred) via stdin/stdout JSON-RPC.
Loads a model using the appropriate backend (MLX for Apple Silicon,
llama.cpp for NVIDIA/CPU) and serves inference requests.

Protocol:
  - Reads JSON-RPC 2.0 requests from stdin (newline-delimited)
  - Writes JSON-RPC 2.0 responses to stdout (newline-delimited)
  - Streaming tokens are written as JSON objects to stdout

Methods:
  health            — Check if worker is ready
  generate          — Non-streaming text generation
  generate_stream   — Streaming text generation
  shutdown          — Graceful shutdown
"""

import argparse
import json
import sys
import traceback


def get_backend(name: str, model_path: str):
    """Create and return the appropriate inference backend."""
    if name == "mlx":
        from backends.mlx_backend import MLXBackend
        return MLXBackend(model_path)
    elif name == "mlx_distributed":
        from backends.mlx_distributed_backend import MLXDistributedBackend
        return MLXDistributedBackend(model_path)
    elif name == "pipeline":
        from backends.pipeline_backend import PipelineBackend
        return PipelineBackend(model_path)
    elif name == "llamacpp":
        from backends.llamacpp_backend import LlamaCppBackend
        return LlamaCppBackend(model_path)
    else:
        raise ValueError(f"Unknown backend: {name}")


def send_response(req_id: int, result=None, error=None):
    """Send a JSON-RPC 2.0 response."""
    resp = {"jsonrpc": "2.0", "id": req_id}
    if error is not None:
        resp["error"] = error
    else:
        resp["result"] = result
    sys.stdout.write(json.dumps(resp) + "\n")
    sys.stdout.flush()


def send_stream_token(token: str, done: bool = False, error: str = ""):
    """Send a streaming token notification."""
    msg = {"token": token, "done": done}
    if error:
        msg["error"] = error
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle_request(backend, request: dict):
    """Handle a single JSON-RPC request."""
    method = request.get("method", "")
    params = request.get("params") or {}
    req_id = request.get("id", 0)

    try:
        if method == "health":
            send_response(req_id, result={
                "status": "ok",
                "backend": backend.name(),
            })

        elif method == "generate":
            result = backend.generate(
                messages=params.get("messages", []),
                temperature=params.get("temperature"),
                top_p=params.get("top_p"),
                max_tokens=params.get("max_tokens", 2048),
                stop=params.get("stop", []),
            )
            send_response(req_id, result=result)

        elif method == "generate_stream":
            # Signal streaming has started
            send_response(req_id, result={"status": "streaming"})

            for token_data in backend.generate_stream(
                messages=params.get("messages", []),
                temperature=params.get("temperature"),
                top_p=params.get("top_p"),
                max_tokens=params.get("max_tokens", 2048),
                stop=params.get("stop", []),
            ):
                if isinstance(token_data, dict):
                    send_stream_token(
                        token=token_data.get("token", ""),
                        done=token_data.get("done", False),
                    )
                else:
                    send_stream_token(token=str(token_data))

            send_stream_token(token="", done=True)

        elif method == "shutdown":
            send_response(req_id, result={"status": "shutting_down"})
            sys.exit(0)

        else:
            send_response(req_id, error={
                "code": -32601,
                "message": f"Method not found: {method}",
            })

    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        send_response(req_id, error={"code": -32000, "message": str(e)})


def main():
    parser = argparse.ArgumentParser(description="Lattice Inference Worker")
    parser.add_argument("--model", required=True, help="Path to model directory")
    parser.add_argument("--backend", default="mlx", choices=["mlx", "mlx_distributed", "pipeline", "llamacpp"])
    args = parser.parse_args()

    print(f"[worker] loading model: {args.model}", file=sys.stderr)
    print(f"[worker] backend: {args.backend}", file=sys.stderr)

    try:
        backend = get_backend(args.backend, args.model)
        print("[worker] model loaded, ready for requests", file=sys.stderr)
    except Exception as e:
        print(f"[worker] FATAL: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        send_response(1, error={"code": -32000, "message": f"Failed to load: {e}"})
        sys.exit(1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"[worker] invalid JSON: {e}", file=sys.stderr)
            continue
        handle_request(backend, request)


if __name__ == "__main__":
    main()
