import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const SUPPORTED_KEYS = new Set(["provider", "model", "env.apiKey", "env.baseUrl"]);

export function defaultConfigPath(env = process.env) {
  if (env.ALPHAFOUNDRY_CONFIG_PATH) return env.ALPHAFOUNDRY_CONFIG_PATH;
  const home = env.HOME || env.USERPROFILE || homedir();
  return join(home, ".alphafoundry", "config.json");
}

export function defaultConfig() {
  return {
    product: "AlphaFoundry",
    version: 1,
    provider: "default",
    model: "default",
    env: {
      apiKey: "ALPHAFOUNDRY_API_KEY",
    },
  };
}

function configPath(options = {}) {
  return options.path ?? defaultConfigPath(options.env ?? process.env);
}

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function assertSupportedKey(key) {
  if (!SUPPORTED_KEYS.has(key)) {
    throw new Error(`Unsupported config key: ${key}. Supported keys: ${[...SUPPORTED_KEYS].join(", ")}`);
  }
}

function isEnvVarName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function assertSafeValue(key, value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Config value for ${key} must be a non-empty string`);
  }
  if (key.startsWith("env.") && !isEnvVarName(value)) {
    throw new Error("AlphaFoundry config stores environment variable names only, not raw secrets");
  }
  if (/sk-|secret|token|password|bearer\s+/i.test(value) && !isEnvVarName(value)) {
    throw new Error("AlphaFoundry config stores environment variable names only, not raw secrets");
  }
}

export function readConfig(options = {}) {
  const path = configPath(options);
  if (!existsSync(path)) return defaultConfig();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return {
    ...defaultConfig(),
    ...parsed,
    product: "AlphaFoundry",
    env: {
      ...defaultConfig().env,
      ...(parsed.env ?? {}),
    },
  };
}

export function writeConfig(config, options = {}) {
  const path = configPath(options);
  ensureParent(path);
  const sanitized = {
    ...config,
    product: "AlphaFoundry",
    env: { ...(config.env ?? {}) },
  };
  writeFileSync(path, `${JSON.stringify(sanitized, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { path, config: sanitized };
}

export function initConfig(options = {}) {
  const path = configPath(options);
  if (existsSync(path) && !options.force) {
    return { path, created: false, config: readConfig({ path }) };
  }
  const config = defaultConfig();
  writeConfig(config, { path });
  return { path, created: true, config };
}

export function getConfigValue(key, options = {}) {
  if (key === undefined || key === "") return readConfig(options);
  const config = readConfig(options);
  return key.split(".").reduce((value, part) => value?.[part], config);
}

export function setConfigValue(key, value, options = {}) {
  assertSupportedKey(key);
  assertSafeValue(key, value);
  const config = readConfig(options);
  const parts = key.split(".");
  let target = config;
  for (const part of parts.slice(0, -1)) {
    target[part] ??= {};
    target = target[part];
  }
  target[parts.at(-1)] = value;
  writeConfig(config, options);
  return { path: configPath(options), config };
}

export function configExists(options = {}) {
  return existsSync(configPath(options));
}
