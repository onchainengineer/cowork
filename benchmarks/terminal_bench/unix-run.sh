#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[unix-run] %s\n' "$1"
}

fatal() {
  printf '[unix-run] ERROR: %s\n' "$1" >&2
  exit 1
}

instruction=${1:-}
if [[ -z "${instruction}" ]]; then
  fatal "instruction argument is required"
fi

export BUN_INSTALL="${BUN_INSTALL:-/root/.bun}"
export PATH="${BUN_INSTALL}/bin:${PATH}"

UNIX_APP_ROOT="${UNIX_APP_ROOT:-/opt/unix-app}"
UNIX_CONFIG_ROOT="${UNIX_CONFIG_ROOT:-/root/.unix}"
UNIX_PROJECT_PATH="${UNIX_PROJECT_PATH:-}"
UNIX_PROJECT_CANDIDATES="${UNIX_PROJECT_CANDIDATES:-/workspace:/app:/workspaces:/root/project}"
UNIX_MODEL="${UNIX_MODEL:-anthropic:claude-sonnet-4-5}"
UNIX_TIMEOUT_MS="${UNIX_TIMEOUT_MS:-}"
UNIX_WORKSPACE_ID="${UNIX_WORKSPACE_ID:-unix-bench}"
UNIX_THINKING_LEVEL="${UNIX_THINKING_LEVEL:-high}"
UNIX_MODE="${UNIX_MODE:-exec}"
UNIX_RUNTIME="${UNIX_RUNTIME:-}"
UNIX_EXPERIMENTS="${UNIX_EXPERIMENTS:-}"

resolve_project_path() {
  if [[ -n "${UNIX_PROJECT_PATH}" ]]; then
    if [[ -d "${UNIX_PROJECT_PATH}" ]]; then
      printf '%s\n' "${UNIX_PROJECT_PATH}"
      return 0
    fi
    fatal "UNIX_PROJECT_PATH=${UNIX_PROJECT_PATH} not found"
  fi

  IFS=":" read -r -a candidates <<<"${UNIX_PROJECT_CANDIDATES}"
  for candidate in "${candidates[@]}"; do
    if [[ -d "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  fatal "no project path located (searched ${UNIX_PROJECT_CANDIDATES})"
}

command -v bun >/dev/null 2>&1 || fatal "bun is not installed"
project_path=$(resolve_project_path)

log "starting unix agent session for ${project_path}"
cd "${UNIX_APP_ROOT}"

cmd=(bun src/cli/run.ts
  --dir "${project_path}"
  --model "${UNIX_MODEL}"
  --mode "${UNIX_MODE}"
  --thinking "${UNIX_THINKING_LEVEL}"
  --json)

if [[ -n "${UNIX_RUNTIME}" ]]; then
  cmd+=(--runtime "${UNIX_RUNTIME}")
fi

# Add experiment flags (comma-separated → repeated --experiment flags)
if [[ -n "${UNIX_EXPERIMENTS}" ]]; then
  IFS=',' read -r -a experiments <<<"${UNIX_EXPERIMENTS}"
  for exp in "${experiments[@]}"; do
    # Trim whitespace
    exp="${exp#"${exp%%[![:space:]]*}"}"
    exp="${exp%"${exp##*[![:space:]]}"}"
    if [[ -n "${exp}" ]]; then
      cmd+=(--experiment "${exp}")
    fi
  done
fi

UNIX_OUTPUT_FILE="/tmp/unix-output.jsonl"
UNIX_TOKEN_FILE="/tmp/unix-tokens.json"

# Wrap command with timeout if UNIX_TIMEOUT_MS is set (converts ms to seconds)
if [[ -n "${UNIX_TIMEOUT_MS}" ]]; then
  timeout_sec=$((UNIX_TIMEOUT_MS / 1000))
  cmd=(timeout "${timeout_sec}s" "${cmd[@]}")
fi

# Terminal-bench enforces timeouts via --global-agent-timeout-sec
# Capture output to file while streaming to terminal for token extraction
if ! printf '%s' "${instruction}" | "${cmd[@]}" | tee "${UNIX_OUTPUT_FILE}"; then
  fatal "unix agent session failed"
fi

# Extract tokens from stream-end events (best-effort, sums all events)
python3 -c '
import json, sys
total_input = total_output = 0
for line in open(sys.argv[1]):
    try:
        obj = json.loads(line)
        if obj.get("type") == "event":
            p = obj.get("payload", {})
            if p.get("type") == "stream-end":
                u = p.get("metadata", {}).get("usage", {})
                total_input += u.get("inputTokens", 0) or 0
                total_output += u.get("outputTokens", 0) or 0
    except: pass
print(json.dumps({"input": total_input, "output": total_output}))
' "${UNIX_OUTPUT_FILE}" > "${UNIX_TOKEN_FILE}" 2>/dev/null || true
