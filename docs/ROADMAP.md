# AlphaFoundry Roadmap

AlphaFoundry is an agentic CLI for trading strategy development: idea -> spec -> code -> backtest -> optimize -> validate -> report -> paper execution.

## MVP: shipped in this repository

- CLI product shell with Typer and Rich.
- Local config and workspace initialization.
- Seed strategy templates migrated from the prior local prototype.
- Deterministic CSV data loader.
- Backtest engine with fee/slippage costs and no-lookahead signal shift.
- Metrics: total return, Sharpe, max drawdown, trade count.
- Validation: train/test split, stressed costs, Robust Alpha Score.
- Report generation to Markdown.
- Paper-mode simulator over historical data.
- Autoresearch loop scaffold with results.tsv logging.
- SimpleMem adapter with local fallback.
- LLM Wiki scaffold for research/global brain.

## Phase 1: harden the MVP

- Add tests for no-lookahead behavior.
- Add tests for transaction costs and signal clipping.
- Improve Robust Alpha Score with more transparent components.
- Add JSON output flags consistently.
- Add richer sample datasets.
- Add CI through GitHub Actions.

## Phase 2: OpenBB data layer

- Add `alphafoundry data fetch`.
- Support equities, crypto, forex, macro, and news through OpenBB.
- Cache fetched data into workspace datasets.
- Store provider/source metadata with each dataset.

## Phase 3: SimpleMem memory

- Use SimpleMem when installed.
- Store strategy postmortems, user preferences, failed experiments, and agent decisions.
- Keep local Markdown fallback for offline mode.
- Add `alphafoundry memory search` and `alphafoundry memory add`.

## Phase 4: LLM Wiki global brain

- Promote market research and integration notes into `wiki/` pages.
- Add commands: `alphafoundry wiki init`, `wiki add`, `wiki query`, `wiki lint`.
- Store strategy-family pages, paper summaries, model notes, and validation lessons.

## Phase 5: Agentic strategy creation

- Add `alphafoundry chat` with OpenAI-compatible LLM config.
- Convert user strategy ideas into structured YAML specs.
- Generate strategy code from specs and templates.
- Give the agent tools for web search, file edits, shell commands, data fetch, backtest, validate, report, memory, and wiki.

## Phase 6: Full Autoresearch implementation

- Upgrade the current measurement scaffold into full Modify -> Verify -> Keep/Discard.
- Commit each experiment with `experiment:` prefix.
- Revert failed experiments.
- Optimize Robust Alpha Score under risk guards.
- Support bounded iteration counts and resumable experiment logs.

## Phase 7: Backtesting scale

- Integrate vectorbt for fast parameter sweeps.
- Add walk-forward optimization.
- Add multi-asset portfolios.
- Add Monte Carlo trade resampling and regime stress tests.

## Phase 8: Model plugins

- Kronos plugin for financial K-line forecasting.
- TimesFM as a general time-series baseline.
- MOMENT for representation/anomaly/forecasting tasks.
- Time-MoE as an experimental large time-series backend.
- FinBERT-style news/sentiment plugins later.

## Phase 9: Multi-agent system

- ResearchAgent: finds ideas and papers.
- DataAgent: fetches and validates data.
- StrategyAgent: writes specs.
- CodeAgent: writes strategy code.
- BacktestAgent: evaluates strategy.
- OptimizerAgent: tunes parameters.
- ValidatorAgent: tries to disprove edge.
- RiskAgent: blocks unsafe configs.
- MemoryAgent: writes durable memory/wiki entries.
- ReportAgent: creates reports.

## Phase 10: Paper execution

- Add better paper execution loop.
- Add signal journal.
- Compare live paper performance to historical validation.
- Trigger drift alerts.
- Keep kill switch and hard risk guards.

## Product rule

Do not implement live trading until paper trading, validation, risk controls, and human approval flows are mature.
