# AlphaFoundry Agent Core

AlphaFoundry is being built as a normal AI-agent runtime first. Finance features are tool packs layered on top of this core.

## Core responsibilities

The agent core owns:

1. Chat shell
   - CLI entrypoint
   - user messages
   - assistant responses
   - session logs

2. Model/provider boundary
   - product-owned message types
   - provider-neutral model request/response shapes
   - Pi SDK or other providers as adapters only

3. Planning
   - convert the user request into a small structured plan
   - record planned steps before tool execution
   - avoid hardcoding domain workflows into the core

4. Tool registry
   - registered tools only
   - typed schemas
   - structured observations
   - safe error handling

5. Guardrails
   - generic tool input guardrails
   - secret rejection/redaction
   - domain-specific policies added by plugin/tool packs

6. Run state and checkpoints
   - every agent run gets a durable run id
   - phases: intake, planning, execution, verification, complete
   - checkpoint files are written in the workspace
   - runs can be inspected without relying on provider internals

7. Response rendering
   - human-readable final response
   - no raw JSON dumps by default
   - artifact paths and warnings are surfaced clearly

## Current implementation

Core files:

- `src/agent/messages.ts` — AlphaFoundry-owned internal message/model shapes.
- `src/agent/runState.ts` — durable run state and phase helpers.
- `src/agent/checkpoints.ts` — workspace checkpoint store.
- `src/agent/planner.ts` — deterministic plan-first fallback.
- `src/agent/orchestrator.ts` — plan, execute, checkpoint, complete.
- `src/agent/responseFormatter.ts` — readable response rendering.
- `src/tools/registry.ts` — registered tool execution and safe error handling.
- `src/tools/guardrails.ts` — generic input guardrails before tool execution.

Tests:

- `tests/agentMessages.test.ts`
- `tests/agentRuntimeFoundation.test.ts`

## Plugin direction

Finance should not be hardcoded into the agent core. Finance belongs in a plugin/tool pack that registers:

- finance data tools
- backtest tools
- validation tools
- paper journal tools
- finance-specific safety policy
- finance-specific report renderers

The core should be able to run without the finance pack installed.

## Design rule

If a feature mentions symbols, strategies, backtests, brokers, orders, portfolios, or journals, it is not core. It belongs in the finance tool pack.
