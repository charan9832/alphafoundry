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

Remaining:

- Verify a real remote provider/model with tool calls using a working key/model combination.
- Add streaming UI events.

## Phase 3: Deterministic finance engine — initial version done

- Python bridge exists.
- Deterministic local data provider exists.
- Moving-average trend backtest exists with fees/slippage.
- Validation checks exist.
- Report/backtest artifacts are saved.

Remaining:

- Replace deterministic local data with audited historical provider data.
- Add richer validation: walk-forward, sensitivity, regime, cost stress.

## Phase 4: Full research workflow — initial version done

- Natural chat can trigger: idea -> local data -> backtest -> validation -> report artifact.
- Session logs and artifacts are saved.
- Safety disclaimer is included.

Remaining:

- Add memory/lesson storage.
- Add approval gates for long/costly/destructive operations.
- Add multi-step strategy creation/editing.

## Phase 5: Product polish

- Rich TUI.
- Charts.
- Workspaces/projects.
- Packaging and installer.
- Optional MCP/export APIs.
