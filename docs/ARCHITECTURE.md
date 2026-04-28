# Architecture

## Layers

```text
AlphaFoundry CLI / Chat Shell
  -> Onboarding + Config + Readiness
  -> Agent Core
      -> provider-neutral messages
      -> plan-first orchestrator
      -> run state + checkpoints
      -> human response renderer
  -> Model Adapter Boundary
      -> Pi SDK adapter when real providers are configured
      -> Local adapter for local tests and smoke runs
  -> Typed Tool Registry
      -> System/readiness tools
      -> Project and local memory tools
      -> Finance tool pack, registered after the core
      -> Safety and approval gates
  -> Tool Backends
      -> Python finance engine bridge for finance plugin/tool pack
  -> Workspace
      -> sessions/*.jsonl
      -> runs/**
      -> projects/**
      -> reports/*.md
      -> artifacts/*.json
      -> memory/lessons.jsonl
      -> paper-journal/**
```

## Pi usage route

AlphaFoundry uses Pi as infrastructure:

- `@mariozechner/pi-ai` for provider/model/tool-capable LLM APIs.
- A local facade keeps AlphaFoundry decoupled from Pi API churn.
- Real providers are accessed through `PiSdkAgentAdapter`; tests and offline smoke use `LocalAgentAdapter`.

Normal users interact with `alphafoundry`, not `pi`.

## Runtime principle

The core runtime is domain-neutral. It plans first, executes only registered tools, checkpoints the run, and renders a human-readable answer:

```text
User message
  -> safety gate
  -> create ResearchRun
  -> create plan
  -> checkpoint planning state
  -> execute registered tools
  -> record structured observations
  -> checkpoint execution/completion state
  -> assistant response
  -> session event log
```

Finance behavior is not the core. Finance is a registered tool pack that can provide backtests, validation, paper journals, and finance-specific policy. The LLM may never invent metrics or bypass the registry. Tool-backed results are rendered with artifact paths and warnings.

## Python bridge

`src/tools/pythonBridge.ts` spawns `python3 python/finance_engine/local_engine.py` with `shell: false`, sends one JSON request on stdin, and expects one JSON response on stdout.

Supported methods now:

- `ping`
- `run_backtest`
- `run_research_workflow`
- `run_validation_suite`
- `optimize_strategy`

The current Python engine is deterministic and stdlib-only. It generates local price data, runs a moving-average trend baseline, validates checks, runs cost-stress/sensitivity guardrails, performs bounded parameter search, and returns report markdown. It does not fetch live data, connect to brokers, or place orders.

## Secret handling

Config stores only the environment variable name containing a secret. Example:

```json
{ "provider": "openrouter", "apiKeyEnv": "OPENROUTER_API_KEY" }
```

Raw API keys are rejected by tests and redacted from logs.
