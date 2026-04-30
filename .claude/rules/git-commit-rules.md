# Git and Commit Rules

Before editing:
- Check `git status --short --branch`.
- Be aware this repo may be ahead of origin; do not overwrite or reset local work.

Before committing:
- Commit only if the user explicitly asked in this task.
- Run `npm test`.
- Run `npm run check`.
- Run `git diff --check`.
- Inspect `git diff`.
- Ensure no secrets, `.env`, node_modules, package tarballs, or unrelated files are included.

Commit messages should be conventional:
- `feat: ...`
- `fix: ...`
- `test: ...`
- `docs: ...`
- `chore: ...`

Never amend, rebase, reset, force push, or rewrite history unless explicitly asked.
