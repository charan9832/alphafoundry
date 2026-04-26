# AlphaFoundry Agent Guide

This repository is a clean restart. Treat old AlphaFoundry history as reference only, not source of truth.

## Required first read

Before code changes, every agent must read:

1. `AGENTS.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/research/RESEARCH_SUMMARY.md`
4. `docs/ARCHITECTURE.md`
5. `docs/WORKFLOW.md`
6. `docs/ROADMAP.md`
7. Relevant source and tests

## Non-negotiable product rules

1. This is a new standalone product using Pi internally, not a Pi package and not a Pi fork unless explicitly approved later.
2. Do not implement live trading, broker execution, orders, account access, or automated transaction flows.
3. Use typed tools for finance actions. The LLM may explain, choose, and orchestrate; deterministic tools must compute.
4. No invented metrics. If a result is not produced by a tool/artifact, say it is unknown.
5. Preserve provenance: provider, symbol, date range, assumptions, fees/slippage, warnings, timestamps.
6. Secrets must not be stored in repo or plaintext config. Store secret environment variable names, not secret values.
7. Use TDD for behavior changes. Add tests before production code when practical.
8. Run `npm run check` before claiming done.
9. Keep changes small, reviewable, and traceable to `docs/PRODUCT_SPEC.md` or `docs/ROADMAP.md`.
10. Old `/root/alphafoundry-*archive*` repos are archival; do not modify them unless asked.

## Product framing

AlphaFoundry should feel like a local AI finance research terminal: natural chat, tool-backed evidence, saved artifacts, honest limits, and strong safety gates. The user should not feel like they are using a generic coding agent with finance prompts bolted on.
