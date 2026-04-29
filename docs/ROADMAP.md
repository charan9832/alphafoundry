# AlphaFoundry Roadmap

This roadmap reflects the council review and separates product identity, runtime depth, TUI quality, and release readiness.

## Phase 1: Runtime Adapter Foundation

Goal: replace shallow one-shot execution in interactive flows with a long-lived runtime adapter.

- Build a `src/pi-runtime` interface around Pi RPC or an equivalent streaming runtime mode.
- Support lifecycle methods: start, send prompt, abort, set model, read stats, and stop.
- Map runtime events into AlphaFoundry state: assistant deltas, tool calls, errors, usage, and session metadata.
- Preserve AlphaFoundry as the product surface while keeping Pi Agent as the adapter.

## Phase 2: Real Ink Commands and Sessions

Goal: make the Ink TUI command model real and session-aware.

- Implement slash commands in the Ink path: `/help`, `/clear`, `/model`, `/provider`, `/exit`.
- Add runtime-backed commands for `/stats`, `/tools`, `/session`, `/new`, and `/export`.
- Remove synthetic status where real runtime status is available.
- Add cancellation that aborts active work without merely exiting the UI.

## Phase 3: Product Identity and Onboarding

Goal: make AlphaFoundry installable, diagnosable, and understandable as its own product.

- Rewrite README and agent guidance around AlphaFoundry-native identity.
- Add native CLI commands: `af init`, `af doctor`, `af config`, `af models`, and `af session`.
- Define config at `~/.alphafoundry/config.json`, with `ALPHAFOUNDRY_CONFIG_PATH` override.
- Store provider/model/environment variable names only; never raw secrets.
- Move runtime adapter details into diagnostics and architecture notes.

## Phase 4: UX Hardening

Goal: improve terminal quality for daily use.

- Add scrollback viewport navigation.
- Add responsive narrow-terminal layouts.
- Add prompt history, focus cycling, and multiline input.
- Add keyboard help and accessibility/color-mode support.
- Add Unicode and Windows terminal fallbacks.
- Add secret redaction and safety indicators in visible tool output.

## Phase 5: Release Readiness

Goal: make AlphaFoundry releasable and supportable.

- Add CI across Ubuntu, macOS, Windows, Node 20, and current Node.
- Gate `npm ci`, `npm test`, `npm run check`, and package smoke tests.
- Keep `package-lock.json` consistent.
- Add package metadata: license, repository, bugs, homepage, and keywords.
- Add Windows install/update/troubleshooting documentation.
- Add process timeout, redaction, backend wrapper, and TTY regression tests.

## Current status

The product identity/config/doctor foundation is in place. The largest remaining product risk is runtime depth: streaming, sessions, cancellation, and real tool-call visibility should be prioritized before more visual polish.
