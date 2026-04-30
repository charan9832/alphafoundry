# Quality Gate Rule

Every non-trivial AlphaFoundry change must satisfy a quality gate before being called done.

Minimum gate:
- `npm test`
- `npm run check`
- `git diff --check`
- diff review
- boundary check

Package/CLI-facing changes must satisfy package smoke:
- `node src/cli.js --help`
- `node src/cli.js --version`
- `npm run pack:dry-run`
- `npm run smoke:installed`

Never mark work complete because code was written. Completion requires evidence.
