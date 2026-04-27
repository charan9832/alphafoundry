<div align="center">

# AlphaFoundry

### Claude Code for trading strategy research

**Turn a trading idea into a reproducible research artifact:** chat → tool-backed data → strategy spec → deterministic backtest → validation → Markdown report.

<p>
  <a href="#quick-start"><strong>Quick start</strong></a> ·
  <a href="#what-alphafoundry-is"><strong>What it is</strong></a> ·
  <a href="#current-build"><strong>Current build</strong></a> ·
  <a href="#architecture"><strong>Architecture</strong></a> ·
  <a href="#safety-boundary"><strong>Safety</strong></a>
</p>

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-active-22c55e?style=for-the-badge">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-111827?style=for-the-badge&logo=node.js">
  <img alt="CLI" src="https://img.shields.io/badge/interface-terminal-7c3aed?style=for-the-badge">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-private-2563eb?style=for-the-badge">
  <img alt="Live trading" src="https://img.shields.io/badge/live_trading-disabled-ef4444?style=for-the-badge">
</p>

</div>

---

## What AlphaFoundry is

AlphaFoundry is a local-first, agentic CLI for finance research. The goal is not to sell signals or promise profitable trades. The goal is to make the research workflow faster, stricter, and more reproducible.

Think:

```text
Claude Code / OpenCode style terminal agent
+ deterministic finance tools
+ saved artifacts
+ safety gates
= strategy research workbench
```

You describe a strategy idea in natural language. AlphaFoundry routes the finance work through typed tools, writes artifacts to your workspace, and returns an answer grounded in those artifacts instead of LLM guesses.

> **Research and paper validation only.** AlphaFoundry does not place trades, connect to brokers, access accounts, or promise returns.

## Why it exists

Most AI trading products are web-first, black-box, or signal-oriented. AlphaFoundry is different:

| Principle | What it means |
| --- | --- |
| **CLI-first** | Built for developers, quants, and builders who want a terminal workflow. |
| **Local-first** | Config, sessions, reports, and artifacts live in your workspace. |
| **Tool-backed** | Finance numbers come from deterministic tools, not invented LLM text. |
| **Reproducible** | Backtests, assumptions, warnings, and reports are saved as files. |
| **Validation-first** | The product should help reject weak or overfit strategies, not hype them. |
| **Safety-gated** | Live trading and broker actions are out of scope unless explicitly designed later. |

## Quick start

```bash
npm install
npm run check
npm run dev -- doctor
npm run dev -- onboard --provider local --model local-finance-agent --non-interactive
npm run dev -- chat hey --json
npm run dev -- chat "build and test a simple SPY trend strategy" --json
```

After packaging, the intended entrypoint is:

```bash
alphafoundry
```

## Current build

The current clean restart implements the core product shell and a deterministic offline research path.

| Command | Purpose |
| --- | --- |
| `alphafoundry` | Opens the product entrypoint and first-run guidance. |
| `alphafoundry onboard` | Configures provider, model, API-key environment variable name, and workspace. |
| `alphafoundry doctor --json` | Checks config, workspace, LLM readiness, safety mode, and finance engine readiness. |
| `alphafoundry chat "..."` | Talks to the research agent and lets it call typed finance tools. |

Implemented tool path:

| Tool | Status | Output |
| --- | --- | --- |
| `run_research_workflow` | Working local scaffold | deterministic data, trend baseline, validation, artifacts, report |
| `run_local_backtest` | Compatibility alias | same deterministic workflow |
| `generate_report` | Working | Markdown report from tool-backed result |
| readiness tools | Working | config/workspace/LLM/safety/engine checks |

## Example: idea to artifact

```bash
npm run dev -- chat "build and test a simple SPY trend strategy" --json
```

AlphaFoundry runs the request through this path:

```text
User strategy idea
  ↓
AlphaFoundry chat shell
  ↓
Safety gate
  ↓
Local or Pi-backed agent adapter
  ↓
Typed finance tool registry
  ↓
Python deterministic finance engine
  ↓
Backtest + validation + report markdown
  ↓
Saved artifacts + session log
  ↓
Assistant summary with warnings and file paths
```

Workspace outputs:

```text
artifacts/<SYMBOL>/backtests/*.json
reports/<SYMBOL>/*.md
sessions/*.jsonl
```

## Product direction

AlphaFoundry is being shaped into an end-to-end strategy research workbench:

```text
idea
  → strategy project
  → executable research code
  → backtest
  → optimize
  → validate
  → report
  → paper-trading journal
  → lessons for the next iteration
```

The long-term workflow follows an Autoresearch-style loop:

```text
Modify → Verify → Keep/Discard → Repeat
```

For trading research, that means one strategy change at a time, mechanical validation, saved results, and honest rejection when the evidence is weak.

## Architecture

```text
AlphaFoundry CLI / Chat Shell
  ├─ Onboarding + Config + Readiness
  │   ├─ provider, model, base URL
  │   ├─ API key env var name only
  │   └─ workspace setup
  │
  ├─ Agent Runtime Facade
  │   ├─ Pi SDK adapter for real providers
  │   └─ Local adapter for tests and smoke runs
  │
  ├─ Typed Tool Registry
  │   ├─ readiness checks
  │   ├─ finance research workflow
  │   ├─ backtest/report tools
  │   └─ safety gates
  │
  ├─ Python Finance Engine Bridge
  │   ├─ deterministic local data scaffold
  │   ├─ moving-average trend baseline
  │   ├─ fees/slippage assumptions
  │   ├─ validation checks
  │   └─ report markdown generation
  │
  └─ Local Workspace
      ├─ sessions/*.jsonl
      ├─ reports/*.md
      └─ artifacts/*.json
```

## Inspired by

AlphaFoundry borrows product patterns from serious terminal and finance tools:

| Project style | What AlphaFoundry takes from it |
| --- | --- |
| **OpenCode / Claude Code / Aider** | Chat-first CLI agent experience, programmatic command path, repo-local workflow. |
| **TradingAgents** | Role-based financial analysis and risk-aware agent design. |
| **OpenBB** | Financial data should be provider-aware, reusable, and provenance-preserving. |
| **Autoresearch** | Improve by running constrained experiments and keeping only validated changes. |

## Safety boundary

AlphaFoundry is intentionally conservative.

- No live trading.
- No broker integration.
- No order placement.
- No account access.
- No profit guarantees.
- No invented metrics.
- Raw API keys are never written to repo config.

The LLM can reason, explain, ask questions, select tools, and summarize. Deterministic tools must compute finance results.

## Development

Run the full check before claiming a change is done:

```bash
npm run check
```

For behavior changes, update or add tests first when practical. Keep changes small, traceable to the product spec or roadmap, and inside the safety boundary.

## Project documents

| Document | Purpose |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Agent rules and non-negotiable product boundaries |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Product vision and first-release target |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Runtime, tool, bridge, and workspace design |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Development workflow and done definition |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Phase status and remaining work |
| [`docs/research/RESEARCH_SUMMARY.md`](docs/research/RESEARCH_SUMMARY.md) | Research lessons behind the restart |

## Disclaimer

AlphaFoundry is research software. Outputs may be incomplete, wrong, or based on simplified local scaffolds until connected to audited historical data providers. Nothing in this repository is financial, investment, legal, tax, or trading advice.
