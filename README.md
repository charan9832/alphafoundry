# AlphaFoundry

**AlphaFoundry as Claude Code for trading strategies.**

AlphaFoundry is an agentic CLI workbench that turns trading strategy ideas into structured strategy projects, executable Python code, backtests, optimization runs, validation reports, and paper-trading journals.

It is not investment advice and does not promise profits. Its value is speed + rigor: generate ideas quickly, test them honestly, reject overfit strategies, and keep a reproducible research trail.

## Current MVP

- `alphafoundry init` creates a local config and workspace.
- `alphafoundry create` creates a strategy project from templates.
- `alphafoundry fetch` downloads OHLCV data through OpenBB with a yfinance fallback.
- `alphafoundry backtest` runs a deterministic backtest over CSV data.
- `alphafoundry validate` runs train/test, cost-stress, and robustness scoring.
- `alphafoundry optimize` performs bounded grid search over simple parameters.
- `alphafoundry autoresearch` implements a bounded Modify -> Verify -> Keep/Discard loop scaffold and saves per-iteration artifacts.
- `alphafoundry report` writes Markdown reports.
- `alphafoundry paper` simulates paper trading and appends replayable JSONL journal events.
- `alphafoundry run` executes the full local create/backtest/validate/optimize/report/paper/autoresearch pipeline.
- `alphafoundry status` summarizes a strategy project and its latest artifacts.
- `alphafoundry chat` accepts natural-language requests and executes create/run/status/list actions.
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
alphafoundry fetch SPY --start 2024-01-01 --end 2024-03-01 --output data/spy.csv
alphafoundry run demo --data examples/data/sample_prices.csv --iterations 2
alphafoundry chat "show status for demo"
alphafoundry chat "what strategies do I have?"
alphafoundry status demo
alphafoundry backtest demo --data examples/data/sample_prices.csv
alphafoundry validate demo --data examples/data/sample_prices.csv
alphafoundry report demo --data examples/data/sample_prices.csv
```

## Safety

AlphaFoundry defaults to paper mode. Live trading is intentionally not implemented in this MVP. Any future live trading path must be behind explicit human approval, independent risk guards, and a kill switch.

All performance numbers must come from deterministic engines, not LLM claims.
