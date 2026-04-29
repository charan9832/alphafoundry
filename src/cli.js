#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { startTui } from "./tui.js";
import { buildPiArgs } from "./pi-backend.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log("AlphaFoundry 0.2.0");
    return 0;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AlphaFoundry - opencode-style TUI powered by Pi Agent

Usage:
  af                         Start AlphaFoundry TUI
  af tui                     Start AlphaFoundry TUI
  af -p "message"             Run one prompt with Pi Agent and exit
  af --provider openai --model gpt-4o-mini -p "message"

TUI commands:
  /help                      Show TUI help
  /model <id>                Set model hint
  /provider <name>           Set provider hint
  /clear                     Clear chat
  /exit                      Quit

AlphaFoundry keeps the af command and delegates model/tool execution to @mariozechner/pi-coding-agent.
`);
    return 0;
  }

  if (args.length === 0 || args[0] === "tui") {
    await startTui();
    return 0;
  }

  const result = spawnSync(process.execPath, buildPiArgs(args), {
    stdio: "inherit",
    env: {
      ...process.env,
      PI_CONFIG_DIR: process.env.ALPHAFOUNDRY_CONFIG_DIR ?? process.env.PI_CONFIG_DIR,
    },
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
