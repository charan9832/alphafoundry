# AlphaFoundry

AlphaFoundry is a native terminal workspace for agentic software work. It provides the `af` command, first-run configuration, health diagnostics, durable run/session records, and a React Ink TUI designed around context, tasks, diffs, and clear runtime status.

AlphaFoundry is its own product: a native terminal AI workspace with durable sessions, approvals, replay/evals, redaction, and runtime safety controls behind the `af` command surface.

## Requirements

- Node.js 20.6 or newer
- npm
- A terminal with TTY support for the interactive TUI
- Provider credentials exposed through environment variables, not stored in AlphaFoundry config

## Install and update

Local development:

```sh
npm install
npm link
af doctor
```

Global npm install, when published:

```sh
npm install -g alphafoundry
```

Update on macOS/Linux/Windows:

```sh
npm update -g alphafoundry
```

PowerShell equivalents:

```powershell
npm install -g alphafoundry
npm update -g alphafoundry
af doctor
```

Check which binary is active:

```sh
node --version
npm --version
af --version
af doctor
```

PowerShell:

```powershell
node --version
npm --version
Get-Command af
af doctor
```

## First run

Use the interactive onboarding wizard for normal setup:

```sh
af onboard
```

`af onboard` prompts for provider, model, and an API-key input. You can either type an environment variable name such as `OPENROUTER_API_KEY` or paste the actual API key. If you paste a key, AlphaFoundry asks whether to save it locally in:

```text
~/.alphafoundry/.env
```

That secret file is written with `0600` permissions and loaded automatically by `af doctor` and runtime prompts. `config.json` still stores only provider/model/env-var names, never the raw key. Onboard also asks whether to run `af doctor` immediately and whether to open the TUI. It writes config to:

```text
~/.alphafoundry/config.json
```

For non-interactive setup, create the default AlphaFoundry-native config file with:

```sh
af init --non-interactive
```

Override the path with:

```sh
ALPHAFOUNDRY_CONFIG_PATH=/path/to/config.json af onboard
ALPHAFOUNDRY_CONFIG_PATH=/path/to/config.json af init --non-interactive
```

PowerShell:

```powershell
$env:ALPHAFOUNDRY_CONFIG_PATH = "C:\Users\you\.alphafoundry\config.json"
af onboard
```

The config stores provider names, model names, and environment variable names only. It must not contain raw API keys, tokens, or passwords. If you choose to save a pasted key during onboarding, it goes into the separate local `.env` file instead.

Example:

```json
{
  "product": "AlphaFoundry",
  "version": 1,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "env": {
    "apiKey": "OPENAI_API_KEY",
    "baseUrl": "OPENAI_BASE_URL"
  }
}
```

## Commands

```sh
af                         # open the AlphaFoundry TUI
af tui                     # same
af init --non-interactive  # create AlphaFoundry config
af onboard                # interactive setup wizard
af doctor                  # human-readable health report
af doctor --json           # machine-readable health report
af config path             # print active config path
af config get provider     # read config value
af config set provider openai
af config set model gpt-4o-mini
af config set env.apiKey OPENAI_API_KEY
af config set env.baseUrl OPENAI_BASE_URL
af models                  # explain runtime-adapter model listing
af tool-packs              # show optional pack boundary; no packs enabled by default
af tool-packs --json       # machine-readable pack registry/enablement status
af session                 # explain session support
af sessions list [--json]
af sessions show <id> [--json]
af sessions export <id> [--json|--ndjson]
af sessions replay <id> [--json]
af sessions eval <id> [--json]
af approvals list [--json]
af approvals show <id> [--json]
af approvals export [--json|--ndjson]
af approvals expire <id> [--json]
Provider credentials can come from either your shell environment or the local AlphaFoundry env file created by `af onboard` when you paste and save a key:

```text
~/.alphafoundry/.env
```

Shell example:

```sh
export OPENAI_API_KEY="***"
af config set env.apiKey OPENAI_API_KEY
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="***"
af config set env.apiKey OPENAI_API_KEY
```

## TUI demo

Open AlphaFoundry with `af` after onboarding. The TUI presents a compact workspace run surface with the current model, session, and tool-policy state visible. A text capture is available at [`docs/media/tui-demo.txt`](docs/media/tui-demo.txt):

```text
ALPHAFOUNDRY
terminal workspace for agentic software work
Plan changes, gate tools, track evidence, and keep durable sessions.

╭─ Start a workspace run / run input ──────────────────────────────────╮
│ af › "Audit this repo and propose the safest next change"            │
│ Mode ask · Model openrouter/qwen3-coder · Session ses_...             │
│ Session records · Pre-run tool approval · Diff display · Evidence when emitted
╰───────────────────────────────────────────────────────────────────────╯
```

When runtime events are available, the workspace groups them into the product-owned records AlphaFoundry tracks: prompt, assistant text, tool policy, evidence, and diffs.

```text
AlphaFoundry  openrouter/qwen3-coder      ● tool approval pending  approve allowlist: /approve-tools

YOU       Audit this repo and propose the safest next change
ALPHA     Plan: inspect tests, isolate the smallest safe patch, verify before reporting.
TOOL      read, grep requested for the next run
ARTIFACT  runtime evidence: artifacts/run-summary.json
DIFF      src/tui/components/Workspace.jsx +18 -6

╭─ RUN af › Describe the change, investigation, or review... ──────────╮
│ policy mode ask · tools off · Enter submit · Esc cancel · /help
╰───────────────────────────────────────────────────────────────────────╯
```

The inspector keeps the important context visible without pretending work happened:

- Run context: current prompt and action
- Run: state, provider/model, durable session
- Tool policy: permission mode, pre-run tool approval, recovery hint
- Evidence: runtime artifacts or verification records when emitted
- Project: branch, dirty/clean tree, cwd
- Tools and usage: enabled tools, observed tokens/cost

This TUI is designed to surface these records without claiming a live approval pause/resume loop. Current tool governance is a pre-run allowlist flow: `/tools <list>` requests runtime tools and `/approve-tools` approves the allowlist for the next run.

## TUI slash commands

```text
/help                 show TUI command help
/model <provider/model> set local model preference for the next runtime prompt
/provider <name>      set local provider preference for the next runtime prompt
/stats                show local TUI counters; runtime stats appear after runs
/tools <list>         request runtime tools; write/shell tools require approval
/approve-tools        approve pending tool request for this session
/mode <mode>          set tool permission mode: plan, ask, act, auto
/session              show durable session metadata
/new                  start a fresh durable session
/export               print the visible transcript in the conversation
/clear                clear visible conversation
/exit                 quit when idle; cancel first when running
```

## Doctor checks

`af doctor` reports:

- AlphaFoundry package version
- Node.js version and engine compatibility
- Runtime engine package installation
- Git branch/dirty state when available
- Config file path and existence
- Local AlphaFoundry env-file permission status when `~/.alphafoundry/.env` or the config-adjacent `.env` exists
- TTY capability for interactive terminal use
- Provider-specific environment-variable guidance for `openai`, `anthropic`, `gemini`, and `openrouter` without exposing secret values

Use JSON output for scripts:

```sh
af doctor --json
```

## Runtime control plane

AlphaFoundry owns the user-facing product surface: `af`, config, doctor, docs, roadmap, TUI workflow, durable session records, approval-decision records, and local replay/eval summaries. Session records live under `~/.alphafoundry/sessions/` and can be listed, shown, exported, replayed, and evaluated through `af sessions`.

Tool governance is generic foundation work. AlphaFoundry has deterministic permission/protected-path decisions, verification evidence summaries, runtime tool profile mapping, persisted approval decisions, local replay/eval checks, and a safe in-process tool-pack executor skeleton. In the TUI, `/tools <list>` requests runtime tools and `/approve-tools` approves pending write/shell-capable requests for the current session before retrying. It does not yet implement a full live tool-call pause/resume prompt, MCP/server loading, external tool marketplaces, finance, or domain tool execution.

## Runtime execution

Runtime child processes can be bounded with `ALPHAFOUNDRY_RUN_TIMEOUT_MS` to prevent hung runs; timed-out runs return status `124` and persist terminal error/run-end events where streaming events are available. Future runtime work will deepen live streaming, backend session integration, cancellation, tool visibility, and provider/model discovery while preserving AlphaFoundry as the product identity.

## Release, roadmap, and project support

- See `docs/ROADMAP.md` for the council-derived implementation phases.
- See `docs/RELEASE.md` for the release checklist, verification gates, and npm publish runbook.
- See `docs/RELEASE_CANDIDATE_EVIDENCE.md` for the latest PTY TUI smoke, real runtime dogfood, local gate, and GitHub CI evidence.
- See `docs/BENEFITS_APPLICATION_KIT.md` for reusable open-source, student, startup, and cloud-credit application language.
- See `CHANGELOG.md` for notable changes and known limitations.
