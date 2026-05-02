import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const SUPPORTED_KEYS = new Set(["provider", "model", "env.apiKey", "env.baseUrl"]);
const INTERNAL_KEYS = new Set(["product", "version", ...SUPPORTED_KEYS]);
const DEFAULT_RUNTIME_PROVIDER = "default";
const DEFAULT_RUNTIME_MODEL = "default";
const envFileCache = new Map();

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

export function defaultSecretsPath(env = process.env, options = {}) {
  if (env.ALPHAFOUNDRY_ENV_PATH) return env.ALPHAFOUNDRY_ENV_PATH;
  if (options.configPath) return join(dirname(options.configPath), ".env");
  return join(dirname(defaultConfigPath(env)), ".env");
}

export function parseEnvFile(content = "") {
  const parsed = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value.replace(/\\n/g, "\n");
  }
  return parsed;
}

function quoteEnvValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

export function readLocalEnv(options = {}) {
  const path = options.path ?? defaultSecretsPath(options.env ?? process.env, { configPath: options.configPath });
  try {
    const stats = statSync(path);
    const cached = envFileCache.get(path);
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      return { path, env: { ...cached.env } };
    }
    const env = parseEnvFile(readFileSync(path, "utf8"));
    envFileCache.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, env });
    return { path, env: { ...env } };
  } catch {
    return { path, env: {} };
  }
}

export function writeLocalEnv(values, options = {}) {
  const path = options.path ?? defaultSecretsPath(options.env ?? process.env, { configPath: options.configPath });
  ensureParent(path);
  const existing = options.merge === false ? {} : readLocalEnv({ path }).env;
  const next = { ...existing };
  for (const [key, value] of Object.entries(values ?? {})) {
    if (!isEnvVarName(key)) throw new Error(`Invalid environment variable name: ${key}`);
    if (typeof value !== "string" || value.length === 0) throw new Error(`Secret value for ${key} must be non-empty`);
    next[key] = value;
  }
  const lines = [
    "# AlphaFoundry local provider secrets. Do not commit this file.",
    ...Object.entries(next).map(([key, value]) => `${key}=${quoteEnvValue(value)}`),
    "",
  ];
  if (existsSync(path)) chmodSync(path, 0o600);
  writeFileSync(path, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
  envFileCache.delete(path);
  return { path, env: next };
}

export function mergeLocalEnv(env = process.env, options = {}) {
  const local = readLocalEnv({ env, configPath: options.configPath, path: options.path });
  return { ...local.env, ...env };
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

function pruneUnsupportedKeys(config) {
  const removed = [];
  const pruned = {};
  for (const [key, value] of Object.entries(config ?? {})) {
    if (key === "env" && value && typeof value === "object" && !Array.isArray(value)) {
      const env = {};
      for (const [envKey, envValue] of Object.entries(value)) {
        const path = `env.${envKey}`;
        if (INTERNAL_KEYS.has(path)) env[envKey] = envValue;
        else removed.push(path);
      }
      if (Object.keys(env).length > 0) pruned.env = env;
    } else if (INTERNAL_KEYS.has(key)) {
      pruned[key] = value;
    } else {
      removed.push(key);
    }
  }
  return { pruned, removed };
}

export function repairConfig(options = {}) {
  const path = configPath(options);
  if (!existsSync(path)) {
    const result = initConfig({ ...options, path, nonInteractive: true });
    return { ...result, repaired: true, removed: [], created: true };
  }
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const { pruned, removed } = pruneUnsupportedKeys(parsed);
  const result = writeConfig({ ...defaultConfig(), ...pruned, env: { ...defaultConfig().env, ...(pruned.env ?? {}) } }, { ...options, path });
  return { ...result, repaired: removed.length > 0, removed, created: false };
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
  const rawEnv = options.env ?? process.env;
  const configPathValue = options.path ?? defaultConfigPath(rawEnv);
  const env = mergeLocalEnv(rawEnv, { configPath: configPathValue, path: options.envPath });
  const config = readConfig({ ...options, path: configPathValue, env });
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
