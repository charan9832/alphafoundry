# AlphaFoundry Security Scan

ECC-inspired security scan tailored to AlphaFoundry's current foundation stage.

Use before commit, after policy/config/redaction changes, or when touching runtime/session/export behavior.

Check:
1. No raw secrets in source/docs/config.
2. Config stores env var names only, not key values.
3. Redaction occurs before persistence/export where relevant.
4. Unknown tools/capabilities fail closed.
5. Protected paths remain protected.
6. No finance/trading/broker/market-data features were added.
7. No MCP execution was added before approved phase.
8. No native AlphaFoundry shell/file/tool executor was added before approved phase.
9. Error messages do not leak secrets or sensitive paths.

Suggested local scans:
- search changed files for token-like patterns
- inspect config schema changes
- inspect event/session persistence changes
- run relevant tests plus `npm run check`

Do not print secret values if found. Report only file/path and redacted evidence.
