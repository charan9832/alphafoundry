# AlphaFoundry Integrations

AlphaFoundry is designed as an agentic trading-strategy workbench. The core product stays small and deterministic, while integrations add data, memory, research, forecasting, backtesting scale, and multi-agent reasoning.

## Integration philosophy

1. Keep the MVP deterministic and testable.
2. Treat LLM output as suggestions, never as verified performance.
3. Put every strategy through mechanical backtesting, validation, and risk checks.
4. Prefer local-first and user-owned code/data.
5. Make every integration optional so AlphaFoundry still works offline with CSV data.

## Core integrations

| Integration | Repository / Package | Role in AlphaFoundry | Priority |
|---|---|---|---|
| Autoresearch | `uditgoenka/autoresearch` | Strategy improvement loop: Modify -> Verify -> Keep/Discard -> Repeat | Required |
| SimpleMem | `aiming-lab/SimpleMem` | Long-term agent memory for preferences, strategy lessons, and postmortems | Required |
| LLM Wiki | Karpathy LLM Wiki pattern | Global research brain: papers, concepts, strategy families, integration notes | Required |
| OpenBB | `OpenBB-finance/OpenBB` | Financial data layer for equities, crypto, forex, macro, news | Required |
| vectorbt | `polakowo/vectorbt` | Fast parameter sweeps and vectorized backtesting at scale | High |
| Kronos | `shiyu-coder/Kronos` / `NeoQuasar/Kronos-*` | Financial candlestick/K-line foundation model plugin | High |
| TradingAgents | `TauricResearch/TradingAgents` | Multi-agent architecture inspiration: analysts, researchers, trader, risk manager | High |
| QuantDinger | `brokermr810/QuantDinger` | Self-hosted AI quant OS inspiration | Medium |
| TimesFM | `google-research/timesfm` | General time-series forecasting baseline/model plugin | Medium |
| MOMENT | `moment-timeseries-foundation-model/moment` | Time-series representation/anomaly/forecasting model plugin | Medium |
| Time-MoE | `Time-MoE/Time-MoE` | Large time-series foundation model plugin | Medium |

## Basic agent tools

AlphaFoundry agents should eventually have a constrained toolbelt:

- `web.search`: find papers, repos, docs, market context
- `file.read`: inspect strategy specs, reports, logs
- `file.edit`: modify strategy code/specs inside allowed scope
- `shell.run`: run tests, backtests, validation commands
- `code.execute`: run deterministic Python analysis
- `data.fetch`: call OpenBB/data providers
- `git.commit`: checkpoint experiments
- `git.revert`: rollback failed experiments
- `memory.write`: store durable lessons in SimpleMem
- `wiki.update`: update global research brain pages

Tools must be permissioned. Strategy agents should not bypass risk controls or execute live trades.

## Autoresearch integration

Autoresearch is the core improvement engine.

Generic loop:

```text
Modify -> Verify -> Keep/Discard -> Repeat
```

AlphaFoundry loop:

```text
1. Read strategy spec, code, prior experiments, and metric history.
2. Make one scoped change to strategy code or params.
3. Run `alphafoundry validate` mechanically.
4. Keep if Robust Alpha Score improves and risk guards pass.
5. Revert if worse, invalid, or unsafe.
6. Append result to experiments/results.tsv.
7. Repeat for N iterations.
```

Example future command:

```bash
alphafoundry autoresearch btc_mean_reversion \
  --data data/BTC-USD-1h.csv \
  --metric robust_alpha_score \
  --iterations 25
```

## SimpleMem integration

SimpleMem should store durable, compact memories such as:

- user risk preferences
- strategy ideas the user likes
- successful strategy patterns
- failed experiments and why they failed
- market regime notes
- paper-trading drift observations
- integration decisions

MVP behavior:

- If SimpleMem is installed, use it.
- If not installed, write local Markdown fallback memories under the workspace.
- Never store API keys, broker secrets, or raw private trading data.

## LLM Wiki / global brain

The wiki is for curated knowledge, not noisy logs.

Recommended structure:

```text
wiki/
  SCHEMA.md
  index.md
  log.md
  concepts/
  strategies/
  models/
  integrations/
  postmortems/
  papers/
```

Use it for:

- strategy family notes
- paper summaries
- model capability notes
- OpenBB data assumptions
- validation methodology
- postmortems
- reusable prompts/specs

## OpenBB integration

OpenBB should become the primary market data interface.

Future commands:

```bash
alphafoundry data fetch BTC-USD --asset crypto --timeframe 1h
alphafoundry data fetch AAPL --asset equity --timeframe 1d
alphafoundry data providers
```

Initial implementation should cache OpenBB output to workspace CSV/Parquet so backtests remain reproducible.

## Model plugin layer

AlphaFoundry should treat forecasting models as optional plugins, not as the core product.

### Kronos

Role: finance-specific K-line/candlestick model.

Use for:

- forecast features
- regime hints
- candidate signal generation
- strategy research

### TimesFM

Role: general time-series forecast baseline.

Use for:

- baseline forecasts
- forecast uncertainty comparison
- non-financial time-series features

### MOMENT

Role: time-series representation/anomaly model.

Use for:

- anomaly detection
- embeddings/regime features
- representation learning

### Time-MoE

Role: large-scale time-series foundation model.

Use for:

- experimental forecasting backend
- long-context sequence modeling

## Multi-agent architecture

Future AlphaFoundry should support specialized agents:

| Agent | Responsibility |
|---|---|
| ResearchAgent | Finds strategy ideas, papers, repos, and market hypotheses |
| DataAgent | Fetches, validates, and caches market data |
| StrategyAgent | Converts ideas into structured strategy specs |
| CodeAgent | Writes strategy code from specs/templates |
| BacktestAgent | Runs backtests and produces metrics |
| OptimizerAgent | Tunes parameters within bounded search space |
| ValidatorAgent | Looks for overfitting, leakage, regime fragility |
| RiskAgent | Enforces hard risk limits and paper-first policy |
| MemoryAgent | Writes durable lessons to SimpleMem and wiki |
| ReportAgent | Generates Markdown/HTML/PDF reports |
| PaperAgent | Runs paper execution and monitors drift |

## Safety boundaries

- Live trading is out of scope for MVP.
- Paper mode remains default.
- All strategy performance numbers must come from deterministic engines.
- Generated strategies are untrusted until tests, validation, and risk checks pass.
- Backtests must include transaction costs and avoid lookahead bias.
