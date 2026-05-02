# AlphaFoundry CLI Agent Control Plane

AlphaFoundry is the terminal AI product. Runtime adapters such as Pi Agent may execute model calls, but AlphaFoundry owns the product control plane: run identity, durable events, sessions, redaction, export, permissions, approval decisions, replay/evals, and tool-pack boundaries.

## Current milestone

This document defines the Phase 0/1 boundary agreed after the CLI-agent research and LLM council:

```text
AlphaFoundry CLI/TUI
  -> AlphaFoundry-owned run/session/event substrate
  -> runtime adapter (Pi today, native/OpenAI-compatible later)
```

The generic control-plane slice is implemented around AlphaFoundry-owned session/run records, schema-versioned events, and `af sessions` list/show/export/replay/eval commands. Public one-shot prompt CLI entrypoints are intentionally not part of the app command surface. This is control-plane foundation work, not a production-grade autonomous agent stack.

The goal is not to add finance, MCP, subagents, or shell autonomy yet. The goal is to stop treating execution as an opaque passthrough and keep expanding AlphaFoundry-owned, schema-versioned runs before adding more agency.

## Product principles

1. **AlphaFoundry owns runtime records.** Runtime activity has an AlphaFoundry session ID, run ID, event log, and export path.
2. **Adapters are implementation details.** Pi Agent is currently the default adapter, but Pi event shapes must not become AlphaFoundry's permanent public API.
3. **Redaction happens before persistence/export.** Secret-looking values must not be written into durable transcripts.
4. **Machine-readable exports are first-class.** Session JSON/NDJSON exports are product APIs, not debug output.
5. **Safety comes before agency.** Native file writes, shell, MCP, and finance/domain tools require permissions, protected paths, replay/evals, and redaction gates first.

## Session storage

Default location:

```text
~/.alphafoundry/sessions/<session-id>/
  manifest.json
  events.ndjson
  artifacts/
```

Environment overrides:

```text
ALPHAFOUNDRY_HOME          # root for AlphaFoundry state
ALPHAFOUNDRY_DATA_DIR      # future non-session data root
ALPHAFOUNDRY_SESSIONS_DIR  # explicit sessions root
```

Do not store durable run/session state in `~/.alphafoundry/config.json`; that config remains a narrow provider/model/env-var-name file.

## Canonical event schema

All persisted runtime events are JSON objects with:

```json
{
  "schemaVersion": 1,
  "eventId": "evt_...",
  "sequence": 1,
  "type": "run_start",
  "timestamp": "2026-04-29T00:00:00.000Z",
  "sessionId": "ses_...",
  "runId": "run_...",
  "payload": {}
}
```

Initial event types:

```text
run_start
user
assistant_delta
assistant
stdout
stderr
tool_call
tool_result
permission_request
permission_decision
diff
artifact
stats
final
error
run_end
```

Not every adapter can emit every event today. Runtime adapters normalize activity into `run_start`, `user`, `assistant`/`error`, and `run_end` events. Future native tools must use the richer event types. Event `sequence` is assigned at the persistence boundary so exported/session events are ordered even when adapter-normalized pre-persistence events do not yet have a sequence.

## CLI surface

Implemented Phase 1 commands:

```sh
af onboard [--force]
af doctor [--json]
af sessions list [--json]
af sessions show <id> [--json]
af sessions export <id> [--json|--ndjson]
af sessions replay <id> [--json]
af sessions eval <id> [--json]
af approvals list [--json]
af approvals show <id> [--json]
af approvals export [--json|--ndjson]
af approvals expire <id> [--json]
```


`af onboard` is the normal first-run path. It writes provider/model/environment-variable-name config only, can run provider-aware `af doctor` immediately, and can open the TUI after setup. For convenience, the API-key prompt accepts either an environment variable name or a pasted API key. Pasted keys are stored only in the separate local env file (`~/.alphafoundry/.env` by default, mode `0600`); `config.json` stays secret-free. Runtime config, `af doctor`, and the spawned TUI process load that local env file first, then let the shell environment override it. `af doctor` reports package, Node, adapter, git, config, local env-file permission status, TTY, and provider-aware environment-variable readiness for OpenAI, Anthropic, Gemini, and OpenRouter without printing secret values.

`af sessions replay` and `af sessions eval` provide local deterministic summaries and PASS/WARN/FAIL checks over persisted session events. `af approvals` exposes the persisted approval-decision foundation; `/tools <list>` and `/approve-tools` are available in the TUI for request/approval of current-session runtime tool policy, but full interactive approval prompts are still a future TUI/runtime loop.

Command surface:

- `af` opens the app/TUI.
- Public one-shot prompt CLI commands such as `af run` and `af -p ...` are intentionally excluded from the app command surface.

## Adapter boundary

The default runtime adapter remains Pi unless explicitly overridden for tests or offline smoke checks.

```text
ALPHAFOUNDRY_RUNTIME_ADAPTER=mock
```

is reserved for deterministic local tests and examples. Normal user runs should use the default adapter path.

Implemented adapter-facing policy mapping compiles AlphaFoundry tool profiles to Pi flags internally when runtime activity is delegated through Pi, while keeping AlphaFoundry-owned sessions, events, redaction, and policy checks:

```text
default        -> no tool flag
none           -> --no-tools
read-only      -> --tools read,grep,find,ls
code-edit      -> --tools read,grep,find,ls,edit,write
shell          -> --tools read,grep,find,ls,bash
extension-only -> --no-builtin-tools
explicit list  -> --tools <comma-list> after built-in validation
```

Unknown profiles, unknown tools, unsupported permission modes, protected paths, and denied risk classes fail closed before Pi flags are emitted.

## Implemented safety-control slice

AlphaFoundry now has pure deterministic permission/protected-path and runtime tool-policy layers. They do not execute tools; they classify whether a future tool invocation should be allowed, denied, or require approval, and map permitted Pi built-ins to runtime adapter flags.

Implemented primitives:

1. Permission modes: `plan`, `ask`, `act`, `auto`
2. Risk classes: `read`, `write`, `shell`, `network`, `mcp`, `credential`, `destructive`
3. Protected path matching for:
   - `.git/**`
   - `.env*`
   - SSH keys/config
   - cloud credentials
   - npm/yarn/pnpm token files
   - AlphaFoundry config/session state
   - paths outside the active workspace
4. Deterministic decision shape:
   - `allow`
   - `deny`
   - `ask`
   - `reason`
   - `risk`
   - `protectedPath`
   - `requiresApproval`

These decisions are pure JSON-serializable data and are redacted before return.

## Implemented verification evidence slice

AlphaFoundry now has generic verification evidence primitives for future run summaries:

1. Schema-versioned evidence objects
2. Verifier results with `PASS`, `WARN`, and `FAIL` statuses
3. Aggregated verification summaries
4. A redacted `verification-summary.json` artifact shape
5. Session artifact persistence with path traversal rejection

This is generic evidence plumbing only. It is not a finance council, trading verifier, or production eval harness.

## Implemented approval, replay, and eval slices

AlphaFoundry now exposes the non-interactive foundations needed before higher-agency runtime work:

1. Persisted approval decisions under AlphaFoundry data state, exposed through `af approvals list|show|export|expire`
2. Deterministic session replay summaries through `af sessions replay <id>`
3. Local PASS/WARN/FAIL session evaluations through `af sessions eval <id>`
4. Redacted JSON/NDJSON output for scripting and diagnostics

These are foundations only. The TUI does not yet pause a live tool call for an interactive approve/deny prompt, and approval decisions are not yet wired into native file/shell/MCP execution.

## Implemented generic tool-pack boundary

AlphaFoundry now has a neutral opt-in tool-pack boundary for future extension work. The default registry is empty, and the safe executor skeleton only supports explicitly provided in-process generic handlers; it does not dynamically import packages, shell out, load MCP servers, or ship any domain packs.

Implemented primitives:

1. Empty default tool-pack registry
2. Kebab-case pack id validation
3. Domain-gated id rejection for finance/trading/broker/market/order/account-style packs
4. Explicit enablement resolution for registered generic packs
5. Fail-closed decisions for unknown or invalid packs
6. Redacted JSON-serializable pack metadata and decisions
7. Native `af tool-packs` and `af tool-packs --json` status reporting for the current registry and enablement boundary
8. Safe in-process generic handler execution skeleton that fails closed unless the pack is registered, explicitly enabled, policy-allowed, and the action exists

Default AlphaFoundry behavior still enables no optional packs. Future packs must be registered explicitly, enabled explicitly, and wired through the existing permission/protected-path and verification gates before any runtime execution exists. The `af tool-packs` command reports this state honestly instead of implying executable packs are available.

## No-finance-yet boundary

Finance remains out of scope until the generic control plane is safer and more complete. Do not add finance tools, trading workflows, market-data connectors, broker/exchange APIs, portfolio logic, alpha models, finance-specific MCP servers, finance config keys, or finance examples.

Future finance research may only appear as a gated, opt-in, read-only council/research direction after the generic plugin/tool-pack boundary, permissions, redaction, replay/evals, and default-excludes-finance behavior are tested. That future direction is not implemented in this milestone.

## Next gates before more agency

Before native writes/shell/MCP/domain work, still implement and test:

1. live TUI approval prompts that pause/resume actual tool calls
2. workspace boundary checks wired into actual native tool calls
3. transcript redaction fixtures for adversarial output
4. prompt-injection/malicious repo fixtures
5. first safe built-in generic tool pack and enablement UX
6. CI/release confirmation across supported platforms

## Non-goals for this milestone

- no finance tools
- no MCP server execution
- no native shell runner
- no native file write/patch tools
- no YOLO/bypass mode
- no automatic background subagent orchestration
