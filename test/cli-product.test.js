import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultConfigPath,
  initConfig,
  readConfig,
  setConfigValue,
  getConfigValue,
} from "../src/config.js";
import { runDoctor } from "../src/doctor.js";

const cliPath = join(process.cwd(), "src", "cli.js");

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function tempConfigPath() {
  const dir = mkdtempSync(join(tmpdir(), "af-config-"));
  return { dir, path: join(dir, "config.json") };
}

test("defaultConfigPath uses ~/.alphafoundry/config.json unless overridden", () => {
  assert.match(defaultConfigPath({ HOME: "/home/example" }), /\/home\/example\/\.alphafoundry\/config\.json$/);
  assert.equal(defaultConfigPath({ ALPHAFOUNDRY_CONFIG_PATH: "/tmp/af.json" }), "/tmp/af.json");
});

test("initConfig creates AlphaFoundry config with provider/model/env var names and no raw secrets", () => {
  const temp = tempConfigPath();
  try {
    const result = initConfig({ path: temp.path, nonInteractive: true });
    assert.equal(result.created, true);
    const config = readConfig({ path: temp.path });
    assert.equal(config.product, "AlphaFoundry");
    assert.equal(config.provider, "default");
    assert.equal(config.model, "default");
    assert.deepEqual(config.env, { apiKey: "ALPHAFOUNDRY_API_KEY" });
    assert.doesNotMatch(JSON.stringify(config), /sk-|secret|token/i);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("setConfigValue and getConfigValue update whitelisted config keys", () => {
  const temp = tempConfigPath();
  try {
    initConfig({ path: temp.path, nonInteractive: true });
    setConfigValue("provider", "openai", { path: temp.path });
    setConfigValue("model", "gpt-4o-mini", { path: temp.path });
    setConfigValue("env.apiKey", "OPENAI_API_KEY", { path: temp.path });
    assert.equal(getConfigValue("provider", { path: temp.path }), "openai");
    assert.equal(getConfigValue("model", { path: temp.path }), "gpt-4o-mini");
    assert.equal(getConfigValue("env.apiKey", { path: temp.path }), "OPENAI_API_KEY");
    assert.throws(() => setConfigValue("apiKey", "sk-raw-secret", { path: temp.path }), /Unsupported config key/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("doctor reports package, node, backend, git, config, and tty checks", () => {
  const temp = tempConfigPath();
  try {
    const report = runDoctor({ configPath: temp.path, cwd: process.cwd(), env: { ...process.env, ALPHAFOUNDRY_CONFIG_PATH: temp.path } });
    const names = report.checks.map((check) => check.name);
    assert.equal(report.product, "AlphaFoundry");
    assert.ok(names.includes("package"));
    assert.ok(names.includes("node"));
    assert.ok(names.includes("backend"));
    assert.ok(names.includes("git"));
    assert.ok(names.includes("config"));
    assert.ok(names.includes("tty"));
    assert.ok(["pass", "warn", "fail"].includes(report.status));
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("af init --non-interactive creates config at ALPHAFOUNDRY_CONFIG_PATH", () => {
  const temp = tempConfigPath();
  try {
    const result = runCli(["init", "--non-interactive"], { ALPHAFOUNDRY_CONFIG_PATH: temp.path });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AlphaFoundry config/);
    const config = readConfig({ path: temp.path });
    assert.equal(config.product, "AlphaFoundry");
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("af config path|get|set manage native config", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_CONFIG_PATH: temp.path };
    assert.equal(runCli(["config", "path"], env).stdout.trim(), temp.path);
    assert.equal(runCli(["config", "set", "provider", "anthropic"], env).status, 0);
    const get = runCli(["config", "get", "provider"], env);
    assert.equal(get.status, 0, get.stderr);
    assert.equal(get.stdout.trim(), "anthropic");
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("af doctor --json emits parseable doctor JSON", () => {
  const temp = tempConfigPath();
  try {
    const result = runCli(["doctor", "--json"], { ALPHAFOUNDRY_CONFIG_PATH: temp.path });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.product, "AlphaFoundry");
    assert.ok(Array.isArray(report.checks));
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("af models and af session are native informational commands", () => {
  const models = runCli(["models"]);
  assert.equal(models.status, 0, models.stderr);
  assert.match(models.stdout, /delegated/i);

  const session = runCli(["session"]);
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /session/i);
});

test("help presents AlphaFoundry native command surface before passthrough", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /af init/);
  assert.match(result.stdout, /af doctor/);
  assert.match(result.stdout, /af config path/);
  assert.match(result.stdout, /af models/);
  assert.match(result.stdout, /af session/);
});
