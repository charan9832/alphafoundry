# AlphaFoundry

**AlphaFoundry as Claude Code for trading strategies.**

AlphaFoundry is an agentic CLI workbench that turns trading strategy ideas into structured strategy projects, executable Python code, backtests, optimization runs, validation reports, and paper-trading journals.

It is not investment advice and does not promise profits. Its value is speed + rigor: generate ideas quickly, test them honestly, reject overfit strategies, and keep a reproducible research trail.

## Current MVP

- `alphafoundry init` creates a local config and workspace.
- `alphafoundry create` creates a strategy project from templates.
- `alphafoundry backtest` runs a deterministic backtest over CSV data.
- `alphafoundry validate` runs train/test, cost-stress, and robustness scoring.
- `alphafoundry optimize` performs bounded grid search over simple parameters.
- `alphafoundry autoresearch` implements a bounded Modify -> Verify -> Keep/Discard loop scaffold.
- `alphafoundry report` writes Markdown reports.
- `alphafoundry paper` simulates paper trading over historical data.
- `alphafoundry doctor` checks optional integrations: OpenBB, SimpleMem, LLM config, and local workspace.

## Why AlphaFoundry

Existing AI trading tools are often web-first, black-box, or signal-oriented. AlphaFoundry is different:

- CLI-first and developer-friendly
- local-first and private by default
- strategy code belongs to the user
- Git-friendly experiment workflow
- agentic workflow inspired by Claude Code, OpenCode, Hermes, and Autoresearch
- validation-first, not hype-first
- extensible model/data/memory/tool interfaces

## Core concepts

### Autoresearch

AlphaFoundry uses the Autoresearch pattern:

```text
Modify -> Verify -> Keep/Discard -> Repeat
```

For trading, this means one strategy change at a time, mechanical validation, and logged results.

### Memory and global brain

AlphaFoundry is designed for two memory layers:

- **SimpleMem** for agent memory: user preferences, decisions, lessons, failed experiments, postmortems.
- **LLM Wiki** for global research brain: papers, strategy families, model notes, market concepts, integration knowledge.

### Data and models

- **OpenBB** is the planned primary financial data layer.
- **Kronos** is a planned financial K-line/candlestick model plugin.
- **TimesFM**, **MOMENT**, and **Time-MoE** are planned optional time-series model plugins.

### Agent tools

Future agents should have constrained tools for:

- web research
- file read/edit
- shell/code execution
- data fetching
- backtesting
- validation
- reporting
- memory writes
- wiki updates

### Multi-agent roles

AlphaFoundry is designed to grow into a multi-agent system:

- ResearchAgent
- DataAgent
- StrategyAgent
- CodeAgent
- BacktestAgent
- OptimizerAgent
- ValidatorAgent
- RiskAgent
- MemoryAgent
- ReportAgent
- PaperAgent

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

AlphaFoundry defaults to paper mode. Live trading is intentionally not implemented in this MVP. Any future live trading path must be behind explicit human approval, independent risk guards, and a kill switch.

All performance numbers must come from deterministic engines, not LLM claims.
