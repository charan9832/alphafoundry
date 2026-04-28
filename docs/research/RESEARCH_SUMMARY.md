# Research Summary

This clean restart incorporates lessons from AI agent systems first. Finance research remains a future product direction, not the starting runtime.

## Agent/product systems

- **Pi / pi-mono**: useful as the agent/runtime/provider foundation. The npm packages `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` are MIT licensed and point to `github.com/badlogic/pi-mono`.
- **Goose/Aider/OpenCode/Claude Code**: the product should launch into an agent shell, not a static command list. Config, model selection, tool feedback, test loops, and context files matter.
- **OpenHands/LangGraph/MCP**: persistent conversation/event logs, typed tools, checkpointing, human approval gates, and schema-driven tool discovery are essential.
- **Spec Kit/BMAD/SWE-agent/Cline/Roo/MetaGPT**: repo-local workflow docs, specialist roles, work packets, review gates, and memory files prevent agent drift.

## Finance systems — later only

Finance systems such as OpenBB, Lean, NautilusTrader, backtrader, vectorbt, FinRobot, and TradingAgents are useful references for a future opt-in finance tool pack.

They are not part of the current starting point. Do not add default strategy templates, hardcoded backtests, live trading, broker/order/account flows, or profit promises to the core agent.

## Resulting requirements now

1. Agent-first terminal product.
2. `af` launches the TUI after onboarding.
3. `af onboard` configures LM/provider/base URL/API-key env/workspace and later search/tools.
4. Pi-powered provider/runtime boundary.
5. Typed default tools for readiness, search, projects, and notes.
6. Finance tools disabled/not present in default runtime.
7. Local-first config, sessions, and workspace state.
8. Secure secret handling by env var reference.
9. Test-gated, spec-driven development.
