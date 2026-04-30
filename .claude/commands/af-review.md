# AlphaFoundry Review

Perform a read-only, severity-labeled review of AlphaFoundry changes.

Review only the current diff unless the user asks for a broader audit.

Review dimensions:
1. Correctness and regressions
2. Test quality and TDD evidence
3. Security, secrets, redaction, protected paths, fail-closed behavior
4. Product identity: AlphaFoundry is not described as a wrapper/rebrand/launcher
5. Pi substrate reuse: no duplicate native runtime/tool execution
6. No-finance boundary
7. Package/CLI/release risk
8. Documentation accuracy
9. Maintainability: small focused files, clear naming, no unnecessary abstraction

Severity labels:
- BLOCKER: must fix before merge/commit
- HIGH: serious correctness/security/release risk
- MEDIUM: should fix soon
- LOW: improvement
- NIT: style/minor

Each finding must include:
- severity
- file/path
- evidence
- recommended fix

If no findings, say PASS and list the checks performed. Do not edit files unless explicitly asked.
