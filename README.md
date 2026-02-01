<div align="center">

<img src="docs/img/logo.webp" alt="LATTICE WORKBENCH logo" width="15%" />

# LATTICE WORKBENCH

</div>

A runtime enforcement and identity infrastructure for autonomous ai agents for internal enterprise use.

![LATTICE WORKBENCH product screenshot](docs/img/product-hero.webp)

## Features

- **Isolated workspaces** with central view on git divergence
  - **Local**: run directly in your project directory
  - **Worktree**: git worktrees on your local machine
  - **SSH**: remote execution on a server over SSH
- **Multi-model** (`sonnet-4-*`, `grok-*`, `gpt-5-*`, `opus-4-*`)
  - Ollama supported for local LLMs
  - OpenRouter supported for long-tail of LLMs
- **VS Code Extension**: Jump into workspaces directly from VS Code
- Supporting UI and keybinds for efficiently managing a suite of agents
- Rich markdown outputs (mermaid diagrams, LaTeX, etc.)

LATTICE WORKBENCH has a custom agent loop with features like Plan/Exec mode, vim inputs, `/compact`, opportunistic compaction, and mode prompts.

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

## License

See [LICENSE](./LICENSE) for details.
