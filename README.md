# AlphaFoundry

**Claude Code for trading strategies.**

AlphaFoundry is an agentic CLI workbench that turns trading strategy ideas into structured strategy projects, executable Python code, backtests, optimization runs, validation reports, and paper-trading journals.

It is not investment advice and does not promise profits. Its value is speed + rigor: generate ideas quickly, test them honestly, reject overfit strategies, and keep a reproducible research trail.

## Current MVP

- `alphafoundry init` creates a local config and workspace.
- `alphafoundry create` creates a strategy project from templates.
- `alphafoundry backtest` runs a deterministic backtest over CSV data.
- `alphafoundry validate` runs train/test, cost-stress, and robustness scoring.
- `alphafoundry optimize` performs bounded grid search over simple parameters.
- `alphafoundry autoresearch` implements a bounded Modify -> Verify -> Keep/Discard loop.
- `alphafoundry report` writes Markdown reports.
- `alphafoundry paper` simulates paper trading over historical/live-like data.
- `alphafoundry doctor` checks optional integrations: OpenBB, SimpleMem, LLM config, and local workspace.

## Why AlphaFoundry

Existing AI trading tools are often web-first, black-box, or signal-oriented. AlphaFoundry is different:

- CLI-first and developer-friendly
- local-first and private by default
- strategy code belongs to the user
- Git-friendly experiment workflow
- validation-first, not hype-first
- extensible model/data/memory/tool interfaces

## Core integrations planned

- **Autoresearch**: goal + metric + scope + verify loop for strategy improvement.
- **SimpleMem**: long-term agent memory for decisions, lessons, and strategy postmortems.
- **LLM Wiki**: curated global research brain for market concepts, papers, and integrations.
- **OpenBB**: financial data layer for equities, crypto, forex, macro, and news.
- **Kronos**: optional financial K-line/candlestick foundation model plugin.
- **TradingAgents-style multi-agent roles**: researcher, coder, backtester, validator, risk manager, reporter.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
alphafoundry init
alphafoundry doctor
alphafoundry create demo --template momentum
alphafoundry backtest demo --data examples/data/sample_prices.csv
alphafoundry validate demo --data examples/data/sample_prices.csv
alphafoundry report demo --data examples/data/sample_prices.csv
```

## Safety

AlphaFoundry defaults to paper mode. Live trading is intentionally not implemented in this MVP. Any future live trading path must be behind explicit human approval and independent risk guards.
