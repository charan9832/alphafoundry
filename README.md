# AlphaFoundry

AlphaFoundry is a React Ink split-pane terminal TUI that keeps the `af` command and delegates model/tool execution to Pi Agent.

The current TUI uses a proper React Ink native terminal architecture: home input palette, active workspace split pane, context sidebar, task list, diff formatting, and sticky status bar. The visual direction stays restrained and context-first.

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
/model <provider/model>
/provider <name>
/clear
/exit
```

## Design direction

The TUI is intentionally calmer than a busy coding shell:

- Design context card first
- Restrained colors instead of neon AI clichés
- Clear status: Ask · Search · Build · Review
- Reasoning and context are visible in the transcript
- Craft score reminds the agent not to ship generic output

Runtime backend: `@mariozechner/pi-coding-agent`.
