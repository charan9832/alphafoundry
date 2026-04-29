# AlphaFoundry

AlphaFoundry is an opencode-style terminal TUI that keeps the `af` command and delegates model/tool execution to Pi Agent.

## Run

```bash
npm install
npm link
af
```

## Commands

```bash
af                         # open the AlphaFoundry TUI
af tui                     # same
af --help                  # command help
af -p "hello"              # one-shot prompt through Pi Agent
```

## TUI commands

```text
/help
/model <id>
/provider <name>
/clear
/exit
```

## Design

The TUI borrows the OpenCode feel: compact header, current provider/model, scrollable chat-like transcript, command hints, and a prompt line.

Runtime backend: `@mariozechner/pi-coding-agent`.
