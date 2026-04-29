# AlphaFoundry CLI Agent Control Plane

AlphaFoundry is the terminal AI product. Runtime adapters such as Pi Agent may execute model calls, but AlphaFoundry owns the product control plane: run identity, durable events, sessions, redaction, export, permissions, and future replay/evals.

## Current milestone

This document defines the Phase 0/1 boundary agreed after the CLI-agent research and LLM council:

```text
AlphaFoundry CLI/TUI
  -> AlphaFoundry-owned run/session/event substrate
  -> runtime adapter (Pi today, native/OpenAI-compatible later)
```

The goal is not to add finance, MCP, subagents, or shell autonomy yet. The goal is to stop treating execution as an opaque passthrough and start recording AlphaFoundry-owned, schema-versioned runs.

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

Phase 1 commands:

```sh
af run -p "message" --json
af run -p "message" --stream-json
af sessions list [--json]
af sessions show <id> [--json]
af sessions export <id> [--json|--ndjson]
```

`--stream-json` emits newline-delimited canonical events. In the current one-shot Pi adapter path these events are flushed after the adapter returns; future native tool/runner phases should make this a live incremental event stream.

Compatibility:

- Existing `af -p ...` passthrough remains available for now.
- New work should prefer `af run -p ...` so AlphaFoundry owns sessions/events.

## Adapter boundary

The default runtime adapter remains Pi unless explicitly overridden for tests or offline smoke checks.

```text
ALPHAFOUNDRY_RUNTIME_ADAPTER=mock
```

is reserved for deterministic local tests and examples. Normal user runs should use the default adapter path.

## Next gates before more agency

Before native writes/shell/MCP/domain work, implement and test:

1. `PermissionPolicy`
2. protected path matching
3. risk classes for tools
4. approval events and durable decisions
5. workspace boundary checks
6. transcript redaction fixtures
7. prompt-injection/malicious repo fixtures
8. replay/eval harness

## Non-goals for this milestone

- no finance tools
- no MCP server execution
- no native shell runner
- no native file write/patch tools
- no YOLO/bypass mode
- no automatic background subagent orchestration
