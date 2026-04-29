# Changelog

All notable AlphaFoundry changes are recorded here.

## Unreleased

### Added

- Documented the manual release runbook, required local gates, CI matrix expectations, npm publish dry-run, tagging, rollback guidance, and Pi package integration boundary.

### Hardened

- Replaced remaining primary TUI status/footer labels with AlphaFoundry runtime-adapter wording while keeping Pi mentions limited to adapter internals and diagnostics.

### Verification

- Added cross-platform test runner script so CI does not rely on shell glob expansion.
- Hardened path-sensitive config tests for Windows runners.
- Pending final release verification for the next published version.

## 0.3.0

### Added

- AlphaFoundry-native CLI command surface for init, doctor, config, models, session, one-shot prompt execution, and TUI launch.
- Product-owned config at `~/.alphafoundry/config.json` with `ALPHAFOUNDRY_CONFIG_PATH` override.
- Runtime config resolution for provider/model and environment variable names without persisting raw secrets.
- Installed package smoke script for packed tarball verification.
- Cross-platform CI gates for tests, audit, package dry-run, and installed smoke.
- React Ink TUI workflow with local slash commands, runtime lifecycle state, cancellation handling, transcript export, and redaction.

### Hardened

- Dependency resolution for installed packages with hoisted dependencies.
- Doctor checks for package, Node engine, runtime adapter, git state, config validation, and TTY support.
- Config validation and redaction across CLI, doctor, and transcript surfaces.
- Runtime lifecycle behavior for overlapping runs, abort signals, start failures, retained output caps, and listener cleanup.
- Command honesty for backend-delegated model/session behavior and local-only slash command fallbacks.

### Known limitations

- Runtime execution currently delegates through the Pi Agent adapter.
- Some runtime capabilities remain adapter-dependent, including provider/model discovery, tool enforcement, and backend session semantics.
- Curated Pi package integrations for subagents, web access, guardrails, LSP, context, and extension management are deferred until the core release path is reproducible.
