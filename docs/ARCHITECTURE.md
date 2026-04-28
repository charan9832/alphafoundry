# Architecture

## Layers

```text
AlphaFoundry CLI / Chat Shell
  -> Onboarding + Config + Readiness
  -> Agent Runtime Facade
      -> Pi SDK adapter when real providers are configured
      -> Local adapter for local tests and smoke runs
  -> Typed Tool Registry
      -> System/readiness tools
      -> Finance research workflow tools
      -> Validation/optimization tools
      -> Project, local memory, and paper-journal tools
      -> Safety and approval gates
  -> Python Finance Engine Bridge
      -> deterministic local data/backtest/validation/optimization/report code
  -> Workspace
      -> sessions/*.jsonl
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

All finance actions flow through typed tools:

```text
User message
  -> safety gate
  -> agent adapter chooses text or tool call
  -> tool registry validates tool name
  -> Python finance bridge for deterministic research workflows
  -> observation with provenance/warnings
  -> assistant response
  -> session event log
```

The LLM may never invent metrics or bypass the registry. Tool-backed results are rendered with artifact paths and warnings.

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
