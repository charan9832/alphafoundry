# AlphaFoundry Roadmap

AlphaFoundry is an agentic CLI for trading strategy development: idea -> spec -> code -> backtest -> optimize -> validate -> report -> paper execution.

## MVP: shipped in this repository

- CLI product shell with Typer and Rich.
- Local config and workspace initialization.
- Seed strategy templates migrated from the prior local Kronos prototype.
- Deterministic CSV data loader.
- Backtest engine with fee/slippage costs and no-lookahead signal shift.
- Metrics: total return, Sharpe, max drawdown, trade count.
- Validation: train/test split, stressed costs, Robust Alpha Score.
- Report generation to Markdown.
- Paper-mode simulator over historical data.
- Autoresearch loop scaffold with results.tsv logging.
- SimpleMem adapter with local fallback.
- LLM Wiki scaffold for global research brain.

## Next integration phases

### Phase 1: OpenBB data
- Add `alphafoundry data fetch`.
- Support equities, crypto, forex, macro, and news through OpenBB.
- Cache fetched data into workspace datasets.

### Phase 2: SimpleMem memory
- Use SimpleMem when installed.
- Store strategy postmortems, user preferences, failed experiments, and agent decisions.
- Keep local Markdown fallback for offline mode.

### Phase 3: LLM Wiki global brain
- Promote market research and integration notes into `wiki/` pages.
- Add commands: `alphafoundry wiki init`, `wiki add`, `wiki query`, `wiki lint`.

### Phase 4: Agentic strategy creation
- Add `alphafoundry chat` with OpenAI-compatible LLM config.
- Convert user strategy ideas into structured YAML specs.
- Generate strategy code from specs and templates.

### Phase 5: Autoresearch implementation
- Upgrade the current measurement scaffold into full Modify -> Verify -> Keep/Discard.
- Commit each experiment with `experiment:` prefix.
- Revert failed experiments.
- Optimize Robust Alpha Score under risk guards.

### Phase 6: Models
- Kronos plugin for financial K-line forecasting.
- TimesFM, MOMENT, Time-MoE as optional time-series model backends.
- FinBERT-style sentiment models later.

### Phase 7: Multi-agent system
- ResearchAgent: finds ideas and papers.
- DataAgent: fetches/cleans data.
- StrategyAgent: writes specs.
- CodeAgent: writes strategy code.
- BacktestAgent: evaluates strategy.
- OptimizerAgent: tunes parameters.
- ValidatorAgent: tries to disprove edge.
- RiskAgent: blocks unsafe configs.
- MemoryAgent: writes durable memory/wiki entries.
- ReportAgent: creates reports.

## Product rule

Do not implement live trading until paper trading, validation, risk controls, and human approval flows are mature.
