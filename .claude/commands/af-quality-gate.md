# AlphaFoundry Quality Gate

ECC-inspired quality gate tailored to AlphaFoundry.

Use after implementation and before final answer/commit.

Run in order:
1. `git status --short --branch`
2. `npm test`
3. `npm run check`
4. `git diff --check`
5. Review `git diff --stat`
6. Run `/af-boundary-check` logic on the diff.

Quality dimensions:
- Tests pass.
- Package smoke passes via `npm run check`.
- No whitespace errors.
- No finance/trading/market/broker additions.
- No native AlphaFoundry tool executor duplication.
- No raw secrets or `.env` access.
- Product identity remains AlphaFoundry-first.
- Pi substrate boundary is preserved.

Output exactly:
- PASS/WARN/FAIL
- command results
- changed files
- boundary findings
- next action

Do not edit files unless explicitly asked.
