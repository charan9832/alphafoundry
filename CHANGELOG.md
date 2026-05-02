# Changelog

All notable AlphaFoundry changes are recorded here.

## 0.4.0

### Added

- Documented the manual release runbook, required local gates, CI matrix expectations, npm publish dry-run, tagging, rollback guidance, and Pi package integration boundary.
- Added the CLI agent control-plane architecture note covering AlphaFoundry-owned sessions, canonical runtime events, adapter boundaries, and safety gates before native tools/MCP/domain work.
- Added durable AlphaFoundry session storage with schema-versioned event logs and `af sessions list|show|export` over the current runtime adapter.
- Added an empty opt-in tool-pack boundary with generic pack id validation, fail-closed enablement, domain-gated pack id rejection, redacted JSON-serializable decisions, and native `af tool-packs [--json]` status reporting.
- Added a release static-audit gate that checks required release files, secret-like tokens outside test fixtures, external Claude-upgrade/runtime references in AlphaFoundry files, and obvious finance/trading implementation symbols.
- Added an AlphaFoundry benefits application kit for reusable open-source, student, startup, and cloud-credit application language.
- Added CLI coverage for version output, missing prompt usage errors, missing session errors, and JSON session export consistency.
- Added a doctor `env` check that reports whether configured environment variable names resolve in the current shell without exposing values.
- Added a live-streaming Pi JSONL adapter (`src/runtime/adapters/pi-stream.js`) that spawns Pi with `--mode json`, parses structured events in real time, and maps them to AlphaFoundry canonical events.
- Wired the streaming adapter into the runner so runtime events can be emitted live instead of batching after completion.
- Added a test suite for the streaming adapter covering sequential, pause/resume, error recovery, mid-line resumption, CR handling, and stream end.
- Added `af sessions replay <id>` and `af sessions eval <id>` to expose deterministic local replay summaries and PASS/WARN/FAIL session checks.
- Added `af approvals list|show|export|expire` to expose the persisted approval-decision foundation with human-readable and JSON/NDJSON output.
- Added internal tool policy mapping so AlphaFoundry can retain product-owned sessions and policy checks around runtime tool profiles.
- Added `af onboard` as the first-run setup wizard; it stores env var names only, can run `af doctor` after writing config, and can open the TUI.
- Added provider-aware doctor guidance for OpenAI, Anthropic, Gemini, and OpenRouter API-key/base-url environment variables without printing secret values.

### Hardened

- Replaced remaining primary TUI status/footer labels with AlphaFoundry runtime-adapter wording while keeping Pi mentions limited to adapter internals and diagnostics.
- Added a pure deterministic runtime permission/protected-path layer for future tool calls, covering plan/ask/act/auto modes, risk classes, protected workspace paths, AlphaFoundry state, credential files, and redacted JSON-serializable decisions.
- Kept optional/domain packs disabled by default; future executable packs must still pass permission, protected-path, approval, redaction, and verification gates.
- Derived CLI `--version`/`-v` output from `package.json` to prevent release version drift.
- Cleared the cached TUI runtime-runner promise after startup rejection so a later prompt can retry runtime creation.
- Updated `@mariozechner/pi-coding-agent` to `^0.72.0`, resolving the moderate transitive audit findings while keeping runtime adapter tests green.
- Runtime streaming now uses real-time event streaming through the runner rather than post-hoc event replay.
- Mock adapter in tests now also respects `onEvent` callbacks so streaming smoke tests work end-to-end.
- CLI session and approval commands now provide clearer empty states, redacted exports, and recovery guidance for missing identifiers.

### Verification

- Added cross-platform test runner script so CI does not rely on shell glob expansion.
- Wired release static audit and Claude setup validation into the default test runner.
- Hardened path-sensitive config tests and installed-package smoke command spawning for Windows runners.
- Verified the release candidate with `npm audit --omit=dev --audit-level=moderate`, `npm test`, `npm run check`, `node scripts/release-static-audit.mjs`, and `git diff --check`.

### Known limitations

- Runtime execution still delegates through the Pi Agent adapter.
- Live incremental streaming is now implemented for the Pi JSONL path; legacy batch mode remains for non-streaming runtime paths.
- Approval persistence, local replay/evals, `/tools` plus `/approve-tools` request/approval flow, and the safe tool-pack executor skeleton are implemented foundations; full interactive approval prompts that pause/resume live tool calls, native file/shell/MCP execution, external tool-pack marketplaces, and production-grade autonomous workflows remain gated future work.
- Finance remains intentionally out of scope: no finance tools, trading workflows, market-data connectors, broker/exchange APIs, portfolio logic, alpha models, finance-specific MCP servers, finance config keys, or finance examples are included.

## 0.3.0

### Added

- AlphaFoundry-native CLI command surface for init, doctor, config, models, sessions, approvals, and TUI launch.
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
