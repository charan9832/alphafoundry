# AlphaFoundry Package Smoke

ECC-inspired package/CLI smoke workflow tailored to AlphaFoundry.

Use for changes touching CLI commands, package metadata, config, onboarding, doctor, sessions, or install behavior.

Run:
1. `node src/cli.js --help`
2. `node src/cli.js --version`
3. `npm run pack:dry-run`
4. `npm run smoke:installed`
5. `npm run check` if not already run

Inspect:
- packed files are intentional
- CLI binaries `af` and `alphafoundry` still work in installed smoke
- no `.env`, secrets, local sessions, tarballs, node_modules, or test junk are packaged
- README/CHANGELOG/docs reflect changed behavior if user-facing

Output:
- PASS/WARN/FAIL
- exact command results
- package/file-list concerns
- docs follow-up if needed
