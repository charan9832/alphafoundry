<div align="center">

# AlphaFoundry

### Local-first AI finance research from your terminal

Turn a plain-language market idea into a tool-backed workflow: data provenance, strategy definition, deterministic backtests, validation checks, and saved reports.

<p>
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#what-it-does"><strong>Features</strong></a> ·
  <a href="#safety-boundary"><strong>Safety</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a>
</p>

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-active-22c55e?style=for-the-badge">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-111827?style=for-the-badge&logo=node.js">
  <img alt="Safety" src="https://img.shields.io/badge/live_trading-disabled-ef4444?style=for-the-badge">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-private-2563eb?style=for-the-badge">
</p>

</div>

---

## Overview

AlphaFoundry is a standalone, Pi-powered finance research agent that runs from the terminal. It keeps the LLM in the reasoning role and routes finance work through typed deterministic tools, so results are backed by artifacts instead of invented metrics.

> **Research only:** AlphaFoundry is not a live trading bot, signal seller, broker connector, or order execution system.

## What it does

| Capability | Description |
| --- | --- |
| **Chat-first research shell** | Start with natural language instead of a command list. |
| **Typed finance tools** | Backtests, validation, readiness checks, and reports run through registered tools. |
| **Deterministic engine** | A Python finance bridge computes results and returns structured outputs. |
| **Local workspace** | Sessions, artifacts, and Markdown reports are saved locally. |
| **Provenance-aware output** | Results preserve provider, symbol, date range, assumptions, fees, slippage, warnings, and timestamps. |
| **Safety gates** | Live trading, broker access, order placement, and transaction execution are refused. |

## Quick start

```bash
npm install
npm run check
npm run dev -- doctor
npm run dev -- onboard --provider local --model local-finance-agent --non-interactive
npm run dev -- chat hey --json
npm run dev -- chat "build and test a simple SPY trend strategy" --json
```

After packaging, the intended user command is:

```bash
alphafoundry
```

## Example workflow

```text
User idea
  ↓
AlphaFoundry chat shell
  ↓
Local/Pi-compatible agent adapter
  ↓
Typed finance tool registry
  ↓
Python deterministic finance engine
  ↓
Backtest + validation + report markdown
  ↓
Saved artifacts + session JSONL
  ↓
Assistant summary with warnings
```

Artifacts are written under the configured workspace:

```text
artifacts/<SYMBOL>/backtests/*.json
reports/<SYMBOL>/*.md
sessions/*.jsonl
```

## Safety boundary

AlphaFoundry is designed for research and paper validation only.

- The LLM can explain, ask questions, choose tools, and summarize results.
- Finance computations must come from registered tools and saved artifacts.
- Unknown or unavailable metrics must be labeled as unknown.
- Raw API keys are never stored in repo config; only environment variable names are saved.
- Broker integration, live trading, order placement, account access, and automated transaction flows are out of scope.

## Architecture

```text
AlphaFoundry CLI / Chat Shell
  ├─ Onboarding + Config + Readiness
  ├─ Agent Runtime Facade
  │   ├─ Pi SDK adapter for real providers
  │   └─ Local adapter for tests and smoke runs
  ├─ Typed Tool Registry
  │   ├─ Readiness tools
  │   ├─ Finance workflow tools
  │   └─ Safety gates
  ├─ Python Finance Engine Bridge
  │   └─ Deterministic data, backtest, validation, and report code
  └─ Workspace
      ├─ sessions/*.jsonl
      ├─ reports/*.md
      └─ artifacts/*.json
```

## Project documents

| Document | Purpose |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Agent rules and non-negotiable product boundaries |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Product vision and first-release target |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Runtime, tool, bridge, and workspace design |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Development workflow and done definition |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase status and remaining work |
| [`docs/research/RESEARCH_SUMMARY.md`](docs/research/RESEARCH_SUMMARY.md) | Research lessons behind the restart |

## Development

Run the full check before claiming a change is done:

```bash
npm run check
```

For behavior changes, update or add tests first when practical. Keep changes small, traceable to the product spec or roadmap, and inside the safety boundary.
