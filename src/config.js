import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const SUPPORTED_KEYS = new Set(["provider", "model", "env.apiKey", "env.baseUrl"]);
const INTERNAL_KEYS = new Set(["product", "version", ...SUPPORTED_KEYS]);
const DEFAULT_RUNTIME_PROVIDER = "default";
const DEFAULT_RUNTIME_MODEL = "default";

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
  if (key.startsWith("env.")) {
    if (!isEnvVarName(value)) {
      throw new Error("AlphaFoundry config stores environment variable names only, not raw secrets");
    }
    return;
  }
  if (/sk-|secret|token|password|bearer\s+/i.test(value) && !isEnvVarName(value)) {
    throw new Error("AlphaFoundry config stores environment variable names only, not raw secrets");
  }
}

function flattenConfigKeys(config, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(config ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) keys.push(...flattenConfigKeys(value, path));
    else keys.push(path);
  }
  return keys;
}

export function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("AlphaFoundry config must be a JSON object");
  }
  for (const key of flattenConfigKeys(config)) {
    if (!INTERNAL_KEYS.has(key)) throw new Error(`Unsupported config key: ${key}`);
  }
  if (config.product !== undefined && config.product !== "AlphaFoundry") {
    throw new Error("Config product must be AlphaFoundry");
  }
  if (config.version !== undefined && config.version !== 1) {
    throw new Error("Config version must be 1");
  }
  for (const key of SUPPORTED_KEYS) {
    const value = key.split(".").reduce((current, part) => current?.[part], config);
    if (value !== undefined) assertSafeValue(key, value);
  }
  return config;
}

export function readConfig(options = {}) {
  const path = configPath(options);
  if (!existsSync(path)) return defaultConfig();
  const parsed = validateConfig(JSON.parse(readFileSync(path, "utf8")));
  const merged = {
    ...defaultConfig(),
    ...parsed,
    product: "AlphaFoundry",
    env: {
      ...defaultConfig().env,
      ...(parsed.env ?? {}),
    },
  };
  return validateConfig(merged);
}

export function writeConfig(config, options = {}) {
  const path = configPath(options);
  ensureParent(path);
  const sanitized = validateConfig({
    ...config,
    product: "AlphaFoundry",
    env: { ...(config.env ?? {}) },
  });
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

function valueOrDefault(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function envFromConfig(config, env) {
  const resolved = {};
  for (const name of [config.env?.apiKey, config.env?.baseUrl]) {
    if (typeof name === "string" && isEnvVarName(name) && env[name] !== undefined) {
      resolved[name] = env[name];
    }
  }
  return resolved;
}

export function resolveRuntimeConfig(overrides = {}, options = {}) {
  const env = options.env ?? process.env;
  const config = readConfig({ ...options, env });
  const provider = valueOrDefault(overrides.provider, valueOrDefault(config.provider, DEFAULT_RUNTIME_PROVIDER));
  const model = valueOrDefault(overrides.model, valueOrDefault(config.model, DEFAULT_RUNTIME_MODEL));
  return {
    provider,
    model,
    env: {
      ...envFromConfig(config, env),
      ...(overrides.env ?? {}),
    },
    config,
  };
}
