# AlphaFoundry

AlphaFoundry is a native terminal workspace for agentic software work. It provides the `af` command, first-run configuration, health diagnostics, durable run/session records, and a React Ink TUI designed around context, tasks, diffs, and clear runtime status.

AlphaFoundry is its own product. Runtime execution is adapter-based: the current adapter is `@mariozechner/pi-coding-agent`, which handles model/tool execution behind the AlphaFoundry command surface. Pi Agent is an implementation detail of the runtime layer, not the product identity.

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
- Runtime adapter package installation
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

Tool governance is generic foundation work. AlphaFoundry has deterministic permission/protected-path decisions, verification evidence summaries, Pi built-in tool profile mapping, persisted approval decisions, local replay/eval checks, and a safe in-process tool-pack executor skeleton. In the TUI, `/tools <list>` requests runtime tools and `/approve-tools` approves pending write/shell-capable requests for the current session before retrying. It does not yet implement a full live tool-call pause/resume prompt, MCP/server loading, external tool marketplaces, finance, or domain tool execution.

## Runtime adapter

The current runtime adapter delegates model/tool execution to `@mariozechner/pi-coding-agent`. Future runtime work will deepen live streaming, backend session integration, cancellation, tool visibility, and provider/model discovery while preserving AlphaFoundry as the product identity.

## Release, roadmap, and project support

- See `docs/ROADMAP.md` for the council-derived implementation phases.
- See `docs/RELEASE.md` for the release checklist, verification gates, and npm publish runbook.
- See `docs/BENEFITS_APPLICATION_KIT.md` for reusable open-source, student, startup, and cloud-credit application language.
- See `CHANGELOG.md` for notable changes and known limitations.
