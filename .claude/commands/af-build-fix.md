# AlphaFoundry Build Fix

ECC-inspired build/test failure resolver tailored to AlphaFoundry.

Use when `npm test`, `npm run check`, CLI smoke, or Node tests fail.

Process:
1. Reproduce the failure with the smallest relevant command.
2. Capture the exact error and failing test/file.
3. Classify the failure:
   - test expectation wrong
   - implementation bug
   - package/CLI smoke regression
   - environment/config issue
   - boundary violation
4. Inspect only relevant files.
5. Fix the root cause with the smallest change.
6. Re-run the failing command.
7. Re-run `npm test` and `npm run check` when final.
8. Run `git diff --check`.

Rules:
- Do not weaken tests just to pass.
- Do not suppress errors without explaining and testing the correct behavior.
- Do not add finance/MCP/native-tool execution while fixing build errors.
- If the failure reveals a process gap, recommend `/evolve-system` or update AlphaFoundry `.claude` rules only if asked.
