---
name: dev-server-sandbox
description: Run multiple isolated unix dev-server instances (temp UNIX_ROOT + free ports)
---

# `dev-server` sandbox instances

`make dev-server` starts the unix backend server, which uses a lockfile at:

- `<UNIX_ROOT>/server.lock` (defaults to `~/.unix-dev/server.lock` in development)

This means you can only run **one** dev server per unix root directory.

This skill documents the repo workflow for starting **multiple** dev-server instances in parallel (including from different git worktrees) by giving each instance its own temporary `UNIX_ROOT`.

## Quick start

```bash
make dev-server-sandbox
```

## What it does

- Creates a fresh temporary `UNIX_ROOT` directory
- Copies these files into the sandbox if present:
  - `providers.jsonc` (provider config)
  - `config.json` (project list)
- Picks free ports (`BACKEND_PORT`, `VITE_PORT`)
- Allows all hosts (`VITE_ALLOWED_HOSTS=all`) so it works behind port-forwarding domains
- Runs `make dev-server` with those env overrides

## Options

```bash
# Use a specific root to seed from (defaults to ~/.unix-dev then ~/.unix)
SEED_UNIX_ROOT=~/.unix-dev make dev-server-sandbox

# Keep the sandbox root directory after exit (useful for debugging)
KEEP_SANDBOX=1 make dev-server-sandbox

# Pin ports (must be different)
BACKEND_PORT=3001 VITE_PORT=5174 make dev-server-sandbox

# Override which make binary to use
MAKE=gmake make dev-server-sandbox
```

## Security notes

- `providers.jsonc` may contain API keys.
- The sandbox root directory is created on disk (usually under your system temp dir).
- This flow intentionally **does not** copy `secrets.json`.
