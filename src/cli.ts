#!/usr/bin/env node
import { applyLlmConfig, applySearchConfig, createDefaultConfig, defaultConfigPath, defaultWorkspace, isConfigured, loadConfig, saveConfig } from "./config.js";
import { respondToMessage } from "./agent/runtime.js";
import { buildReadinessReport } from "./tools/readiness.js";
import { runTui } from "./tui/app.js";
import type { LlmConfig, ProviderKind } from "./types.js";
import { basename } from "node:path";
import { askOnboardingQuestions, defaultApiKeyEnvForProvider, defaultModelForProvider, detectLocalSearch, inferSearchProvider, isValidProvider, parseProvider } from "./onboarding.js";

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
  return new Set(["json", "non-interactive", "help", "search-autodetect"]).has(key);
}

function isStringFlag(key: string): boolean {
  return new Set(["config", "workspace", "provider", "model", "base-url", "api-key-env", "search-provider", "search-endpoint", "search-api-key-env", "search-probe", "session"]).has(key);
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
  if (command === "onboard") {
    try {
      return await onboard(args, configPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 2;
    }
  }
  if (command === "doctor") return doctor(configPath, Boolean(args.flags.json));
  if (command === "chat") return chat(args, configPath);
  if (command === "tui") return tui(configPath);
  if (command === "help" || command === "--help" || command === "-h") return help();

  // Natural command fallback: `af check the repo` behaves like
  // `af chat "check the repo"` while keeping known subcommands explicit.
  return chat({ ...args, command: "chat", positionals: [command, ...args.positionals] }, configPath);
}

async function launch(configPath: string): Promise<number> {
  const config = await loadConfig(configPath);
  if (!isConfigured(config)) {
    console.log(`Welcome to AlphaFoundry\n\nFirst run setup is required. Run:\n  af onboard --provider local --model local-agent --non-interactive\n\nFor real providers, set an API key env var and pass --api-key-env NAME.\nOptional web search: set ALPHAFOUNDRY_WEB_SEARCH_URL and ALPHAFOUNDRY_WEB_SEARCH_API_KEY_ENV.`);
    return 0;
  }
  if (!process.stdin.isTTY) {
    console.log(`AlphaFoundry Agent\n\nConfigured provider: ${config.llm.provider}/${config.llm.model}\nInteractive chat requires a TTY. Try:\n  af chat "hey"\n  af chat "search the web for recent AI agent news"\n  af doctor`);
    return 0;
  }
  await runTui(config);
  return 0;
}

async function onboard(args: ParsedArgs, configPath: string): Promise<number> {
  const existing = (await loadConfig(configPath)) ?? createDefaultConfig(typeof args.flags.workspace === "string" ? args.flags.workspace : undefined);
  let updated = existing;

  if (!args.flags["non-interactive"] && process.stdin.isTTY === false) {
    // Tests and piped setup can still drive the prompts through stdin.
  }

  if (!args.flags["non-interactive"] && !hasExplicitOnboardFlags(args)) {
    const answers = await askOnboardingQuestions({
      provider: existing.llm?.provider ?? "local",
      model: existing.llm?.model ?? defaultModelForProvider(existing.llm?.provider ?? "local"),
      apiKeyEnv: existing.llm?.apiKeyEnv,
      baseUrl: existing.llm?.baseUrl,
      workspace: existing.workspace ?? defaultWorkspace(),
      search: existing.search,
    });
    updated = { ...updated, workspace: answers.workspace };
    const llm: LlmConfig = { provider: answers.provider, model: answers.model };
    if (answers.baseUrl) llm.baseUrl = answers.baseUrl;
    if (answers.apiKeyEnv) llm.apiKeyEnv = answers.apiKeyEnv;
    updated = applyLlmConfig(updated, llm);
    updated = applySearchConfig(updated, answers.search);
  } else {
    const currentProvider = existing.llm?.provider;
    const currentModel = existing.llm?.model;
    if (typeof args.flags.provider === "string" && !isValidProvider(args.flags.provider)) throw new Error(`Invalid provider: ${args.flags.provider}`);
    const provider = parseProvider(typeof args.flags.provider === "string" ? args.flags.provider : currentProvider ?? "local", currentProvider ?? "local");
    const providerChanged = provider !== currentProvider;
    const model = typeof args.flags.model === "string" ? args.flags.model : providerChanged ? defaultModelForProvider(provider) : currentModel ?? defaultModelForProvider(provider);
    const llm: LlmConfig = { provider, model };
    if (typeof args.flags["base-url"] === "string") llm.baseUrl = args.flags["base-url"];
    else if (existing.llm?.baseUrl) llm.baseUrl = existing.llm.baseUrl;
    if (typeof args.flags["api-key-env"] === "string") llm.apiKeyEnv = args.flags["api-key-env"];
    else if (providerChanged) {
      const env = defaultApiKeyEnvForProvider(provider);
      if (env) llm.apiKeyEnv = env;
    } else if (existing.llm?.apiKeyEnv) llm.apiKeyEnv = existing.llm.apiKeyEnv;
    updated = applyLlmConfig(existing, llm);

    const search = await searchConfigFromFlags(args, existing.search);
    if (search) updated = applySearchConfig(updated, search);
  }

  await saveConfig(updated, configPath);
  const report = await buildReadinessReport(updated);
  const searchSummary = updated.search ? `${updated.search.provider}${updated.search.endpoint ? ` (${updated.search.endpoint})` : ""}` : "none";
  console.log(`AlphaFoundry onboarding complete.\nProvider: ${updated.llm?.provider}\nModel: ${updated.llm?.model}\nSearch: ${searchSummary}\nConfig: ${configPath}\nReadiness: ${JSON.stringify(report, null, 2)}`);
  return 0;
}

function hasExplicitOnboardFlags(args: ParsedArgs): boolean {
  return ["provider", "model", "base-url", "api-key-env", "workspace", "search-provider", "search-endpoint", "search-api-key-env", "search-probe", "search-autodetect"].some((flag) => args.flags[flag] !== undefined);
}

async function searchConfigFromFlags(args: ParsedArgs, existing?: import("./types.js").SearchConfig): Promise<import("./types.js").SearchConfig | undefined> {
  if (typeof args.flags["search-provider"] === "string") {
    const provider = args.flags["search-provider"] as import("./types.js").SearchProviderKind;
    if (provider === "none") return { provider: "none" };
    const endpoint = typeof args.flags["search-endpoint"] === "string" ? args.flags["search-endpoint"] : existing?.endpoint;
    const apiKeyEnv = typeof args.flags["search-api-key-env"] === "string" ? args.flags["search-api-key-env"] : existing?.apiKeyEnv;
    return { provider, endpoint, apiKeyEnv };
  }
  if (typeof args.flags["search-endpoint"] === "string") {
    const endpoint = args.flags["search-endpoint"];
    const apiKeyEnv = typeof args.flags["search-api-key-env"] === "string" ? args.flags["search-api-key-env"] : existing?.apiKeyEnv;
    return { provider: inferSearchProvider(endpoint), endpoint, apiKeyEnv };
  }
  if (args.flags["search-autodetect"]) {
    const probes = typeof args.flags["search-probe"] === "string" ? [args.flags["search-probe"]] : undefined;
    const detected = await detectLocalSearch(probes);
    return detected ? { provider: detected.provider, endpoint: detected.endpoint, autoDetected: true } : { provider: "none" };
  }
  return existing;
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
    console.log("AlphaFoundry is not onboarded yet. Run `af onboard` first.");
    return 1;
  }
  const message = args.positionals.join(" ").trim() || "hey";
  const sessionId = typeof args.flags.session === "string" ? args.flags.session : undefined;
  const result = await respondToMessage(config, message, () => loadConfig(configPath), { sessionId });
  if (args.flags.json) console.log(JSON.stringify(result, null, 2));
  else console.log(result.response);
  return 0;
}

async function tui(configPath: string): Promise<number> {
  const config = await loadConfig(configPath);
  if (!isConfigured(config)) {
    console.log("AlphaFoundry is not onboarded yet. Run `af onboard` first.");
    return 1;
  }
  await runTui(config);
  return 0;
}

function help(): number {
  console.log(`AlphaFoundry\n\nUsage:\n  af                  Open interactive chat when onboarded\n  af onboard          Interactive LLM/search/workspace setup\n  af doctor [--json]  Check readiness\n  af chat <message> [--session ID]   Talk to the agent one-shot\n  af tui              Open interactive TUI chat explicitly\n  af <free text>      Natural command fallback, same as chat\n\nExamples:\n  af onboard\n  af onboard --provider local --model local-agent --search-autodetect --non-interactive\n  af chat "hey"\n  af chat "search the web for recent AI agent news" --json\n\nLocal search autodetect probes common SearXNG and Firecrawl endpoints.\nManual search flags:\n  --search-provider searxng|firecrawl|custom|none\n  --search-endpoint http://127.0.0.1:8080/search\n  --search-api-key-env SEARCH_API_KEY_ENV`);
  return 0;
}

const invokedAsCli = ["cli.js", "cli.ts", "alphafoundry", "af"].includes(basename(process.argv[1] ?? ""));

if (invokedAsCli) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
