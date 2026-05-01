# AlphaFoundry CLI Agent Control Plane

AlphaFoundry is the terminal AI product. Runtime adapters such as Pi Agent may execute model calls, but AlphaFoundry owns the product control plane: run identity, durable events, sessions, redaction, export, permissions, and future replay/evals.

## Current milestone

This document defines the Phase 0/1 boundary agreed after the CLI-agent research and LLM council:

```text
AlphaFoundry CLI/TUI
  -> AlphaFoundry-owned run/session/event substrate
  -> runtime adapter (Pi today, native/OpenAI-compatible later)
```

The initial generic control-plane slice is implemented: `af run -p ...` creates AlphaFoundry session/run records, persists schema-versioned events, and `af sessions` can list, show, and export those records. The Pi adapter still handles model/tool execution, and the current one-shot path normalizes adapter output after the process returns. This is control-plane foundation work, not a production-grade autonomous agent stack.

The goal is not to add finance, MCP, subagents, or shell autonomy yet. The goal is to stop treating execution as an opaque passthrough and keep expanding AlphaFoundry-owned, schema-versioned runs before adding more agency.

## Product principles

1. **AlphaFoundry owns the user-facing run.** Every `af run` has an AlphaFoundry session ID, run ID, event log, and export path.
2. **Adapters are implementation details.** Pi Agent is currently the default adapter, but Pi event shapes must not become AlphaFoundry's permanent public API.
3. **Redaction happens before persistence/export.** Secret-looking values must not be written into durable transcripts.
4. **Machine-readable output is first-class.** `--json` and `--stream-json` are product APIs, not debug output.
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

Not every adapter can emit every event today. The Pi adapter currently normalizes one-shot output into `run_start`, `user`, `assistant`/`error`, and `run_end` events. Future native tools must use the richer event types. Event `sequence` is assigned at the persistence boundary so exported/session events are ordered even when adapter-normalized pre-persistence events do not yet have a sequence.

## CLI surface

Implemented Phase 1 commands:

```sh
af run -p "message" --json
af run -p "message" --stream-json
af sessions list [--json]
af sessions show <id> [--json]
af sessions export <id> [--json|--ndjson]
```

`af run` creates a durable session when no existing session is supplied internally. `--json` returns the run result, session manifest, run ID, and persisted events. `--stream-json` emits newline-delimited canonical events. In the current one-shot Pi adapter path these events are flushed after the adapter returns; future native tool/runner phases should make this a live incremental event stream.

Compatibility:

- Existing `af -p ...` passthrough remains available for now.
- New work should prefer `af run -p ...` so AlphaFoundry owns sessions/events.

## Adapter boundary

The default runtime adapter remains Pi unless explicitly overridden for tests or offline smoke checks.

```text
ALPHAFOUNDRY_RUNTIME_ADAPTER=mock
```

is reserved for deterministic local tests and examples. Normal user runs should use the default adapter path.

Implemented adapter-facing policy mapping compiles AlphaFoundry tool profiles to Pi flags when a prompt is delegated through Pi:

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

## Implemented generic tool-pack boundary

AlphaFoundry now has a neutral opt-in tool-pack boundary for future extension work. This is registry and enablement plumbing only; it does not execute tools, load MCP servers, or ship any domain packs.

Implemented primitives:

1. Empty default tool-pack registry
2. Kebab-case pack id validation
3. Domain-gated id rejection for finance/trading/broker/market/order/account-style packs
4. Explicit enablement resolution for registered generic packs
5. Fail-closed decisions for unknown or invalid packs
6. Redacted JSON-serializable pack metadata and decisions

Default AlphaFoundry behavior still enables no optional packs. Future packs must be registered explicitly, enabled explicitly, and wired through the existing permission/protected-path and verification gates before any runtime execution exists.

## No-finance-yet boundary

Finance remains out of scope until the generic control plane is safer and more complete. Do not add finance tools, trading workflows, market-data connectors, broker/exchange APIs, portfolio logic, alpha models, finance-specific MCP servers, finance config keys, or finance examples.

Future finance research may only appear as a gated, opt-in, read-only council/research direction after the generic plugin/tool-pack boundary, permissions, redaction, replay/evals, and default-excludes-finance behavior are tested. That future direction is not implemented in this milestone.

## Next gates before more agency

Before native writes/shell/MCP/domain work, still implement and test:

1. tool registry metadata and risk classifier integration beyond pack metadata
2. approval events and durable decisions
3. workspace boundary checks wired into actual tool calls
4. transcript redaction fixtures
5. prompt-injection/malicious repo fixtures
6. replay/eval harness

## Non-goals for this milestone

- no finance tools
- no MCP server execution
- no native shell runner
- no native file write/patch tools
- no YOLO/bypass mode
- no automatic background subagent orchestration
