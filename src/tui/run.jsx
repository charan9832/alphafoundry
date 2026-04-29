import React from "react";
import { render } from "ink";
import { App } from "./app.jsx";

export function runTui() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("AlphaFoundry TUI requires an interactive terminal.");
    process.exit(1);
  }
  render(<App />);
}
