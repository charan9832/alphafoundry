# TDD and Verification Rules

For code behavior changes:
1. Write or update tests first.
2. Run the targeted test and confirm RED failure when feasible.
3. Implement the smallest change.
4. Run targeted test again.
5. Run `npm test`.
6. Run `npm run check`.
7. Run `git diff --check`.
8. Inspect diff before final answer.

Never claim verification unless the command actually ran and passed.
If a command cannot run, report the exact blocker and what remains unverified.

Prefer deterministic tests:
- no network dependency
- no real provider calls
- no hidden local state
- temporary directories for config/workspaces
- explicit env overrides

For Pi policy mapping, prefer pure tests around generated flags and fail-closed validation.
