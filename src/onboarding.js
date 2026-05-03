import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import { defaultConfig, defaultConfigPath, defaultSecretsPath, readConfig, writeConfig, writeLocalEnv } from "./config.js";
import { formatDoctor, runDoctor } from "./doctor.js";
import { providerDefaults } from "./provider-defaults.js";

function isEnvVarName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function looksLikeSecret(value) {
  return /^(sk-|sk_|AIza|xox|ghp_|github_pat_|Bearer\s+)|[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}/i.test(String(value ?? ""))
    || (String(value ?? "").length >= 32 && !isEnvVarName(value));
}

function yes(value) {
  return /^y(es)?$/i.test(String(value ?? ""));
}

function no(value) {
  return /^n(o)?$/i.test(String(value ?? ""));
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
  const exists = options.exists ?? existsSync;

  const existing = exists(path) ? readConfig({ path, env }) : defaultConfig();

  output.write("AlphaFoundry onboarding\n");
  output.write("Set up the local app in four steps: provider, model, credentials, verification.\n");
  output.write("Config stores environment variable names only, never raw secrets. Pasted keys can be saved to the local env file; config.json always stays secret-free.\n\n");

  const scripted = !input.isTTY;
  const rl = scripted ? null : createInterface({ input, output, terminal: true });
  const ask = scripted ? createScriptedAsk(input, output) : (question, fallback) => askInteractive(rl, question, fallback);

  try {
    output.write("Step 1/4: Choose the provider AlphaFoundry should call.\n");
    const provider = (await ask("Provider [openai/anthropic/gemini/openrouter/default]", existing.provider ?? "openai")).toLowerCase();
    const defaults = providerDefaults(provider);
    output.write("Step 2/4: Pick the default model.\n");
    const model = await ask("Model", existing.model && existing.model !== "default" ? existing.model : defaults.model);
    output.write("Step 3/4: Connect credentials. Raw secrets go to the local env file.\n");
    const apiKeyInput = await ask("API key env var name or paste key", existing.env?.apiKey ?? defaults.apiKey);
    const baseUrl = await ask("Base URL env var name, if your provider needs one", existing.env?.baseUrl ?? "");
    const defaultApiKeyName = existing.provider === provider && existing.env?.apiKey && isEnvVarName(existing.env.apiKey) ? existing.env.apiKey : defaults.apiKey;
    const pastedApiKey = looksLikeSecret(apiKeyInput) ? apiKeyInput : "";
    const apiKey = pastedApiKey ? defaultApiKeyName : apiKeyInput;
    const savePastedKey = pastedApiKey ? await ask(`Save pasted API key to ${defaultSecretsPath(env, { configPath: path })}? [Y/n]`, "Y") : "N";
    output.write("Step 4/4: Verify the setup.\n");
    const runDoctorNow = await ask("Run doctor now? [Y/n]", "Y");
    const openNow = await ask("Open AlphaFoundry after setup? [y/N]", "N");

    if (!isEnvVarName(apiKey)) throw new Error("API key input must be an environment variable name or a pasted API key");
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
    let secretsPath = "";
    let doctorEnv = env;
    if (pastedApiKey && !no(savePastedKey)) {
      const secret = writeLocalEnv({ [apiKey]: pastedApiKey }, { env, configPath: path });
      secretsPath = secret.path;
      doctorEnv = { ...env, [apiKey]: pastedApiKey };
    }

    output.write("\nSetup summary:\n");
    output.write(`  Provider: ${provider}\n`);
    output.write(`  Model: ${model}\n`);
    output.write(`  Config written: ${path}\n`);
    output.write(`  API key source: ${apiKey}\n`);
    if (baseUrl) output.write(`  Base URL source: ${baseUrl}\n`);
    if (secretsPath) output.write(`  API key saved locally: ${secretsPath} (0600)\n`);
    else if (pastedApiKey) output.write(`  API key not saved. Export ${apiKey} before running AlphaFoundry.\n`);
    if (!no(runDoctorNow)) {
      const report = runDoctor({ configPath: path, env: doctorEnv });
      output.write("\n");
      output.write(formatDoctor(report));
      output.write("\n");
    }

    output.write("\nNext steps:\n");
    const steps = [];
    if (!secretsPath) steps.push(`export ${apiKey}=...`);
    else steps.push("af doctor");
    if (baseUrl) steps.push(`export ${baseUrl}=...`);
    if (!secretsPath) steps.push("af doctor");
    steps.push("af");
    steps.forEach((step, index) => output.write(`  ${index + 1}. ${step}\n`));
    output.write("Run af to open the AlphaFoundry workspace.\n");

    return { path, created: true, config, secretsPath: secretsPath || undefined, doctorRun: !no(runDoctorNow), openNow: yes(openNow) };
  } finally {
    rl?.close();
  }
}
