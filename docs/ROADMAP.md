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

The installed package path, config-controlled runtime execution, config validation/redaction, doctor diagnostics, RPC lifecycle hardening, TUI command honesty, durable `af run` session/event records, `af sessions` list/show/export, Pi tool-policy flag mapping, generic permission/protected-path decisions, generic verification evidence summaries, and an empty opt-in tool-pack boundary are in place.

This is still foundation work. Current one-shot Pi adapter events are normalized after the adapter returns; live incremental streaming, richer runtime tool events, approval persistence, replay/evals, registered executable tool packs, native AlphaFoundry tools, MCP execution, and production-grade autonomous workflows remain future work.

The next release-readiness focus is reproducible release discipline: follow `docs/RELEASE.md`, keep CI green across supported platforms, and update `CHANGELOG.md` before publishing. Curated Pi package integrations for subagents, web access, guardrails, LSP, context, and extension management are deferred until the AlphaFoundry release path is stable.

Finance remains intentionally gated. Do not add finance tools, trading workflows, market-data connectors, broker/exchange APIs, portfolio logic, alpha models, finance-specific MCP servers, finance config keys, or finance examples. Future finance work, if approved later, should start as gated read-only research/council/tool-pack exploration after the generic plugin boundary, permissions, redaction, replay/evals, and default-excludes-finance behavior are tested.
