#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPiArgs } from "./pi-backend.js";
import { defaultConfigPath, getConfigValue, initConfig, setConfigValue } from "./config.js";
import { formatDoctor, runDoctor } from "./doctor.js";

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

function printHelp() {
  console.log(`AlphaFoundry - native AI product workspace with Pi Agent runtime adapter

Usage:
  af                         Start AlphaFoundry Ink TUI
  af tui                     Start AlphaFoundry Ink TUI
  af init [--non-interactive] Create ~/.alphafoundry/config.json
  af doctor [--json]         Check local AlphaFoundry health
  af config path             Print active config path
  af config get <key>        Read config key (provider, model, env.apiKey, env.baseUrl)
  af config set <key> <value> Set provider/model/env var names only; never raw secrets
  af models                  Explain backend-delegated model listing
  af session                 Explain AlphaFoundry session support
  af -p "message"             Run one prompt through the Pi Agent runtime adapter
  af --provider openai --model gpt-4o-mini -p "message"

AlphaFoundry owns the product identity and command surface. Pi Agent is the runtime adapter for model/tool execution.
`);
}

function handleInit(args) {
  const nonInteractive = args.includes("--non-interactive");
  if (!nonInteractive && !process.stdin.isTTY) {
    console.error("Use af init --non-interactive when running without a TTY.");
    return 1;
  }
  const result = initConfig({ nonInteractive });
  console.log(`AlphaFoundry config ${result.created ? "created" : "already exists"}: ${result.path}`);
  return 0;
}

function handleConfig(args) {
  const subcommand = args[0];
  if (subcommand === "path") {
    console.log(defaultConfigPath());
    return 0;
  }
  if (subcommand === "get") {
    const key = args[1];
    if (!key) {
      console.error("Usage: af config get <key>");
      return 1;
    }
    const value = getConfigValue(key);
    if (typeof value === "object") console.log(JSON.stringify(value, null, 2));
    else if (value !== undefined) console.log(String(value));
    return value === undefined ? 1 : 0;
  }
  if (subcommand === "set") {
    const [key, value] = args.slice(1);
    if (!key || !value) {
      console.error("Usage: af config set <key> <value>");
      return 1;
    }
    const result = setConfigValue(key, value);
    console.log(`AlphaFoundry config updated: ${key} (${result.path})`);
    return 0;
  }
  console.error("Usage: af config path|get|set");
  return 1;
}

function handleDoctor(args) {
  const report = runDoctor();
  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatDoctor(report));
  }
  return 0;
}

function handleModels() {
  console.log(`AlphaFoundry models

Model discovery is delegated to the configured runtime adapter. The current adapter is @mariozechner/pi-coding-agent, so provider/model flags continue to pass through to that backend.

Use:
  af config set provider <name>
  af config set model <model>
  af --provider <name> --model <model> -p "hello"
`);
  return 0;
}

function handleSession() {
  console.log(`AlphaFoundry sessions

Session-aware workflows are part of the AlphaFoundry product surface. Current one-shot and TUI execution are available; richer native session listing/resume commands are planned while backend session behavior remains delegated to the runtime adapter.
`);
  return 0;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log("AlphaFoundry 0.3.0");
    return 0;
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }

  const [command, ...rest] = args;
  if (command === "init") return handleInit(rest);
  if (command === "doctor") return handleDoctor(rest);
  if (command === "config") return handleConfig(rest);
  if (command === "models") return handleModels(rest);
  if (command === "session") return handleSession(rest);

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
