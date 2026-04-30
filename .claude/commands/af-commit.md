# AlphaFoundry Commit

Only use this if the user explicitly asked to commit.

Process:
1. Check `git status --short --branch`.
2. Run `npm test`.
3. Run `npm run check`.
4. Run `git diff --check`.
5. Inspect `git diff` for unrelated changes, secrets, finance boundary violations, and native runtime/tool duplication.
6. Stage only intended files.
7. Commit with a concise conventional commit message.
8. Report commit hash.

Refuse to commit if any required gate fails or if commit was not explicitly requested.
