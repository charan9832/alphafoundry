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
  <strong>Terminal-native AI agent runtime, with finance tools layered on top</strong>
</p>

<p>
  <img alt="Build" src="https://img.shields.io/badge/build-passing-22c55e?style=flat-square">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white">
</p>

</div>

---

AlphaFoundry is a terminal-native AI agent shell/runtime. The first layer is a normal agent core: chat, provider adapters, planning, typed tools, run state, checkpoints, guardrails, and human response rendering. Finance is layered on top as a research-only tool pack.

> **Direction:** Build the normal AI agent first. Finance features come after as registered tools/plugins, not hardcoded core behavior.
>
> **Research only.** No live trading, no broker access, no profit promises.

## Quick start

```bash
npm install
npm run check
npm run dev -- onboard --provider local --model local-finance-agent --non-interactive
npm run dev -- chat "build and test a simple SPY trend strategy" --json
```

After packaging:

```bash
alphafoundry onboard
alphafoundry chat "research a mean-reversion strategy for QQQ"
alphafoundry doctor
```

## What it does

- **Agent core first** — Normal AI agent primitives: provider-neutral messages, planning, run state, checkpoints, typed tools, guardrails, and response rendering.
- **Chat → Plan → Tools → Artifacts** — Describe a task in plain English. AlphaFoundry plans the run, calls registered tools, checkpoints the run, and saves artifacts.
- **Finance as tool pack** — Strategy research/backtests/validation are layered tools, not the product core.
- **Local-first** — Config, sessions, reports, checkpoints, and artifacts live on your machine.
- **Safety-locked** — Live trading is architecturally disabled.

## Commands

| Command | Purpose |
|---------|---------|
| `alphafoundry` | Entrypoint. First-run guidance if no config. |
| `alphafoundry onboard` | Configure provider, model, API key env var, workspace. |
| `alphafoundry doctor` | Readiness report: config, workspace, LLM, safety, engine. |
| `alphafoundry chat "..."` | Natural-language research agent with typed tool access. |

## Architecture

```
CLI → Agent Runtime → Typed Tool Registry → Python Finance Engine → Workspace
```

## Development

```bash
npm run check   # lint + type-check + test
npm run test
npm run build
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — Agent rules and boundaries
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Product vision
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phase status

## Disclaimer

AlphaFoundry is research software. Outputs may be incomplete or based on simplified local scaffolds. Nothing here is financial, investment, legal, tax, or trading advice.
