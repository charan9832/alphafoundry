# AlphaFoundry Agent Guide

AlphaFoundry agents must follow these rules:

1. Paper trading first. Do not implement live trading without explicit human approval.
2. Use mechanical verification. Never trust LLM-generated performance numbers.
3. One strategy change per autoresearch iteration.
4. Keep/revert based on robust validation metrics.
5. Store durable lessons in memory/wiki, not transient logs.
6. Treat generated strategy code as untrusted until tests and validators pass.
7. Use constrained tools only: web search, file read/edit, shell/code execution, data fetch, backtest, validate, report, memory, and wiki.
8. Do not commit secrets, broker keys, private datasets, or API tokens.

## Product framing

AlphaFoundry is Claude Code for trading strategies.

The goal is not to promise guaranteed profit. The goal is to move from idea to tested, optimized, validated, paper-tradable strategy projects quickly and rigorously.

## Architecture references

- Autoresearch: Modify -> Verify -> Keep/Discard -> Repeat.
- SimpleMem: agent memory.
- LLM Wiki: global research brain.
- OpenBB: financial data.
- Kronos, TimesFM, MOMENT, Time-MoE: optional model plugins.
- TradingAgents-style roles: research, data, strategy, code, backtest, optimize, validate, risk, memory, report.
