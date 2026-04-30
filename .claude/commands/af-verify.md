# AlphaFoundry Verify

Run the standard AlphaFoundry verification gate. This is the normal final check after implementation.

Process:
1. `git status --short --branch`
2. `npm test`
3. `npm run check`
4. `git diff --check`
5. Inspect `git diff --stat` and relevant `git diff`.
6. Apply `/af-boundary-check` logic to the diff.
7. If package/CLI behavior changed, ensure `/af-package-smoke` requirements are covered by `npm run check` or run targeted smoke.

Report these dimensions:
- Tests: PASS/WARN/FAIL
- Package/CLI smoke: PASS/WARN/FAIL
- Whitespace/diff check: PASS/WARN/FAIL
- Security/secrets: PASS/WARN/FAIL
- No-finance boundary: PASS/WARN/FAIL
- Pi-substrate boundary: PASS/WARN/FAIL
- Product identity: PASS/WARN/FAIL

Final output:
- overall PASS/WARN/FAIL
- exact command results
- files changed
- boundary findings
- remaining blockers

Do not edit files unless explicitly asked.
