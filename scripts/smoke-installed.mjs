#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = mkdtempSync(join(tmpdir(), "alphafoundry-pack-smoke-"));
const packDir = join(temp, "pack");
const installDir = join(temp, "install");
mkdirSync(packDir, { recursive: true });
mkdirSync(installDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    const details = [
      `$ ${command} ${args.join(" ")}`,
      `exit ${result.status}`,
      result.stdout ? `stdout:\n${result.stdout}` : "",
      result.stderr ? `stderr:\n${result.stderr}` : "",
      result.error ? `error:\n${result.error.message}` : "",
    ].filter(Boolean).join("\n");
    throw new Error(details);
  }
  return result;
}

function binPath(name) {
  const ext = process.platform === "win32" ? ".cmd" : "";
  return join(installDir, "node_modules", ".bin", `${name}${ext}`);
}

try {
  const pack = run("npm", ["pack", "--pack-destination", packDir, "--json"]);
  const parsed = JSON.parse(pack.stdout);
  const tarball = join(packDir, parsed[0].filename);

  run("npm", ["init", "-y"], { cwd: installDir });
  run("npm", ["install", tarball, "--no-audit", "--no-fund"], { cwd: installDir });

  const configPath = join(temp, "config.json");
  const env = { ALPHAFOUNDRY_CONFIG_PATH: configPath };
  const af = binPath("af");
  const alphafoundry = binPath("alphafoundry");

  run(af, ["--version"], { cwd: installDir, env });
  run(alphafoundry, ["--version"], { cwd: installDir, env });
  run(af, ["--help"], { cwd: installDir, env });
  run(af, ["init", "--non-interactive"], { cwd: installDir, env });
  run(af, ["config", "path"], { cwd: installDir, env });
  run(af, ["config", "set", "provider", "openai"], { cwd: installDir, env });
  run(af, ["config", "set", "model", "gpt-4o-mini"], { cwd: installDir, env });
  const doctor = run(af, ["doctor", "--json"], { cwd: installDir, env });
  const report = JSON.parse(doctor.stdout);
  if (report.product !== "AlphaFoundry") throw new Error("doctor JSON did not identify AlphaFoundry");
  const backend = report.checks.find((check) => check.name === "backend");
  if (!backend || backend.status === "fail") throw new Error(`backend doctor check failed: ${JSON.stringify(backend)}`);

  console.log(JSON.stringify({ ok: true, tarball, installDir, checks: report.checks.length }, null, 2));
} finally {
  if (!process.env.ALPHAFOUNDRY_KEEP_SMOKE_DIR) rmSync(temp, { recursive: true, force: true });
}
