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
      -> Finance data/backtest/report tools
      -> Safety and approval gates
  -> Python Finance Engine Bridge
      -> deterministic data/backtest/validation/report code
  -> Workspace
      -> sessions/*.jsonl
      -> reports/*.md
      -> artifacts/*.json
      -> memory/*.md later
```

## Pi usage route

AlphaFoundry uses Pi as infrastructure:

- `@mariozechner/pi-ai` for provider/model/tool-capable LLM APIs.
- `@mariozechner/pi-agent-core` for stateful agent/tool loop integration.
- A local facade keeps AlphaFoundry decoupled from Pi API churn.

Normal users interact with `alphafoundry`, not `pi`.

## Runtime principle

All finance actions flow through typed tools:

```text
User message -> Agent runtime -> Safety gate -> Tool registry -> Finance bridge -> Observation -> Assistant response -> Event log
```

The LLM may never invent metrics or bypass the registry.

## Secret handling

Config stores only the environment variable name containing a secret. Example:

```json
{ "provider": "openrouter", "apiKeyEnv": "OPENROUTER_API_KEY" }
```

Raw API keys are rejected by tests and redacted from logs.
