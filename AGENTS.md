# AlphaFoundry Agent Guide

AlphaFoundry is a standalone terminal AI product. Treat `af`, the docs, configuration, doctor checks, and the Ink TUI as AlphaFoundry-owned surfaces.

## Product identity

- Product name: AlphaFoundry
- Package name: `alphafoundry`
- CLI commands: `af` and `alphafoundry`
- Default config: `~/.alphafoundry/config.json`
- Config override: `ALPHAFOUNDRY_CONFIG_PATH`

Do not describe AlphaFoundry as a rebrand, thin wrapper, or launcher. The current runtime adapter uses `@mariozechner/pi-coding-agent`, but Pi Agent is not the product identity. Mention Pi Agent only when discussing runtime internals, backend delegation, diagnostics, or adapter behavior.

## Architecture boundaries

AlphaFoundry-owned layers:

- Native CLI command surface: `init`, `doctor`, `config`, `models`, `session`, `sessions`, `tui`, and `af -p` one-shot prompts
- Product docs and onboarding
- Config schema that stores provider/model/env var names only
- Doctor/diagnostic reporting
- Durable run/session/event records and redacted exports
- Generic permission/protected-path decisions and verification evidence summaries
- Ink TUI workflow and state model

Runtime adapter layer:

- Model/tool execution
- Provider-specific behavior
- Pi built-in tool execution when allowed through mapped adapter flags
- Backend session details beyond current AlphaFoundry session/event persistence

## Config and secrets

Never store raw secrets in AlphaFoundry config. Store environment variable names such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `ALPHAFOUNDRY_API_KEY`.

Allowed config keys are intentionally narrow:

- `provider`
- `model`
- `env.apiKey`
- `env.baseUrl`

## Development workflow

Use TDD for command/config/doctor behavior:

1. Add or update tests first.
2. Run the relevant failing test.
3. Implement the smallest product change.
4. Run `npm test`.
5. Do not commit unless explicitly asked.

Respect ownership boundaries. Do not modify `src/tui/**`, `src/pi-runtime/**`, or backend adapter files when working only on product identity/config/doctor tasks unless the task explicitly allows it.

## Documentation tone

Docs should present AlphaFoundry as the product users install and operate. Keep runtime adapter details in diagnostics, troubleshooting, or architecture notes. Prefer Windows-friendly npm and PowerShell examples when showing install/update/config commands. Do not overclaim production readiness: current control-plane docs should distinguish implemented durable one-shot session/event recording from future live streaming, richer tool events, approval persistence, replay/evals, MCP, native AlphaFoundry tools, and autonomous workflows.

## No-finance boundary

Do not add finance tools, trading workflows, market-data connectors, broker/exchange APIs, portfolio logic, alpha models, finance-specific MCP servers, finance config keys, or finance examples. Future finance work can only be described as gated, opt-in, read-only research/council/tool-pack exploration after the generic plugin boundary, permissions, redaction, replay/evals, and default-excludes-finance behavior exist and are tested.
