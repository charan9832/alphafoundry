import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { configExists, defaultConfigPath, readConfig } from "./config.js";
import { resolvePiPackageJsonPath } from "./dependencies.js";
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

export function runDoctor(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const pkg = readPackageJson();
  const path = options.configPath ?? defaultConfigPath(env);
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
    } catch (error) {
      checks.push(
        check("fail", "config", `Invalid config at ${path}: ${redactText(error instanceof Error ? error.message : String(error))}`, { path }),
      );
    }
  } else {
    checks.push(check("warn", "config", `Config file not found at ${path}`, { path }));
  }

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
