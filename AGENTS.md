# AlphaFoundry Agent Guide

This repository is the AlphaFoundry starting point. Treat old AlphaFoundry finance/backtest work as reference only, not source of truth.

## Required first read

Before code changes, every agent must read:

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/WORKFLOW.md`
5. `docs/ROADMAP.md`
6. Relevant source and tests

## Non-negotiable product rules

1. AlphaFoundry is an AI agent first. Make the agent work before adding finance.
2. The preferred command is `af`; bare `af` launches the TUI when onboarded.
3. `af onboard` configures language models, provider/base URL/API-key env names, workspace, and later search/tool configuration.
4. Do not add predefined strategies, trading templates, hardcoded backtest flows, broker execution, orders, account access, or automated transaction flows to the default runtime.
5. Finance features come later as explicit tool packs/plugins, not core behavior.
6. Secrets must not be stored in repo or plaintext config. Store secret environment variable names, not secret values.
7. Use TDD for behavior changes. Add tests before production code when practical.
8. Run `npm run check` before claiming done.
9. Keep changes small, reviewable, and traceable to `docs/PRODUCT_SPEC.md` or `docs/ROADMAP.md`.
10. Old `/root/alphafoundry-*archive*` repos are archival; do not modify them unless asked.

## Product framing

AlphaFoundry should feel like a rebranded/adapted Pi-style terminal AI agent with a clean command surface:

```bash
af
af onboard
af doctor
af chat "..."
```

The user should not feel like they are using a finance strategy bot right now. They should feel like they have a working local AI agent that can later gain finance tools.
