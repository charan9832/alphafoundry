# AlphaFoundry

AlphaFoundry is a new, standalone, Pi-powered terminal product for local-first finance research. It is **not** a live trading bot and it is **not** a fork of Pi. Pi is used as internal agent infrastructure; AlphaFoundry owns the product experience, finance tools, safety rules, reports, and workflows.

## Product promise

Launch a serious AI finance research agent from the terminal:

```bash
alphafoundry
```

It onboards an LLM provider, checks finance tooling, opens a natural chat shell, and uses typed deterministic tools for research, strategy creation, backtesting, validation, reporting, memory, and paper simulation.

## Safety boundary

- Research, backtesting, validation, reports, and paper simulation only.
- No broker integration, live trading, order placement, or transaction execution.
- Performance numbers must come from deterministic tools and saved artifacts.
- Data provenance and assumptions must be shown.

## Development

```bash
npm install
npm run check
npm run dev -- doctor
npm run dev -- onboard --provider local --model local-finance-agent --non-interactive
npm run dev -- chat hey --json
npm run dev -- chat "build and test a simple SPY trend strategy" --json
```

## Current working product path

The offline product path now works end-to-end:

```text
chat request
-> local/Pi-compatible agent adapter
-> typed run_research_workflow tool
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

## Architecture

See:

- `AGENTS.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOW.md`
- `docs/ROADMAP.md`
- `docs/research/RESEARCH_SUMMARY.md`
