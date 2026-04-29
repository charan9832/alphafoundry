import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRuntimeConfig } from "../config.js";

export function packageRoot() {
  return dirname(dirname(dirname(fileURLToPath(import.meta.url))));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function maybeGit(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function detectRuntime(overrides = {}) {
  const root = overrides.cwd ?? packageRoot();
  const packagePath = join(root, "package.json");
  const packageInfo = existsSync(packagePath) ? readJson(packagePath) : { name: "alphafoundry", version: "0.0.0" };
  const backendPackagePath = join(root, "node_modules", "@mariozechner", "pi-coding-agent", "package.json");
  const backendInfo = existsSync(backendPackagePath) ? readJson(backendPackagePath) : { name: "@mariozechner/pi-coding-agent", version: "not installed" };
  const gitBranch = maybeGit(["branch", "--show-current"], root) || "no git";
  const gitStatus = maybeGit(["status", "--short"], root);
  const configRuntime = resolveRuntimeConfig({}, { env: process.env });
  const provider = process.env.ALPHAFOUNDRY_PROVIDER ?? process.env.AF_PROVIDER ?? process.env.PI_PROVIDER ?? configRuntime.provider ?? "default";
  const model = process.env.ALPHAFOUNDRY_MODEL ?? process.env.AF_MODEL ?? process.env.PI_MODEL ?? configRuntime.model ?? "default";

  return {
    product: "AlphaFoundry",
    packageName: overrides.packageName ?? packageInfo.name,
    version: overrides.version ?? packageInfo.version,
    cwd: root,
    provider: overrides.provider ?? provider,
    model: overrides.model ?? model,
    runtime: {
      nodeVersion: overrides.nodeVersion ?? overrides.runtime?.nodeVersion ?? process.version,
      backendPackage: overrides.backendPackage ?? overrides.runtime?.backendPackage ?? backendInfo.name,
      backendVersion: overrides.backendVersion ?? overrides.runtime?.backendVersion ?? backendInfo.version,
    },
    project: {
      gitBranch: overrides.gitBranch ?? overrides.project?.gitBranch ?? gitBranch,
      gitDirty: overrides.gitDirty ?? overrides.project?.gitDirty ?? Boolean(gitStatus),
    },
    lsp: overrides.lsp ?? [],
  };
}
