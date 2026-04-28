# Roadmap

## Phase 0: Clean product restart — done

- Fresh standalone repo.
- Pi dependencies and adapter facade.
- Repo-local workflow docs.
- Safety rules and tests.

## Phase 1: Product shell — done

- `alphafoundry` CLI.
- Onboarding with provider/model/base URL/API-key-env/workspace.
- Doctor/readiness checks.
- Chat entrypoint.
- Local provider for offline tests.

## Phase 2: Agent runtime and typed tools — mostly done

- Pi-backed provider adapter exists.
- Tool-call extraction exists for Pi assistant tool-call blocks.
- Runtime executes tool observations through the registry.
- Safety gates wrap user and assistant text.
- Local adapter routes project, memory, paper-journal, validation, optimization, and research requests through typed tools.

Remaining:

- Verify a real remote provider/model with tool calls using a working key/model combination.
- Add streaming UI events.

## Phase 3: Deterministic finance engine — expanded MVP done

- Python bridge exists.
- Deterministic local data provider exists.
- Moving-average trend backtest exists with fees/slippage.
- Validation checks exist.
- Report/backtest artifacts are saved.
- Validation suite exists with cost stress, sensitivity, and documented walk-forward guardrail.
- Bounded parameter optimization exists with overfit warnings and persisted artifacts.

Remaining:

- Replace deterministic local data with audited historical provider data.
- Upgrade validation from scaffold guardrails to provider-backed walk-forward/regime testing.

## Phase 4: Full research workflow — expanded MVP done

- Natural chat can trigger: idea -> local data -> backtest -> validation -> report artifact.
- Session logs and artifacts are saved.
- Safety disclaimer is included.
- Local research projects are persisted under the workspace.
- Local memory lessons are stored with secret rejection/redaction.
- Offline paper-journal entries are persisted without broker/order/account fields.

Remaining:

- Add approval gates for long/costly/destructive operations.
- Add multi-step strategy creation/editing.

## Phase 5: Product polish

- Packaging bin path and package allowlist are fixed and covered by tests.
- Installed-package smoke works for local onboarding/chat/validation.

Remaining:

- Rich TUI.
- Charts.
- Historical data provider/cache.
- Real remote provider tool-call verification.
- Optional MCP/export APIs.
