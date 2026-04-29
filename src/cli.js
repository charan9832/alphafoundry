#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  console.log("AlphaFoundry 0.1.0");
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`AlphaFoundry - Pi Agent under the af command

Usage:
  af [options] [@files...] [messages...]

Common commands:
  af                         Start interactive agent
  af -p "message"             Run one prompt and exit
  af --provider openai --model gpt-4o-mini -p "message"
  af /login                  Open provider login flow inside interactive mode

AlphaFoundry delegates to @mariozechner/pi-coding-agent, so Pi Agent flags also work.
`);
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(here);
const piCli = join(packageRoot, "node_modules", "@mariozechner", "pi-coding-agent", "dist", "cli.js");

const result = spawnSync(process.execPath, [piCli, ...args], {
  stdio: "inherit",
  env: {
    ...process.env,
    PI_CONFIG_DIR: process.env.ALPHAFOUNDRY_CONFIG_DIR ?? process.env.PI_CONFIG_DIR,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
