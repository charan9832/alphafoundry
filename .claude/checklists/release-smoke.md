# Release Smoke Checklist

Use before publishing, packaging, or committing CLI/package behavior changes.

Commands:
- `node src/cli.js --help`
- `node src/cli.js --version`
- `npm run pack:dry-run`
- `npm run smoke:installed`
- `npm run check`

Inspect:
- packed file list is intentional
- installed smoke exercises both `af` and `alphafoundry` binaries if applicable
- no local state/sessions/secrets/tarballs/node_modules included
- README/CHANGELOG/docs updated for user-facing changes
- product identity is AlphaFoundry-first
- no finance boundary violation
