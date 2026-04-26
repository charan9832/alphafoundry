# Product Specification

## Vision

AlphaFoundry is a local-first, Pi-powered AI finance research agent launched from the terminal. It chats naturally, uses deterministic finance tools, records evidence, generates reports, and supports research/backtesting/paper-validation workflows without making unsupported financial claims.

## Product identity

AlphaFoundry is:

- A standalone product with its own CLI, onboarding, UX, prompts, tools, reports, and safety policy.
- Powered internally by Pi libraries (`@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`) where useful.
- Backed by deterministic finance tools and a Python finance engine bridge.
- Local-first and private by default.

AlphaFoundry is not:

- A Pi fork by default.
- A Pi package as the final product.
- A command-first backtesting script.
- A live trading bot.
- A signal seller.

## Launch experience

`alphafoundry` should:

1. Show onboarding if configuration is incomplete.
2. Otherwise open the chat-first research agent shell.
3. Let deterministic subcommands exist for testing and automation, but keep chat as the primary UX.

## Onboarding requirements

Onboarding must configure:

- provider: mock, OpenAI-compatible, Azure OpenAI, OpenRouter, Anthropic, Gemini, or local provider later
- model name
- base URL if applicable
- API key environment variable name, never raw key persistence
- workspace path

Onboarding must run:

- LLM readiness check
- finance tool readiness check
- workspace creation check
- safety mode confirmation

## Agent behavior

The LLM is the brain. Typed deterministic tools are the hands.

The agent should:

- respond naturally to simple messages like `hey`
- ask clarifying questions when assumptions materially affect a financial result
- call tools for readiness, data, backtesting, validation, reports, memory, and paper simulation
- persist event logs
- save artifacts for serious workflows
- refuse live trading and broker/order requests
- explain limitations and next steps

## Product-complete target

A product-complete first release must support:

- first-run onboarding
- real provider configuration path plus mock test path
- Pi-backed or Pi-compatible agent runtime
- typed tool registry
- deterministic finance tool bridge
- full chat-driven workflow: idea -> data/provenance -> strategy spec -> backtest -> validation -> report -> lesson
- event logs and artifacts
- safety gates and disclaimers
- packageable CLI
