# AlphaFoundry Boundary Check

Review the current diff or proposed change for roadmap/security boundary violations.

Blocking boundary violations:
- finance/trading/market-data/broker/exchange/portfolio/strategy additions
- finance-specific docs/examples/tests/config
- native AlphaFoundry file/shell/tool execution handlers before approved phase
- MCP execution before approved phase
- YOLO/bypass permissions
- raw secrets, `.env` reads, token values, or credential persistence
- config stores API key values instead of env var names
- product identity regressions: AlphaFoundry described as wrapper/rebrand/launcher
- Pi public implementation details leaking into user-facing UX instead of diagnostics
- unvalidated explicit tool names or fail-open behavior
- package includes local state, secrets, sessions, tarballs, node_modules, or test junk

Suggested commands when appropriate:
- `git diff --stat`
- `git diff --check`
- targeted search of changed files for finance/secret/native-tool terms
- `npm run check` if behavior changed

Output:
- overall PASS/WARN/FAIL
- blocking findings
- non-blocking findings
- recommended fixes

Do not edit unless asked.
