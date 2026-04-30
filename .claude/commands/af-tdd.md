# AlphaFoundry TDD Task

Use this for any AlphaFoundry code change.

Input: `$ARGUMENTS` describes the desired behavior.

Process:
1. Restate acceptance criteria.
2. Identify minimal files likely needed.
3. Add/update tests first.
4. Run the targeted test and capture failure.
5. Implement the smallest change.
6. Run targeted test again.
7. Run `npm test`.
8. Run `npm run check` when final or user-facing/package behavior changes.
9. Run `git diff --check`.
10. Summarize changed files and verification.

Rules:
- No finance functionality.
- No native tool execution unless explicitly approved by the roadmap.
- Do not commit unless explicitly asked.
