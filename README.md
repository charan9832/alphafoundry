# AlphaFoundry

**Claude Code for trading strategy research**

AlphaFoundry is a terminal-native AI agent that turns trading ideas into reproducible research artifacts. Chat with it naturally, and it routes the finance work through deterministic tools — backtests, validation, and reports saved to your workspace.

> **Research only.** No live trading, no broker access, no profit promises.

## Quick start

```bash
npm install
npm run check

# Onboard with a local provider
npm run dev -- onboard --provider local --model local-finance-agent --non-interactive

# Run a research workflow
npm run dev -- chat "build and test a simple SPY trend strategy" --json
```

After packaging:

```bash
alphafoundry onboard
alphafoundry chat "research a mean-reversion strategy for QQQ"
alphafoundry doctor
```

## What it does

- **Chat → Tools → Artifacts** — Describe a strategy in plain English. AlphaFoundry runs it through deterministic finance tools and saves results to your workspace.
- **Local-first** — Config, sessions, reports, and artifacts live on your machine. No cloud lock-in.
- **Validation-first** — Designed to reject weak or overfit strategies, not hype them.
- **Safety-locked** — Live trading is architecturally disabled. Broker integration is out of scope.

## Commands

| Command | Purpose |
|---------|---------|
| `alphafoundry` | Entrypoint. First-run guidance if no config. |
| `alphafoundry onboard` | Configure provider, model, API key env var, workspace. |
| `alphafoundry doctor` | Readiness report: config, workspace, LLM, safety, engine. |
| `alphafoundry chat "..."` | Natural-language research agent with typed tool access. |

## Architecture

```
CLI → Agent Runtime → Typed Tool Registry → Python Finance Engine → Workspace Artifacts
```

- **Agent Runtime** — Pi SDK adapter for real providers; local adapter for offline use.
- **Typed Tool Registry** — Deterministic finance tools with safety gates.
- **Python Finance Engine** — Local backtest engine with fees/slippage assumptions.
- **Workspace** — Sessions (`*.jsonl`), reports (`*.md`), artifacts (`*.json`).

## Development

```bash
npm run check   # lint + type-check + test
npm run test
npm run build
```

Keep changes small, tested, and inside the safety boundary.

## Documentation

- [`AGENTS.md`](AGENTS.md) — Agent rules and boundaries
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — Product vision
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System design
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phase status

## Disclaimer

AlphaFoundry is research software. Outputs may be incomplete or based on simplified local scaffolds. Nothing here is financial, investment, legal, tax, or trading advice.
