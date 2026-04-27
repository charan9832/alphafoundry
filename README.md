<div align="center">

<pre style="background: transparent; border: none;">
    _    _          _    __                    _           _
   / \  | | ____ _ | |  / _| _   _  _ __    __| |  ___  __| |
  / _ \ | |/ / _` || | | |_ | | | || '_ \  / _` | / _ \/ _` |
 / ___ \|   <| (_| || | |  _|| |_| || | | || (_| ||  __/ (_| |
/_/   \_|_|\_\\__,_||_| |_|   \__, ||_| |_| \__,_| \___|\__,_|
                              |___/
</pre>

<p>
  <a href="#quick-start"><strong>Quick Start</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#safety"><strong>Safety</strong></a> ·
  <a href="#roadmap"><strong>Roadmap</strong></a>
</p>

<p>
  <img alt="Build" src="https://img.shields.io/badge/build-passing-22c55e?style=flat-square">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white">
  <br>
  <img alt="CLI" src="https://img.shields.io/badge/interface-terminal-7c3aed?style=flat-square">
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-private-2563eb?style=flat-square">
  <img alt="Live trading" src="https://img.shields.io/badge/live_trading-disabled-ef4444?style=flat-square">
</p>

</div>

---

## What is AlphaFoundry?

**AlphaFoundry is Claude Code for trading strategy research.**

A terminal-native AI agent that turns a trading idea into a reproducible research artifact — not a black-box signal service.

```text
Idea → Tool-backed data → Strategy spec → Backtest → Validation → Report
```

You describe a strategy in plain English. AlphaFoundry routes the finance work through deterministic tools, writes artifacts to your workspace, and returns answers grounded in computed evidence — not LLM hallucinations.

> **Research and paper validation only.** No live trading. No broker access. No profit promises.

---

## Why AlphaFoundry?

Most AI trading tools are web-first, black-box, or sell signals. AlphaFoundry is built differently:

| Principle | What it means |
|-----------|---------------|
| **Terminal-native** | Built for developers, quants, and builders who live in the CLI. |
| **Local-first** | Config, sessions, reports, and artifacts live on your machine. |
| **Tool-backed** | Finance numbers come from deterministic engines, not invented text. |
| **Reproducible** | Every backtest, assumption, and warning is saved to disk. |
| **Validation-first** | Designed to reject weak strategies, not hype them. |
| **Safety-locked** | Live trading is architecturally disabled. |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the full check
npm run check

# 3. Onboard with a local provider
npm run dev -- onboard --provider local --model local-finance-agent --non-interactive

# 4. Run a research workflow
npm run dev -- chat "build and test a simple SPY trend strategy" --json

# 5. Check system health
npm run dev -- doctor --json
```

After packaging:

```bash
alphafoundry onboard
alphafoundry chat "research a mean-reversion strategy for QQQ"
alphafoundry doctor
```

---

## What You Get

### Commands

| Command | Purpose |
|---------|---------|
| `alphafoundry` | Product entrypoint. First-run guidance if no config. |
| `alphafoundry onboard` | Configure provider, model, API key env var, and workspace. |
| `alphafoundry doctor --json` | Readiness report: config, workspace, LLM, safety, finance engine. |
| `alphafoundry chat "..."` | Natural-language research agent with typed tool access. |

### Built-in Tools

| Tool | Status | Output |
|------|--------|--------|
| `run_research_workflow` | Working | Data scaffold, trend baseline, validation, artifacts, report |
| `run_local_backtest` | Working | Deterministic backtest with fees/slippage assumptions |
| `generate_report` | Working | Markdown report from tool-backed results |
| `readiness_check` | Working | Config / workspace / LLM / safety / engine health |

### Workspace Outputs

```
workspace/
├── artifacts/
│   └── SPY/
│       └── backtests/
│           └── backtest_2026-01-15T10-30-00.json
├── reports/
│   └── SPY/
│       └── report_2026-01-15.md
└── sessions/
    └── session_2026-01-15.jsonl
```

---

## Terminal Demo

```text
$ alphafoundry chat "build a simple SPY trend strategy"

✓ Safety check passed
✓ Config loaded: local-finance-agent
✓ Tool registry initialized (4 tools)

→ Executing: run_research_workflow
  Symbol: SPY
  Period: 2024-01-01 → 2024-12-31
  Engine: deterministic local scaffold

  Results:
  ──────────────────────────────────────
  Total Return:        +8.42%
  Sharpe Ratio:        1.12
  Max Drawdown:       -4.81%
  Win Rate:            54.3%
  Trades:              23
  ──────────────────────────────────────
  ⚠ Fees/slippage estimated at 0.05% per trade
  ⚠ Past performance does not predict future results

✓ Artifacts saved:
  workspace/artifacts/SPY/backtests/backtest_2026-01-15T10-30-00.json
  workspace/reports/SPY/report_2026-01-15.md

→ Response:
  The SPY trend strategy showed a +8.42% return over 2024
  with reasonable risk metrics. The full backtest, assumptions,
  and validation checks are saved in your workspace.
```

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    AlphaFoundry CLI                          │
│               (launch / onboard / doctor / chat)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Agent Runtime Facade                            │
│    ├─ Pi SDK Adapter      → real providers (OpenAI, etc.)   │
│    └─ Local Adapter       → offline tests & smoke runs       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│              Typed Tool Registry                             │
│    ├─ readiness checks                                       │
│    ├─ finance research workflow                              │
│    ├─ backtest & report tools                                │
│    └─ safety gates (live-trading block)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│           Python Finance Engine Bridge                       │
│    ├─ deterministic local data scaffold                      │
│    ├─ trend baseline & validation                            │
│    ├─ fees / slippage assumptions                            │
│    └─ report markdown generation                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                Local Workspace                               │
│    ├─ sessions/*.jsonl    → full conversation & tool logs    │
│    ├─ reports/*.md        → human-readable research reports  │
│    └─ artifacts/*.json    → raw backtest & validation data   │
└─────────────────────────────────────────────────────────────┘
```

---

## Product Vision

AlphaFoundry is being shaped into an end-to-end strategy research workbench:

```text
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  Idea   │ →  │ Strategy     │ →  │ Executable  │ →  │ Backtest │
└─────────┘    │ Project      │    │ Research    │    └──────────┘
               └──────────────┘    │ Code        │         │
                                    └─────────────┘         ▼
                                                        ┌──────────┐
                                                        │ Optimize │
                                                        └──────────┘
                                                             │
                         ┌───────────────────────────────────┘
                         ▼
              ┌─────────────────┐    ┌─────────────┐    ┌──────────────┐
              │     Validate    │ →  │   Report    │ →  │ Paper-Trade  │
              └─────────────────┘    └─────────────┘    └──────────────┘
                                                                           │
                         ┌─────────────────────────────────────────────────┘
                         ▼
              ┌─────────────────┐    ┌─────────────────┐
              │    Lessons      │ →  │  Next Iteration │
              │   (Memory)      │    │   (Autoresearch)│
              └─────────────────┘    └─────────────────┘
```

The long-term loop follows the Autoresearch pattern:

```text
Modify → Verify → Keep/Discard → Repeat
```

One strategy change at a time. Mechanical validation. Saved results. Honest rejection when the evidence is weak.

---

## Safety

AlphaFoundry is intentionally conservative.

- **No live trading** — architecturally disabled.
- **No broker integration** — no API keys for brokerages.
- **No order placement** — no market, limit, or stop orders.
- **No account access** — no portfolio or balance queries.
- **No profit guarantees** — all metrics are historical and simplified.
- **No invented metrics** — if a number isn't from a tool, it is unknown.
- **No secrets in config** — API keys are referenced by env var name only.

The LLM can reason, explain, ask questions, select tools, and summarize. Deterministic tools must compute all finance results.

---

## Development

```bash
# Full check (lint + type-check + test)
npm run check

# Run tests only
npm run test

# Build
npm run build

# Format
npm run format
```

For behavior changes, update or add tests first. Keep changes small, traceable to the product spec or roadmap, and inside the safety boundary.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`AGENTS.md`](AGENTS.md) | Agent rules and non-negotiable boundaries |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Product vision and first-release target |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Runtime, tool, bridge, and workspace design |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Development workflow and done definition |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase status and remaining work |
| [`docs/research/RESEARCH_SUMMARY.md`](docs/research/RESEARCH_SUMMARY.md) | Research lessons behind the restart |

---

## Inspired By

| Project | What AlphaFoundry takes from it |
|---------|--------------------------------|
| **OpenCode / Claude Code / Aider** | Chat-first CLI agent, programmatic command path, repo-local workflow |
| **TradingAgents** | Role-based financial analysis and risk-aware agent design |
| **OpenBB** | Provider-aware, reusable, provenance-preserving financial data |
| **Autoresearch** | Improve by running constrained experiments and keeping only validated changes |

---

## Disclaimer

AlphaFoundry is research software. Outputs may be incomplete, wrong, or based on simplified local scaffolds until connected to audited historical data providers. Nothing in this repository is financial, investment, legal, tax, or trading advice.
