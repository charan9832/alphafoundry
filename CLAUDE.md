# AlphaFoundry Claude Code Project Rules

AlphaFoundry is a standalone terminal AI product. Treat `af`, docs, configuration, doctor checks, session/control-plane behavior, and the Ink TUI as AlphaFoundry-owned product surfaces.

## Load first

Before non-trivial work, read:
- `AGENTS.md`
- `package.json`
- relevant docs under `docs/`
- relevant tests under `test/`
- recent git history with `git log --oneline -n 10`

## Product identity

- Product name: AlphaFoundry
- Package name: `alphafoundry`
- CLI commands: `af` and `alphafoundry`
- Default config: `~/.alphafoundry/config.json`
- Config override: `ALPHAFOUNDRY_CONFIG_PATH`

Do not describe AlphaFoundry as a rebrand, thin wrapper, or launcher. Runtime adapter details are not product identity and should stay out of user-facing product copy unless a task explicitly concerns internal runtime diagnostics.

## Current architecture direction

AlphaFoundry owns:
- product UX and CLI command surface
- config schema and doctor/diagnostics
- policy/governance/audit/redaction
- session/control-plane UX
- docs/onboarding/release story

Runtime adapter layer owns/reuses:
- model runtime
- built-in tool execution substrate
- backend sessions where applicable
- skills/prompts/themes/extensions where useful

Do not rebuild runtime-adapter internals inside AlphaFoundry unless a concrete verified requirement cannot be satisfied through the existing runtime boundary.

## Current implementation priority

The next suitable implementation slice is generic CLI-agent foundation work such as the runtime tool-policy mapper.

Do not add finance functionality yet.
Do not add MCP execution yet.
Do not add native AlphaFoundry file/shell/tool execution yet.
Do not add YOLO/bypass mode.

## Required workflow

Use TDD:
1. Inspect current code/tests.
2. Add or update tests first.
3. Run the relevant test and confirm the expected failure.
4. Implement the smallest change.
5. Run the relevant test again.
6. Run `npm test`.
7. Run `npm run check` for final gate.
8. Run `git diff --check`.
9. Review `git diff` before reporting done.

## Verification gates

For most code changes:
```bash
npm test
npm run check
git diff --check
```

For package/CLI/release-facing changes, ensure package smoke is covered. `npm run check` should include smoke checks, but use targeted commands if needed:
```bash
npm run pack:dry-run
npm run smoke:installed
```

## Commit rule

Do not commit unless explicitly instructed in the current task. If asked to commit, commit only after all relevant gates pass and the diff is focused.

## Safety boundaries

Never store raw secrets in config or docs.
Never read or print `.env`, SSH keys, tokens, browser profiles, or credential stores unless explicitly asked.
Fail closed for unknown tools/capabilities.
Keep changes small and reviewable.
