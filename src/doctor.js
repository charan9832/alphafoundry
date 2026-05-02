import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { configExists, defaultConfigPath, defaultSecretsPath, mergeLocalEnv, readConfig } from "./config.js";
import { resolvePiPackageJsonPath } from "./dependencies.js";
import { providerDefaults, knownProviderNames } from "./provider-defaults.js";
import { redactConfig, redactText } from "./redaction.js";

function packageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function readPackageJson() {
  return JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8"));
}

function parseNodeMajor(version = process.version) {
  return Number(version.replace(/^v/, "").split(".")[0]);
}

function check(status, name, message, details = {}) {
  return { status, name, message, details };
}

function gitInfo(cwd) {
  const branch = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8" });
  if (branch.status !== 0) {
    return check("warn", "git", "Git information unavailable", { error: branch.stderr.trim() || branch.error?.message });
  }
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" });
  return check("pass", "git", `Git branch ${branch.stdout.trim()}`, {
    branch: branch.stdout.trim(),
    dirty: Boolean(dirty.stdout.trim()),
  });
}

function envResolutionInfo(config, env) {
  const provider = String(config.provider ?? "default").toLowerCase();
  const defaults = providerDefaults(provider);
  const knownProvider = knownProviderNames().includes(provider);
  const required = [config.env?.apiKey, config.env?.baseUrl].filter(Boolean);
  const recommendation = knownProvider
    ? {
      provider,
      apiKey: defaults.apiKey,
      ...(defaults.baseUrl ? { baseUrl: defaults.baseUrl } : {}),
    }
    : { provider, apiKey: defaults.apiKey };

  if (required.length === 0) {
    const message = knownProvider
      ? `No provider environment variables configured; ${provider} normally uses ${defaults.apiKey}`
      : "No provider environment variables configured";
    return check(knownProvider ? "warn" : "pass", "env", message, { required: [], missing: [], recommendation });
  }

  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    const recommendedText = knownProvider ? ` Provider ${provider} normally uses ${defaults.apiKey}.` : "";
    return check("warn", "env", `Missing configured environment variables: ${missing.join(", ")}; export them before runtime use.${recommendedText}`, {
      required,
      missing,
      recommendation,
      recovery: "export the listed environment variables before running AlphaFoundry",
    });
  }

  const configuredText = knownProvider ? `; provider ${provider} recommended API key env is ${defaults.apiKey}` : "";
  return check("pass", "env", `Configured environment variables are present${configuredText}`, {
    required,
    missing: [],
    recommendation,
  });
}

function secretsCheck(configPath, env) {
  const secretsPath = defaultSecretsPath(env, { configPath });
  if (!existsSync(secretsPath)) {
    return check("pass", "secrets", "No local env file; using shell environment variables only", { path: secretsPath });
  }
  try {
    const stats = statSync(secretsPath);
    const mode = stats.mode & 0o777;
    if (process.platform === "win32") {
      return check("pass", "secrets", `Local env file ${secretsPath} exists; POSIX mode checks are not enforced on Windows`, { path: secretsPath, mode, platform: process.platform });
    }
    const accessibleByOthers = (mode & 0o077) !== 0;
    if (accessibleByOthers) {
      return check("warn", "secrets", `Local env file ${secretsPath} is accessible by group/other users (mode ${mode.toString(8)}); run chmod 600 ${secretsPath}`, { path: secretsPath, mode, expected: 0o600 });
    }
    return check("pass", "secrets", `Local env file ${secretsPath} is secure (mode ${mode.toString(8)})`, { path: secretsPath, mode });
  } catch (error) {
    return check("warn", "secrets", `Could not read local env file ${secretsPath}: ${error.message}`, { path: secretsPath });
  }
}

export function runDoctor(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const rawEnv = options.env ?? process.env;
  const path = options.configPath ?? defaultConfigPath(rawEnv);
  const env = mergeLocalEnv(rawEnv, { configPath: path, path: options.envPath });
  const pkg = readPackageJson();
  let backendPath = "";
  try {
    backendPath = resolvePiPackageJsonPath();
  } catch {
    backendPath = "";
  }
  const checks = [];

  checks.push(check("pass", "package", `${pkg.name} ${pkg.version}`, { name: pkg.name, version: pkg.version }));

  const nodeMajor = parseNodeMajor(process.version);
  checks.push(
    check(nodeMajor >= 20 ? "pass" : "fail", "node", `Node ${process.version}`, {
      version: process.version,
      required: pkg.engines?.node ?? ">=20.6.0",
    }),
  );

  if (existsSync(backendPath)) {
    const backend = JSON.parse(readFileSync(backendPath, "utf8"));
    checks.push(check("pass", "backend", `${backend.name} ${backend.version}`, { name: backend.name, version: backend.version }));
  } else {
    checks.push(check("fail", "backend", "Backend package @mariozechner/pi-coding-agent is not installed", { package: "@mariozechner/pi-coding-agent" }));
  }

  checks.push(gitInfo(cwd));

  if (configExists({ path })) {
    try {
      const config = readConfig({ path });
      checks.push(
        check("pass", "config", `Config file found at ${path}`, { path, provider: config.provider, model: config.model, config: redactConfig(config) }),
      );
      checks.push(envResolutionInfo(config, env));
    } catch (error) {
      checks.push(
        check("fail", "config", `Invalid config at ${path}: ${redactText(error instanceof Error ? error.message : String(error))}`, { path }),
      );
    }
  } else {
    checks.push(
      check("warn", "config", `Config file not found at ${path}; recover with af init --non-interactive`, {
        path,
        recovery: "af init --non-interactive",
      }),
    );
  }

  checks.push(secretsCheck(path, rawEnv));

  checks.push(
    check(process.stdout.isTTY ? "pass" : "warn", "tty", process.stdout.isTTY ? "TTY output available" : "TTY output not detected", {
      stdin: Boolean(process.stdin.isTTY),
      stdout: Boolean(process.stdout.isTTY),
      columns: process.stdout.columns ?? null,
      rows: process.stdout.rows ?? null,
    }),
  );

  const status = checks.some((item) => item.status === "fail") ? "fail" : checks.some((item) => item.status === "warn") ? "warn" : "pass";
  return {
    product: "AlphaFoundry",
    status,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

export function formatDoctor(report) {
  const lines = [`AlphaFoundry doctor: ${report.status.toUpperCase()}`];
  for (const item of report.checks) {
    lines.push(`${item.status.toUpperCase().padEnd(4)} ${item.name}: ${item.message}`);
  }
  return lines.join("\n");
}
