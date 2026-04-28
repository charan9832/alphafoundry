# Roadmap

## Phase 0: Correct product direction — done

- AlphaFoundry is an AI agent first.
- Finance strategies/backtests are not default core behavior.
- The command surface centers on `af`.
- Pi packages are MIT and can be used/adapted where useful.

## Phase 1: Working agent shell — current

Done:

- `af` / `alphafoundry` binary mapping exists.
- `af onboard` writes provider/model/base URL/API-key env/workspace config.
- `af doctor` checks config/workspace/LLM/runtime readiness.
- `af chat "..."` supports one-shot chat.
- `af tui` and bare `af` support the TUI path when running in an interactive terminal.
- Local smoke adapter exists for tests.
- Pi SDK adapter exists for real providers.

Remaining:

- Verify a real provider/model with tool calls using a working key/model combination.
- Make onboarding interactive, not only flag-driven.
- Improve search-tool setup inside `af onboard`.
- Add richer TUI status panes and model/tool indicators.

## Phase 2: Agent tools

Default tools should stay general:

- readiness
- web search
- file/workspace awareness
- project organization
- durable notes/memory
- safe shell/file tools only after permission design exists

Do not add finance strategy templates here.

## Phase 3: Finance tool pack later

Finance can be added only after the base agent works well.

Future finance should be explicit:

- opt-in tool pack/plugin
- no live trading by default
- no broker/order/account flows initially
- no predefined strategy promises
- tool-backed evidence and artifacts only

## Phase 4: Product polish

- Package smoke tests.
- Screenshots/demo GIFs.
- Install instructions.
- Provider onboarding docs.
- TUI usability pass.
