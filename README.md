<div align="center">

<pre>
    _    _          _    __                    _           _
   / \  | | ____ _ | |  / _| _   _  _ __    __| |  ___  __| |
  / _ \ | |/ / _` || | | |_ | | | || '_ \  / _` | / _ \/ _` |
 / ___ \|   <| (_| || | |  _|| |_| || | | || (_| ||  __/ (_| |
/_/   \_|_|\_\\__,_||_| |_|   \__, ||_| |_| \__,_| \___|\__,_|
                              |___/
</pre>

<p>
  <strong>Terminal-native AI agent runtime. Finance tools come later.</strong>
</p>

<p>
  <img alt="Build" src="https://img.shields.io/badge/build-passing-22c55e?style=flat-square">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white">
</p>

</div>

---

AlphaFoundry is a terminal-native AI agent shell/runtime. The first layer is a normal agent core: chat, provider adapters, typed tools, run state, checkpoints, guardrails, onboarding, and human response rendering. Finance can be layered on later as explicit tool packs.

> **Direction:** Build the normal AI agent first. No predefined strategies, trading templates, or hardcoded finance workflows in the starting point.

## Quick start

```bash
npm install
npm run check
npm run dev -- onboard --provider local --model local-agent --non-interactive
npm run dev -- chat "hey" --json
```

After packaging:

```bash
af onboard
af
af chat "search the web for recent AI agent news"
af doctor
```

## What it does

- **Agent core first** — Normal AI agent primitives: provider-neutral messages, run state, typed tools, guardrails, and response rendering.
- **Simple command surface** — `af` launches the TUI, `af onboard` configures models/tools, `af doctor` checks readiness.
- **Finance later** — Finance should arrive as opt-in tools/plugins, not predefined core strategy behavior.
- **Local-first** — Config, sessions, notes, and workspace state live on your machine.

## Commands

| Command | Purpose |
|---------|---------|
| `af` | Entrypoint. Opens TUI when onboarded; first-run guidance otherwise. |
| `af onboard` | Interactive setup for provider, model, API key env var, workspace, and local web search. |
| `af doctor` | Readiness report: config, workspace, LLM, search, and agent runtime. |
| `af chat "..."` | One-shot natural-language agent chat. |

## Architecture

```
CLI/TUI → Agent Runtime → Typed Tool Registry → Workspace
```

## Development

```bash
npm run check   # lint + type-check + test
npm run test
npm run build
```

## Onboarding

Run:

```bash
af onboard
```

AlphaFoundry asks which LLM provider to use, the model name, API-key environment variable, optional base URL, workspace path, and web-search setup.

For local web search, onboarding can auto-detect common SearXNG and Firecrawl endpoints such as:

- `http://127.0.0.1:8080/search`
- `http://127.0.0.1:8888/search`
- `http://127.0.0.1:3002/v1/search`

Automation still works:

```bash
af onboard --provider local --model local-agent --search-autodetect --non-interactive
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — Agent rules and boundaries
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Product vision
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phase status

## Disclaimer

AlphaFoundry is early agent software. Finance/trading features are intentionally not part of the starting runtime and should be added later only as explicit, tested tool packs.
