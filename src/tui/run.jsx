import React from "react";
import { render } from "ink";
import { App } from "./app.jsx";

export function runTui() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(`AlphaFoundry TUI requires an interactive terminal.

Try:
  af --help          Show CLI commands
  af doctor         Human-readable health report
  af doctor --json  Machine-readable health report for scripts
  af onboard        Configure provider, model, and credentials`);
    process.exit(1);
  }
  render(<App />);
}
