# AlphaFoundry

AlphaFoundry is a native terminal workspace for agentic software work. It provides the `af` command, first-run configuration, health diagnostics, and a React Ink TUI designed around context, tasks, diffs, and clear runtime status.

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

Create an AlphaFoundry-native config file:

```sh
af init --non-interactive
```

By default this writes:

```text
~/.alphafoundry/config.json
```

Override the path with:

```sh
ALPHAFOUNDRY_CONFIG_PATH=/path/to/config.json af init --non-interactive
```

PowerShell:

```powershell
$env:ALPHAFOUNDRY_CONFIG_PATH = "C:\Users\you\.alphafoundry\config.json"
af init --non-interactive
```

The config stores provider names, model names, and environment variable names only. It must not contain raw API keys, tokens, or passwords.

Example:

```json
{
  "product": "AlphaFoundry",
  "version": 1,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "env": {
    "apiKey": "OPENAI_KEY_ENV",
    "baseUrl": "OPENAI_BASE_URL"
  }
}
```

## Commands

```sh
af                         # open the AlphaFoundry TUI
af tui                     # same
af init --non-interactive  # create AlphaFoundry config
af doctor                  # human-readable health report
af doctor --json           # machine-readable health report
af config path             # print active config path
af config get provider     # read config value
af config set provider openai
af config set model gpt-4o-mini
af config set env.apiKey OPENAI_API_KEY
af config set env.baseUrl OPENAI_BASE_URL
af models                  # explain runtime-adapter model listing
af session                 # explain current/planned session support
af -p "hello"              # one-shot prompt through the runtime adapter
```

Provider credentials stay in your shell environment:

```sh
export OPENAI_API_KEY="..."
af config set env.apiKey OPENAI_API_KEY
```

PowerShell:

```powershell
$env:OPENAI_API_KEY = "..."
af config set env.apiKey OPENAI_API_KEY
```

## TUI slash commands

```text
/help                 show TUI command help
/model <provider/model> set local model preference for the next runtime prompt
/provider <name>      set local provider preference for the next runtime prompt
/stats                show local TUI counters; runtime stats appear after runs
/tools <list>         set local tool preference; enforcement depends on adapter support
/session              show local TUI session metadata
/new                  start a fresh local TUI session; backend session is not changed
/export               print the local transcript in the conversation
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
- TTY capability for interactive terminal use

Use JSON output for scripts:

```sh
af doctor --json
```

## Runtime adapter

AlphaFoundry owns the user-facing product surface: `af`, config, doctor, docs, roadmap, and TUI workflow. The current runtime adapter delegates model/tool execution to `@mariozechner/pi-coding-agent`. Future runtime work will deepen streaming, sessions, cancellation, tool visibility, and provider/model discovery while preserving AlphaFoundry as the product identity.

## Roadmap

See `docs/ROADMAP.md` for the council-derived implementation phases.
