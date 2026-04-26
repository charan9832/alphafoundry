# AlphaFoundry Architecture

AlphaFoundry is a CLI-first, local-first agentic workbench for systematic trading strategy development.

The product goal is simple:

> Take a trading idea and turn it into strategy code, a backtest, validation, optimization, a report, and a paper-trading setup as fast as possible.

AlphaFoundry should feel like Claude Code for trading strategies, not like a black-box signal seller.

## Layers

```text
User / Operator
  -> AlphaFoundry CLI
  -> Agent Orchestrator
  -> Tool Layer
  -> Strategy Workspace
  -> Data / Backtest / Validate / Optimize / Report / Paper
  -> Memory + Wiki
  -> Optional Model Plugins
```

## CLI layer

The CLI is the product surface.

Current commands:

- `alphafoundry init`
- `alphafoundry doctor`
- `alphafoundry create`
- `alphafoundry backtest`
- `alphafoundry validate`
- `alphafoundry optimize`
- `alphafoundry report`
- `alphafoundry paper`
- `alphafoundry autoresearch`
- `alphafoundry chat`

The CLI should stay scriptable and CI-friendly. Every major command should eventually support JSON output.

## Strategy workspace

Each strategy is a project:

```text
strategy-name/
  strategy.yaml
  strategy.py
  params.yaml
  backtests/
  validations/
  reports/
  paper/
  experiments/results.tsv
```

This keeps generated code, parameters, results, and experiments reproducible.

## Tool layer

Agents should have basic tools, but tools must be constrained:

- web search for research
- file read/edit for strategy projects
- shell/code execution for tests and backtests
- data fetch through OpenBB
- git commit/revert for experiments
- memory write through SimpleMem
- wiki update for curated knowledge

Tools are not allowed to bypass risk checks.

## Data layer

MVP:

- CSV OHLCV data

Planned:

- OpenBB for equities, crypto, forex, macro, and news
- cached datasets for reproducibility
- provider metadata attached to every backtest

## Backtest layer

The backtest layer is the truth source for strategy performance.

Current MVP:

- signal-based backtest
- no-lookahead position shift
- fee and slippage cost model
- equity curve and metrics

Planned:

- vectorbt for large parameter sweeps
- event-driven engine for complex strategies
- richer cost/slippage modeling
- multi-asset portfolios

## Validation layer

Validation is the moat.

Current MVP:

- train/test split
- stressed transaction costs
- Robust Alpha Score

Planned:

- walk-forward validation
- purged cross-validation
- parameter sensitivity
- regime split
- Monte Carlo trade resampling
- final untouched holdout

## Autoresearch layer

Autoresearch turns AlphaFoundry from a backtester into an improvement engine.

Pattern:

```text
Modify -> Verify -> Keep/Discard -> Repeat
```

Trading adaptation:

```text
1. Establish baseline Robust Alpha Score.
2. Make one strategy or parameter change.
3. Run validation mechanically.
4. Keep if score improves and risk guards pass.
5. Revert otherwise.
6. Append results.tsv.
```

## Memory layer

AlphaFoundry should use two memory systems:

### SimpleMem

Operational memory:

- user preferences
- strategy lessons
- experiment summaries
- paper-trading postmortems

### LLM Wiki / global brain

Curated research memory:

- strategy families
- papers
- model capabilities
- validation methodology
- integration notes

## Model plugin layer

Kronos is not the product. Kronos is one model plugin.

Planned model plugins:

- Kronos for financial candlestick/K-line forecasting
- TimesFM for general time-series forecasting
- MOMENT for time-series representation and anomaly detection
- Time-MoE for long-context time-series foundation modeling
- FinBERT-style sentiment models later

Model outputs should become features or research hints. They do not replace validation.

## Multi-agent system

AlphaFoundry should evolve toward a multi-agent team:

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

Each agent should have a narrow role and constrained tools.

## Safety architecture

- Paper mode by default.
- Live trading not included in MVP.
- Independent risk guards.
- No LLM-generated metric claims.
- No strategy promotion without validation.
- No secret storage in repo.
