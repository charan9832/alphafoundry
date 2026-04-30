# Before Commit Checklist

- User explicitly asked to commit.
- `npm test` passed.
- `npm run check` passed.
- `git diff --check` passed.
- Diff reviewed.
- No unrelated files.
- No secrets or raw env values.
- No finance/domain additions.
- No native tool execution duplication.
- Package smoke passed if package/CLI behavior changed.
- Conventional commit message chosen.
