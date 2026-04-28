import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AppConfig, LlmConfig } from "./types.js";

export function defaultConfigPath(): string {
  return process.env.ALPHAFOUNDRY_CONFIG_PATH ?? process.env.ALPAFOUNDRY_CONFIG_PATH ?? join(homedir(), ".alphafoundry", "config.json");
}

export function defaultWorkspace(): string {
  return process.env.ALPHAFOUNDRY_WORKSPACE ?? process.env.ALPAFOUNDRY_WORKSPACE ?? join(homedir(), ".alphafoundry", "workspace");
}

export function createDefaultConfig(workspace = defaultWorkspace()): AppConfig {
  return {
    version: 1,
    workspace,
    safety: {
      liveTradingEnabled: false,
      disclaimerAccepted: true,
    },
  };
}

export async function loadConfig(path = defaultConfigPath()): Promise<AppConfig | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as AppConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveConfig(config: AppConfig, path = defaultConfigPath()): Promise<void> {
  const serialized = JSON.stringify(config, null, 2);
  if (containsSecretLikeValue(serialized)) {
    throw new Error("Refusing to persist secret-like value in AlphaFoundry config");
  }
  await mkdir(dirname(path), { recursive: true });
  await mkdir(config.workspace, { recursive: true });
  await writeFile(path, `${serialized}\n`, "utf8");
}

export function applyLlmConfig(config: AppConfig, llm: LlmConfig): AppConfig {
  if (llm.apiKeyEnv && (!isValidEnvVarName(llm.apiKeyEnv) || containsSecretLikeValue(llm.apiKeyEnv))) {
    throw new Error("apiKeyEnv must be an environment variable name, not a raw secret");
  }
  return { ...config, llm };
}

export function isConfigured(config: AppConfig | null): config is AppConfig & { llm: LlmConfig } {
  return Boolean(config?.llm?.provider && config.llm.model);
}

export function containsSecretLikeValue(value: string): boolean {
  return /(?:sk-|sk_|sk-proj-|sk-ant-)[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9_]{20,}|OPENROUTER-[A-Za-z0-9_-]{12,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^,\s}]+/i.test(value);
}

export function isValidEnvVarName(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value);
}
