import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import { defaultConfig, defaultConfigPath, readConfig, writeConfig } from "./config.js";

const PROVIDER_DEFAULTS = Object.freeze({
  openai: { model: "gpt-4o-mini", apiKey: "OPENAI_API_KEY", baseUrl: "OPENAI_BASE_URL" },
  anthropic: { model: "claude-sonnet-4", apiKey: "ANTHROPIC_API_KEY", baseUrl: "ANTHROPIC_BASE_URL" },
  gemini: { model: "gemini-1.5-flash", apiKey: "GEMINI_API_KEY", baseUrl: "GEMINI_BASE_URL" },
  openrouter: { model: "openai/gpt-4o-mini", apiKey: "OPENROUTER_API_KEY", baseUrl: "OPENROUTER_BASE_URL" },
  default: { model: "default", apiKey: "ALPHAFOUNDRY_API_KEY", baseUrl: "" },
});

function isEnvVarName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function providerDefaults(provider) {
  return PROVIDER_DEFAULTS[String(provider ?? "").toLowerCase()] ?? PROVIDER_DEFAULTS.default;
}

async function askInteractive(rl, question, fallback = "") {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

function createScriptedAsk(input, output) {
  const raw = input === defaultInput ? readFileSync(0, "utf8") : "";
  const answers = raw.split(/\r?\n/);
  let index = 0;
  return async (question, fallback = "") => {
    const suffix = fallback ? ` (${fallback})` : "";
    output.write(`${question}${suffix}: `);
    const answer = String(answers[index++] ?? "").trim();
    return answer || fallback;
  };
}

export async function runOnboarding(options = {}) {
  const input = options.input ?? defaultInput;
  const output = options.output ?? defaultOutput;
  const env = options.env ?? process.env;
  const path = options.path ?? defaultConfigPath(env);
  const force = Boolean(options.force);
  const exists = options.exists ?? existsSync;

  const existing = readConfig({ path, env });
  if (!force && exists(path)) {
    output.write(`AlphaFoundry config already exists: ${path}\n`);
    output.write("Re-run with --force to overwrite, or use af config set <key> <value>.\n");
    return { path, created: false, config: existing };
  }

  output.write("AlphaFoundry onboarding\n");
  output.write("Config stores environment variable names only, never raw secrets.\n\n");

  const scripted = !input.isTTY;
  const rl = scripted ? null : createInterface({ input, output, terminal: true });
  const ask = scripted ? createScriptedAsk(input, output) : (question, fallback) => askInteractive(rl, question, fallback);

  try {
    const provider = (await ask("Provider [openai/anthropic/gemini/openrouter/default]", existing.provider ?? "openai")).toLowerCase();
    const defaults = providerDefaults(provider);
    const model = await ask("Model", existing.model && existing.model !== "default" ? existing.model : defaults.model);
    const apiKey = await ask("API key environment variable name", existing.env?.apiKey ?? defaults.apiKey);
    const baseUrl = await ask("Base URL environment variable name (optional)", existing.env?.baseUrl ?? "");
    const openNow = await ask("Open AlphaFoundry after setup? [y/N]", "N");

    if (!isEnvVarName(apiKey)) throw new Error("AlphaFoundry config stores environment variable names only, not raw secrets");
    if (baseUrl && !isEnvVarName(baseUrl)) throw new Error("AlphaFoundry config stores environment variable names only, not raw secrets");

    const config = {
      ...defaultConfig(),
      provider,
      model,
      env: {
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
      },
    };
    writeConfig(config, { path, env });

    output.write(`\nConfig written: ${path}\n`);
    output.write("Next steps:\n");
    output.write(`  export ${apiKey}=...\n`);
    if (baseUrl) output.write(`  export ${baseUrl}=...\n`);
    output.write("  af doctor\n");
    output.write("  af\n");
    output.write("Run af to open AlphaFoundry.\n");

    return { path, created: true, config, openNow: /^y(es)?$/i.test(openNow) };
  } finally {
    rl?.close();
  }
}
