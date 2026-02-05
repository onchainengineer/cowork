<div align="center">

<img src="docs/img/logo.webp" alt="LATTICE WORKBENCH logo" width="15%" />

# Lattice Workbench

### The Interface of [Lattice — Agent Headquarters](https://latticeruntime.com)

**Build agents. Test agents. Monitor agents. One tool.**

</div>

![LATTICE WORKBENCH product screenshot](docs/img/product-hero.webp)

## Part of the Lattice Ecosystem

Lattice is **Agent Headquarters** — the open-source runtime where AI agents get their identity, their permissions, their compute, and their orders. Lattice Workbench is the agent development and operations console.

| Component | Role | Repository |
|-----------|------|------------|
| [**Runtime**](https://github.com/latticeHQ/lattice) | Enforcement kernel — identity, authorization, audit, deployment constraints | [latticeRuntime](https://github.com/latticeHQ/lattice) |
| [**Inference**](https://github.com/latticeHQ/lattice-inference) | Local LLM serving — MLX, CUDA, zero-config clustering, OpenAI-compatible API | [latticeInference](https://github.com/latticeHQ/lattice-inference) |
| **Workbench** (this repo) | Agent IDE & operations console — multi-model chat, monitoring, desktop/web/CLI | You are here |
| [**Registry**](https://github.com/latticeHQ/lattice-registry) | Community ecosystem — templates, modules, presets for Docker/K8s/AWS/GCP/Azure | [latticeRegistry](https://github.com/latticeHQ/lattice-registry) |

```
brew install latticehq/lattice/lattice

```

<div align="center">
  <img src="../docs/img/lattice-headquarters.png" alt="Lattice: The Open-Source Headquarters for AI Agent Governance" width="100%" />
</div>

## Features

### For Building Agents

- **Multi-model support**: Claude, GPT, Gemini, Grok, Deepseek, Ollama, OpenRouter, Lattice Inference — any provider, swap freely
- **Workspace isolation**: Each agent gets its own workspace with separate git branch, runtime environment, and conversation history
- **Plan/Exec modes**: Strategic planning phase (analysis only) and execution phase (tool use) — the way agents should work in production
- **Built-in agents**: Pre-configured agents for execution, planning, exploration, and context management
- **MCP tools**: Model Context Protocol support for extensible tool discovery and execution
- **Document ingestion**: Analyze PDF, DOCX, XLSX, PPTX files directly in conversations
- **Rich output**: Mermaid diagrams, LaTeX, syntax-highlighted code, streaming markdown
- **vim keybindings**: For those who know

### For Operating Agents

- **Real-time monitoring** of all agent sessions across workspaces
- **Conversation history** and tool execution replay
- **Token usage and cost tracking** across all providers
- **Agent configuration** and permission management
- **Git divergence visualization** for workspace-level code review

### Runtime Modes

| Mode | Description |
|------|-------------|
| **Local** | Direct execution in your project directory |
| **Git Worktree** | Isolated branch-based development |
| **SSH** | Remote execution on any server |
| **Docker** | Container-based sandboxed execution |

### Platforms

- **Desktop**: macOS, Windows, Linux (Electron)
- **Web**: Server mode accessible from any browser
- **CLI**: Command-line interface for scripting and automation
- **VS Code Extension**: Jump into Lattice workspaces from VS Code

## How It Works with the Ecosystem

### With Lattice Runtime
Workbench connects to Runtime via oRPC (WebSocket + HTTP). Agents built and tested in Workbench are governed by Runtime's four enforcement gates — identity, authorization, audit, and deployment constraints. The operations console provides real-time monitoring of Runtime's audit stream.

### With Lattice Inference
Use local models alongside cloud providers. Lattice Inference provides an OpenAI-compatible API at `localhost:8000` — Workbench treats it like any other provider. Zero API costs. Zero data leakage. Switch between local and cloud models with one click.

### With Lattice Registry
Deploy agents from Workbench using Registry templates. One command gives you a governed agent environment on Docker, Kubernetes, AWS, GCP, or Azure — with identity and audit built in.

## Screenshots

<div align="center">
  <p><em>Integrated code-review for faster iteration:</p>
  <img src="./docs/img/code-review.webp" alt="Screenshot of code review" />
</div>

<div align="center">
  <p><em>Agents report their status through the sidebar:</em></p>
  <img src="./docs/img/agent-status.webp" alt="Screenshot of agent status" />
</div>

<div align="center">
  <p><em>Git divergence UI keeps you looped in on changes and potential conflicts:</em></p>
  <img src="./docs/img/git-status.webp" alt="Screenshot of git status" />
</div>

<div align="center">
  <p><em>Mermaid diagrams make it easier to review complex proposals from the Agent:</em></p>
  <img src="./docs/img/plan-mermaid.webp" alt="Screenshot of mermaid diagram" />
</div>

<div align="center">
  <p><em>Project secrets help split your Human and Agent identities:</em></p>
  <img src="./docs/img/project-secrets.webp" alt="Screenshot of project secrets" />
</div>

<div align="center">
  <p><em>Stay looped in on costs and token consumption:</em></p>
  <img src="./docs/img/costs-tab.webp" alt="Screenshot of costs table" />
</div>

<div align="center">
  <p><em>Opportunistic compaction helps keep context small:</em></p>
  <img src="./docs/img/opportunistic-compaction.webp" alt="Screenshot of opportunistic compaction" />
</div>

## Development

See [AGENTS.md](./AGENTS.md) for development setup and guidelines.

See [BUILD_REFERENCE.md](./BUILD_REFERENCE.md) for build system documentation.

## License

Lattice Workbench is licensed under [MIT](./LICENSE).

---

<div align="center">

**[Lattice — Agent Headquarters](https://latticeruntime.com)**

Your agents. Your models. Your rules. Your infrastructure.

`brew install latticehq/lattice/lattice
`

</div>
