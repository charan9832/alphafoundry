# AlphaFoundry Release Runbook

This runbook defines the minimum release process for AlphaFoundry. It is intentionally manual-first so the project can make reproducible releases before adding publish automation.

## Release principles

- Release AlphaFoundry as the product users install and operate.
- Keep Pi Agent references limited to runtime adapter internals, diagnostics, and troubleshooting.
- Do not publish or tag from a dirty working tree.
- Do not store or commit raw secrets in config, docs, fixtures, logs, or release artifacts.
- Do not claim production-ready unless every local gate and the GitHub CI matrix are green and no known FAIL-level blocker remains.
- Do not add finance, trading, broker, order, account, or public AutoResearch features as part of release hardening.

## Required local gates

Run these from the repository root before tagging or publishing:

```sh
git status --short
npm ci
npm test
npm run check
npm audit --omit=dev --audit-level=moderate
npm pack --dry-run --json
node scripts/smoke-installed.mjs
git diff --check
```

Notes:

- `npm run check` already runs tests, CLI help/version checks, package dry-run, and the installed package smoke test.
- Keep the explicit audit, dry-run, smoke, and whitespace checks in the release checklist so failures are visible in release notes.
- Review the `npm pack --dry-run --json` file list before publishing. The tarball should contain product source, docs, scripts, README, AGENTS guidance, and LICENSE only; it must not contain local configs, logs, secrets, or `.hermes` plans.

## GitHub CI gate

Before publishing, confirm the GitHub Actions CI matrix is green for the release commit:

- Ubuntu, macOS, and Windows
- Node 20.x and current Node
- `npm ci`
- `npm test`
- `npm audit --omit=dev --audit-level=moderate`
- CLI help/version checks
- package dry-run
- installed package smoke

If CI disagrees with local results, fix or document the platform-specific blocker before release.

## Version and changelog

1. Decide the semantic version bump.
2. Update `package.json` and `package-lock.json` together.
3. Update `CHANGELOG.md` with:
   - release date,
   - user-facing changes,
   - verification gates run,
   - known limitations.
4. Commit the version and changelog update separately from unrelated implementation changes.

## Publish checklist

After all required gates pass:

```sh
npm whoami
npm publish --dry-run
```

Review the dry-run output. When ready to publish:

```sh
npm publish --access public
```

Recommended npm account controls:

- Use npm 2FA for publish operations.
- Prefer provenance when the project has a trusted publish workflow ready.
- Publish from the verified release commit only.

## Tag and GitHub release

After a successful npm publish:

```sh
git tag vX.Y.Z
git push origin main --tags
```

Create a GitHub release for the tag using the corresponding `CHANGELOG.md` entry. Include the gate results and any known limitations.

## Rollback and failed publish handling

- If local gates fail before publishing, do not tag or publish. Fix forward or revert the failing commit.
- If `npm publish --dry-run` shows unexpected files, fix the package file list before publishing.
- If a package was published with a critical issue, prefer a fixed patch release. Use npm unpublish only when the npm policy permits it and the package is clearly unrecoverable.
- If CI fails after a tag, do not announce the release until the failure is resolved or the tag is superseded.

## Pi package integration boundary

Curated Pi packages for subagents, web access, guardrails, LSP, context, TUI status, and extension management are future integration candidates. Do not rebuild those capabilities in AlphaFoundry release hardening. Keep the release path focused on AlphaFoundry-owned install, config, doctor, redaction, runtime lifecycle, command honesty, and reproducible packaging.
