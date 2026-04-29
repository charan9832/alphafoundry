#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPiArgs } from "./pi-backend.js";

function packageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function runInkTui() {
  const root = packageRoot();
  const tsxLoader = join(root, "node_modules", "tsx", "dist", "loader.mjs");
  const tsxLoaderUrl = pathToFileURL(tsxLoader).href;
  const runFile = join(root, "src", "tui", "run-cli.jsx");
  const result = spawnSync(process.execPath, ["--import", tsxLoaderUrl, runFile], {
    stdio: "inherit",
    env: { ...process.env },
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 0;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log("AlphaFoundry 0.3.0");
    return 0;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AlphaFoundry - React Ink TUI powered by Pi Agent

Usage:
  af                         Start AlphaFoundry Ink TUI
  af tui                     Start AlphaFoundry Ink TUI
  af -p "message"             Run one prompt with Pi Agent and exit
  af --provider openai --model gpt-4o-mini -p "message"

TUI:
  Home screen: centered AlphaFoundry logo + input palette
  Workspace: split pane with transcript, context sidebar, and sticky status bar

AlphaFoundry keeps the af command and delegates model/tool execution to @mariozechner/pi-coding-agent.
`);
    return 0;
  }

  if (args.length === 0 || args[0] === "tui") {
    return runInkTui();
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
