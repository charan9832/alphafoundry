#!/usr/bin/env node
import { applyLlmConfig, createDefaultConfig, defaultConfigPath, isConfigured, loadConfig, saveConfig } from "./config.js";
import { respondToMessage } from "./agent/runtime.js";
import { buildReadinessReport } from "./tools/readiness.js";
import { researchDisclaimer } from "./safety.js";
import { runTui } from "./tui/app.js";
import type { LlmConfig, ProviderKind } from "./types.js";
import { basename } from "node:path";

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (isBooleanFlag(key)) {
        flags[key] = true;
      } else if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else if (isStringFlag(key)) {
        throw new Error(`Missing value for --${key}`);
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { command, positionals, flags };
}

function isBooleanFlag(key: string): boolean {
  return new Set(["json", "non-interactive", "help"]).has(key);
}

function isStringFlag(key: string): boolean {
  return new Set(["config", "workspace", "provider", "model", "base-url", "api-key-env"]).has(key);
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const configPath = typeof args.flags.config === "string" ? args.flags.config : defaultConfigPath();
  const command = args.command ?? "launch";

  if (command === "launch") return launch(configPath);
  if (command === "onboard") return onboard(args, configPath);
  if (command === "doctor") return doctor(configPath, Boolean(args.flags.json));
  if (command === "chat") return chat(args, configPath);
  if (command === "tui") return tui(configPath);
  if (command === "help" || command === "--help" || command === "-h") return help();

  // Natural command fallback: `alphafoundry check the repo` behaves like
  // `alphafoundry chat "check the repo"` while keeping known subcommands explicit.
  return chat({ ...args, command: "chat", positionals: [command, ...args.positionals] }, configPath);
}

async function launch(configPath: string): Promise<number> {
  const config = await loadConfig(configPath);
  if (!isConfigured(config)) {
    console.log(`Welcome to AlphaFoundry\n\n${researchDisclaimer()}\n\nFirst run setup is required. Run:\n  alphafoundry onboard --provider local --model local-finance-agent --non-interactive\n\nFor real providers, set an API key env var and pass --api-key-env NAME.`);
    return 0;
  }
  console.log(`AlphaFoundry Agent\n${researchDisclaimer()}\n\nConfigured provider: ${config.llm.provider}/${config.llm.model}\nStart chatting with: alphafoundry chat "hey"`);
  return 0;
}

async function onboard(args: ParsedArgs, configPath: string): Promise<number> {
  const existing = (await loadConfig(configPath)) ?? createDefaultConfig(typeof args.flags.workspace === "string" ? args.flags.workspace : undefined);
  const currentProvider = existing.llm?.provider;
  const currentModel = existing.llm?.model;
  const provider = (typeof args.flags.provider === "string" ? args.flags.provider : currentProvider ?? "local") as ProviderKind;
  const model = typeof args.flags.model === "string" ? args.flags.model : currentModel ?? "local-finance-agent";
  const llm: LlmConfig = { provider, model };
  if (typeof args.flags["base-url"] === "string") llm.baseUrl = args.flags["base-url"];
  else if (existing.llm?.baseUrl) llm.baseUrl = existing.llm.baseUrl;
  if (typeof args.flags["api-key-env"] === "string") llm.apiKeyEnv = args.flags["api-key-env"];
  else if (existing.llm?.apiKeyEnv) llm.apiKeyEnv = existing.llm.apiKeyEnv;
  const updated = applyLlmConfig(existing, llm);
  await saveConfig(updated, configPath);
  const report = await buildReadinessReport(updated);
  console.log(`AlphaFoundry onboarding complete.\nProvider: ${provider}\nModel: ${model}\nConfig: ${configPath}\nReadiness: ${JSON.stringify(report, null, 2)}`);
  return 0;
}

async function doctor(configPath: string, json: boolean): Promise<number> {
  const report = await buildReadinessReport(await loadConfig(configPath));
  if (json) console.log(JSON.stringify(report, null, 2));
  else console.log(`AlphaFoundry readiness\n${Object.entries(report).map(([key, value]) => `- ${key}: ${value}`).join("\n")}`);
  return report.config === "ok" ? 0 : 1;
}

async function chat(args: ParsedArgs, configPath: string): Promise<number> {
  const config = await loadConfig(configPath);
  if (!isConfigured(config)) {
    console.log("AlphaFoundry is not onboarded yet. Run `alphafoundry onboard` first.");
    return 1;
  }
  const message = args.positionals.join(" ").trim() || "hey";
  const result = await respondToMessage(config, message, () => loadConfig(configPath));
  if (args.flags.json) console.log(JSON.stringify(result, null, 2));
  else console.log(result.response);
  return 0;
}

async function tui(configPath: string): Promise<number> {
  const config = await loadConfig(configPath);
  if (!isConfigured(config)) {
    console.log("AlphaFoundry is not onboarded yet. Run `alphafoundry onboard` first.");
    return 1;
  }
  await runTui(config);
  return 0;
}

function help(): number {
  console.log(`AlphaFoundry\n\nCommands:\n  launch             Open product entrypoint\n  onboard            Configure LLM provider and workspace\n  doctor [--json]    Check readiness\n  chat <message>     Talk to the agent (one-shot)\n  tui                Open interactive TUI chat\n\nSafety: research/paper-validation only; live trading disabled.`);
  return 0;
}

const invokedAsCli = basename(process.argv[1] ?? "") === "cli.js" || basename(process.argv[1] ?? "") === "alphafoundry";

if (invokedAsCli) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
