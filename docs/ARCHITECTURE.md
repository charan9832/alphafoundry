# Architecture

## Current architecture: AI agent first

```text
AlphaFoundry CLI / TUI (`af`)
  -> Onboarding + Config + Readiness
  -> Agent Core
      -> provider-neutral requests/responses
      -> local smoke adapter
      -> Pi SDK adapter for real providers
      -> run/session logging
  -> Typed Tool Registry
      -> readiness
      -> optional web_search
      -> project organization
      -> durable notes/memory
  -> Workspace
      -> sessions/*.jsonl
      -> runs/**
      -> projects/**
      -> memory/lessons.jsonl
```

The starting point is intentionally domain-neutral. It should be a working terminal AI agent before finance is added.

## Pi usage route

AlphaFoundry’s intended product direction is to clone/adapt/rebrand Pi Agent patterns where practical, then expose a simple AlphaFoundry command surface.

Current Pi facts:

- `@mariozechner/pi-ai` is MIT licensed.
- `@mariozechner/pi-agent-core` is MIT licensed.
- Both point to `github.com/badlogic/pi-mono` on npm.

AlphaFoundry owns:

- product name and command surface: `af`
- onboarding flow
- TUI labels/rendering
- config/workspace conventions
- tool policy and safety boundaries
- docs and roadmap

Pi/Pi-style infrastructure owns or inspires:

- provider/model abstraction
- tool-capable LLM calls
- agent runtime concepts

## Runtime principle

The core runtime executes only registered tools. No LLM response can bypass the registry.

```text
User message
  -> safety/config gate
  -> model adapter
  -> optional tool call through registry
  -> structured observation
  -> assistant response
  -> session event log
```

## Default tool boundary

Default tools are general-agent tools only:

- readiness
- web search, when configured
- project organization
- durable local notes

Finance/trading tools are not registered in the default starting runtime.

## Finance later

Old finance code may exist as future-reference material, but the agent-first product must not route default prompts into predefined strategies, backtests, optimizers, broker flows, or trading systems.

When finance is added later, it should be an explicit tool pack/plugin with its own tests, docs, and safety gates.

## Secret handling

Config stores only environment variable names containing secrets. Example:

```json
{ "provider": "openrouter", "apiKeyEnv": "OPENROUTER_API_KEY" }
```

Raw API keys are rejected by tests and redacted from logs.
