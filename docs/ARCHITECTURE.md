# Architecture

## Layers

```text
AlphaFoundry CLI / Chat Shell
  -> Onboarding + Config + Readiness
  -> Agent Runtime Facade
      -> Pi SDK adapter when real providers are configured
      -> Mock adapter for local tests and smoke runs
  -> Typed Tool Registry
      -> System/readiness tools
      -> Finance research workflow tools
      -> Safety and approval gates
  -> Python Finance Engine Bridge
      -> deterministic local data/backtest/validation/report code
  -> Workspace
      -> sessions/*.jsonl
      -> reports/*.md
      -> artifacts/*.json
      -> memory/*.md later
```

## Pi usage route

AlphaFoundry uses Pi as infrastructure:

- `@mariozechner/pi-ai` for provider/model/tool-capable LLM APIs.
- A local facade keeps AlphaFoundry decoupled from Pi API churn.
- Real providers are accessed through `PiSdkAgentAdapter`; tests and offline smoke use `MockAgentAdapter`.

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

`src/tools/pythonBridge.ts` spawns `python3 python/finance_engine/mock_engine.py` with `shell: false`, sends one JSON request on stdin, and expects one JSON response on stdout.

Supported methods now:

- `ping`
- `run_backtest`
- `run_research_workflow`

The current Python engine is deterministic and stdlib-only. It generates local mock price data, runs a moving-average trend baseline, validates checks, and returns report markdown. It does not fetch live data, connect to brokers, or place orders.

## Secret handling

Config stores only the environment variable name containing a secret. Example:

```json
{ "provider": "openrouter", "apiKeyEnv": "OPENROUTER_API_KEY" }
```

Raw API keys are rejected by tests and redacted from logs.
