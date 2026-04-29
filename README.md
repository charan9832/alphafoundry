# AlphaFoundry

AlphaFoundry is a context-first terminal TUI that keeps the `af` command and delegates model/tool execution to Pi Agent.

The current TUI is inspired by Huashu Design principles: do not start from generic AI chrome; start from design context, restrained hierarchy, reasoning, craft review, and clear placeholders.

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
