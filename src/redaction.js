const REDACTED_SECRET = "[REDACTED_SECRET]";
const REDACTED_ENV_VAR_NAME = "[REDACTED_ENV_VAR_NAME]";

function looksSensitiveKey(key = "") {
  return /api[_-]?key|token|secret|password|authorization|bearer/i.test(String(key));
}

function looksSecretValue(value = "") {
  return /sk-[A-Za-z0-9_-]+|github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|npm_[A-Za-z0-9]+|xox[baprs]-[A-Za-z0-9-]+|AIza[A-Za-z0-9_-]+|bearer\s+\S+|basic\s+\S+|\b[A-Za-z0-9+/]{32,}={0,2}\b/i.test(String(value));
}

export function redactText(value) {
  return String(value)
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@]+)@/gi, `$1${REDACTED_SECRET}:${REDACTED_SECRET}@`)
    .replace(/github_pat_[A-Za-z0-9_]+/gi, REDACTED_SECRET)
    .replace(/gh[pousr]_[A-Za-z0-9_]+/gi, REDACTED_SECRET)
    .replace(/npm_[A-Za-z0-9]+/gi, REDACTED_SECRET)
    .replace(/xox[baprs]-[A-Za-z0-9-]+/gi, REDACTED_SECRET)
    .replace(/AIza[A-Za-z0-9_-]+/gi, REDACTED_SECRET)
    .replace(/sk-[A-Za-z0-9_-]+/gi, REDACTED_SECRET)
    .replace(/(bearer|basic)\s+\S+/gi, `$1 ${REDACTED_SECRET}`)
    .replace(/(api[_-]?key|token|secret|password|authorization)(["'\s:=]+)([^"'\s,}]+)/gi, `$1$2${REDACTED_SECRET}`);
}

export function redactConfigValue(key, value) {
  if (key === "env" && value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).map((name) => [name, REDACTED_ENV_VAR_NAME]));
  }
  if (String(key).startsWith("env.")) return REDACTED_ENV_VAR_NAME;
  if (looksSensitiveKey(key)) return REDACTED_SECRET;
  if (typeof value === "string" && looksSecretValue(value)) return redactText(value);
  return value;
}

export function redactConfig(config) {
  if (!config || typeof config !== "object") return config;
  if (Array.isArray(config)) return config.map((item) => redactConfig(item));
  const redacted = {};
  for (const [key, value] of Object.entries(config)) {
    if (key === "env" && value && typeof value === "object" && !Array.isArray(value)) {
      redacted.env = Object.fromEntries(Object.keys(value).map((name) => [name, REDACTED_ENV_VAR_NAME]));
    } else if (value && typeof value === "object") {
      redacted[key] = redactConfig(value);
    } else {
      redacted[key] = redactConfigValue(key, value);
    }
  }
  return redacted;
}

export function redactUnknown(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactUnknown(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, looksSensitiveKey(key) ? REDACTED_SECRET : redactUnknown(item)]));
  }
  return value;
}
