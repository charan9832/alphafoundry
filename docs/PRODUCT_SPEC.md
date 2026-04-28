# Product Specification

## Vision

AlphaFoundry is a local-first, Pi-powered terminal AI agent. The current goal is simple: make `af` launch a useful AI agent/TUI, make `af onboard` configure language models and tools, and keep the product reliable before adding finance.

Finance comes later as optional tool packs. The starting point must not contain predefined strategies, strategy templates, trading systems, broker flows, or hardcoded backtest behavior in the default runtime.

## Product identity

AlphaFoundry is:

- A standalone branded product with its own CLI, onboarding, TUI, config, prompts, docs, and workspace.
- A rebranded/adapted Pi Agent direction where legally and technically practical; Pi packages are MIT and come from `github.com/badlogic/pi-mono`.
- A general AI agent first: chat, provider configuration, typed tools, session logs, readiness checks, search configuration, and workspace management.
- Local-first and private by default.

AlphaFoundry is not, at this stage:

- A finance strategy engine.
- A command-first backtesting script.
- A live trading bot.
- A signal seller.
- A collection of predefined trading strategies.

## Command surface

The product should feel simple:

```bash
af              # launch the TUI when onboarded; otherwise show setup guidance
af onboard      # configure LM/provider/API-key env/base URL/workspace/search tools
af doctor       # verify readiness
af chat "..."   # one-shot non-TUI chat
af tui          # explicit TUI launch
```

The package also exposes `alphafoundry`, but `af` is the preferred command.

## Onboarding requirements

Onboarding must configure:

- provider: local, OpenAI-compatible, Azure OpenAI, OpenRouter, Anthropic, Gemini, or future local providers
- model name
- base URL if applicable
- API key environment variable name, never raw key persistence
- workspace path
- optional search tool endpoint/env var, with local SearXNG/Firecrawl auto-detection

Onboarding must run:

- config check
- workspace creation check
- LLM/provider readiness check where possible
- agent runtime readiness check
- safety/config hygiene check

## Agent behavior

The LLM is the brain. Typed tools are the hands.

The default agent should:

- respond naturally to simple messages like `hey`
- open in a TUI from `af`
- use configured models through the Pi adapter when real providers are configured
- use local mode for tests/smoke checks
- call tools for readiness, web search, project organization, and durable notes
- persist event logs in the workspace
- ask for clarification when a task is ambiguous
- refuse or defer finance/trading strategy work until finance tools are explicitly added later

## Finance boundary

Finance is a later layer, not the current starting point.

Rules:

- Do not register finance tools in the default runtime.
- Do not route messages like “build a strategy” or “backtest SPY” into hardcoded workflows.
- Do not include predefined strategies in the agent-first starting point.
- Keep any old finance code as future-reference/tool-pack material only unless explicitly re-enabled.

## Product-complete first milestone

A good starting point is complete when:

- `npm run check` passes.
- `af` opens the TUI in a TTY after onboarding.
- `af onboard` creates safe config using env var names, not raw keys.
- `af doctor` reports config/workspace/LLM/runtime readiness.
- `af chat "hey"` works.
- `af chat "build a strategy and backtest SPY"` does not run predefined finance tools.
- README and docs describe an AI agent first, finance later.
