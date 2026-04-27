# AlphaFoundry

AlphaFoundry is a local-first AI finance research terminal. It turns a plain-language research idea into a tool-backed workflow: gather data with provenance, define a strategy, run deterministic backtests, validate assumptions, and save a report you can review later.

It is **not** a live trading bot, signal seller, or broker integration. AlphaFoundry is built for research, validation, and reporting only.

## What it does

- Opens a chat-first terminal experience with `alphafoundry`.
- Uses Pi internally for agent/provider infrastructure while keeping AlphaFoundry as its own standalone product.
- Runs finance work through typed deterministic tools instead of letting the LLM invent numbers.
- Saves session logs, backtest artifacts, and Markdown reports in your local workspace.
- Tracks provenance, assumptions, fees, slippage, warnings, and timestamps.
- Refuses live trading, broker access, order placement, and transaction execution.

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

## Current product path

The offline/local path works end to end:

```text
chat request
-> local/Pi-compatible agent adapter
-> typed finance tool registry
-> Python deterministic finance engine
-> backtest + validation + report markdown
-> saved artifacts + session JSONL
-> assistant summary with warnings
```

Artifacts are written under the configured workspace:

```text
artifacts/<SYMBOL>/backtests/*.json
reports/<SYMBOL>/*.md
sessions/*.jsonl
```

## Safety model

AlphaFoundry keeps the LLM as the reasoning layer and deterministic tools as the execution layer.

- The LLM can explain, ask questions, choose tools, and summarize results.
- Finance computations must come from registered tools and saved artifacts.
- Results must include assumptions and provenance when available.
- Unknown or unavailable metrics must be labeled as unknown.
- Secrets are stored by environment variable name only, never as raw keys in repo config.

## Architecture

```text
AlphaFoundry CLI / Chat Shell
  -> Onboarding + Config + Readiness
  -> Agent Runtime Facade
      -> Pi SDK adapter for real providers
      -> Local adapter for tests and smoke runs
  -> Typed Tool Registry
      -> readiness, finance workflow, safety gates
  -> Python Finance Engine Bridge
      -> deterministic data/backtest/validation/report code
  -> Workspace
      -> sessions/*.jsonl
      -> reports/*.md
      -> artifacts/*.json
```

## Repository guide

Key project documents:

- `AGENTS.md` — agent rules and non-negotiable product boundaries
- `docs/PRODUCT_SPEC.md` — product vision and first-release target
- `docs/ARCHITECTURE.md` — runtime, tool, bridge, and workspace design
- `docs/WORKFLOW.md` — development workflow and done definition
- `docs/ROADMAP.md` — phase status and remaining work
- `docs/research/RESEARCH_SUMMARY.md` — research lessons behind the restart

## Development notes

Run the full check before claiming a change is done:

```bash
npm run check
```

For behavior changes, update or add tests first when practical. Keep changes small, traceable to the product spec or roadmap, and inside the safety boundary: research and paper validation only, no live trading.
