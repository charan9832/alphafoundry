# Research Summary

This clean restart incorporates lessons from researched agent and finance systems.

## Agent/product systems

- **Pi**: use as internal agent infrastructure. Valuable pieces: provider abstraction, tool-calling runtime, sessions, extensibility, TUI/RPC/SDK patterns. Do not ship as generic Pi-with-plugin UX.
- **Goose/Aider/OpenCode/Claude Code**: the product should launch into an agent shell, not a static command list. Config, model selection, tool feedback, test loops, and context files matter.
- **OpenHands/LangGraph/MCP**: persistent conversation/event logs, typed tools, checkpointing, human approval gates, and schema-driven tool discovery are essential.
- **Spec Kit/BMAD/SWE-agent/Cline/Roo/MetaGPT**: use repo-local workflow docs, specialist roles, work packets, review gates, and memory files to prevent agent drift.

## Finance systems

- **OpenBB**: data access must preserve provider metadata, warnings, timestamps, routes, and provenance.
- **Lean/NautilusTrader/backtrader/vectorbt**: keep research/backtest/optimize/validate separated. Treat fills, costs, slippage, no-lookahead, and validation seriously. Avoid live trading in early product.
- **FinRobot/TradingAgents**: professional reports, role separation, provider flexibility, decision logs, and disclaimers are useful. AlphaFoundry must be stricter about reproducible tool-backed results.

## Resulting requirements

1. Agent-first terminal product.
2. Pi-powered internal runtime, not generic Pi UX.
3. Typed finance tools with provenance.
4. Deterministic backtests and validation.
5. No live trading.
6. Local-first config, artifacts, and sessions.
7. Secure secret handling by env var reference.
8. Test-gated, spec-driven development.
