import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import {
  defaultConfigPath,
  initConfig,
  readConfig,
  resolveRuntimeConfig,
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
  assert.equal(defaultConfigPath({ HOME: "/home/example" }), normalize("/home/example/.alphafoundry/config.json"));
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
    assert.throws(() => setConfigValue("apiKey", "raw-value", { path: temp.path }), /Unsupported config key/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("readConfig rejects unknown keys, wrong types, and raw secret env values", () => {
  const cases = [
    [{ provider: "openai", apiKey: "raw-value" }, /Unsupported config key: apiKey/],
    [{ provider: 42 }, /Config value for provider must be a non-empty string/],
    [{ env: { apiKey: "raw secret value" } }, /environment variable names only/],
    [{ env: { baseUrl: "https://example.invalid" } }, /environment variable names only/],
    [{ env: { token: "OPENAI_API_KEY" } }, /Unsupported config key: env.token/],
  ];

  for (const [config, message] of cases) {
    const temp = tempConfigPath();
    try {
      writeFileSync(temp.path, `${JSON.stringify(config)}\n`);
      assert.throws(() => readConfig({ path: temp.path }), message);
    } finally {
      rmSync(temp.dir, { recursive: true, force: true });
    }
  }
});

test("af config get redacts env values", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_CONFIG_PATH: temp.path };
    assert.equal(runCli(["config", "set", "env.apiKey", "OPENAI_API_KEY"], env).status, 0);
    const getKey = runCli(["config", "get", "env.apiKey"], env);
    assert.equal(getKey.status, 0, getKey.stderr);
    assert.equal(getKey.stdout.trim(), "[REDACTED_ENV_VAR_NAME]");

    const getAll = runCli(["config", "get", "env"], env);
    assert.equal(getAll.status, 0, getAll.stderr);
    assert.match(getAll.stdout, /\[REDACTED_ENV_VAR_NAME\]/);
    assert.doesNotMatch(getAll.stdout, /OPENAI_API_KEY/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("resolveRuntimeConfig reads provider/model and resolves env variable names without persisting secrets", () => {
  const temp = tempConfigPath();
  try {
    initConfig({ path: temp.path, nonInteractive: true });
    setConfigValue("provider", "openai", { path: temp.path });
    setConfigValue("model", "gpt-4o-mini", { path: temp.path });
    setConfigValue("env.apiKey", "OPENAI_KEY_ENV", { path: temp.path });
    setConfigValue("env.baseUrl", "OPENAI_BASE_URL", { path: temp.path });

    const runtime = resolveRuntimeConfig({}, {
      path: temp.path,
      env: { OPENAI_KEY_ENV: "test-value", OPENAI_BASE_URL: "https://example.invalid" },
    });

    assert.equal(runtime.provider, "openai");
    assert.equal(runtime.model, "gpt-4o-mini");
    assert.deepEqual(runtime.env, { OPENAI_KEY_ENV: "test-value", OPENAI_BASE_URL: "https://example.invalid" });
    assert.doesNotMatch(JSON.stringify(readConfig({ path: temp.path })), /test-value/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("resolveRuntimeConfig lets explicit runtime values override config", () => {
  const temp = tempConfigPath();
  try {
    initConfig({ path: temp.path, nonInteractive: true });
    setConfigValue("provider", "openai", { path: temp.path });
    setConfigValue("model", "gpt-4o-mini", { path: temp.path });

    const runtime = resolveRuntimeConfig({ provider: "anthropic", model: "claude-test" }, { path: temp.path, env: {} });
    assert.equal(runtime.provider, "anthropic");
    assert.equal(runtime.model, "claude-test");
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

test("doctor warns missing config with recovery guidance", () => {
  const temp = tempConfigPath();
  try {
    const report = runDoctor({ configPath: temp.path, cwd: process.cwd(), env: { ...process.env, ALPHAFOUNDRY_CONFIG_PATH: temp.path } });
    const configCheck = report.checks.find((check) => check.name === "config");
    assert.equal(configCheck.status, "warn");
    assert.match(configCheck.message, /not found/i);
    assert.match(configCheck.message, /af init --non-interactive/i);
    assert.match(JSON.stringify(configCheck.details), /af init --non-interactive/i);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("doctor reports invalid config as a failure and redacts secret-looking values", () => {
  const temp = tempConfigPath();
  try {
    writeFileSync(temp.path, `${JSON.stringify({ provider: "openai", env: { apiKey: "raw secret value" } })}\n`);
    const report = runDoctor({ configPath: temp.path, cwd: process.cwd(), env: { ...process.env, ALPHAFOUNDRY_CONFIG_PATH: temp.path } });
    const configCheck = report.checks.find((check) => check.name === "config");
    assert.equal(report.status, "fail");
    assert.equal(configCheck.status, "fail");
    assert.match(configCheck.message, /Invalid config/);
    assert.doesNotMatch(JSON.stringify(report), /raw secret value/);

    const cli = runCli(["doctor", "--json"], { ALPHAFOUNDRY_CONFIG_PATH: temp.path });
    assert.equal(cli.status, 1);
    assert.doesNotMatch(cli.stdout, /raw secret value/);
    const cliReport = JSON.parse(cli.stdout);
    assert.equal(cliReport.status, "fail");
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

test("af config repair removes unsupported legacy keys and preserves supported values", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_CONFIG_PATH: temp.path };
    writeFileSync(temp.path, `${JSON.stringify({
      product: "AlphaFoundry",
      version: 1,
      provider: "openai",
      model: "gpt-4o-mini",
      default_mode: "build",
      env: { apiKey: "OPENAI_API_KEY", baseUrl: "OPENAI_BASE_URL" },
    })}\n`);

    const before = runCli(["doctor", "--json"], env);
    assert.equal(before.status, 1);
    assert.match(before.stdout, /default_mode/);

    const repair = runCli(["config", "repair"], env);
    assert.equal(repair.status, 0, repair.stderr);
    assert.match(repair.stdout, /removed unsupported keys: default_mode/i);

    const repaired = readConfig({ path: temp.path });
    assert.equal(repaired.provider, "openai");
    assert.equal(repaired.model, "gpt-4o-mini");
    assert.equal(repaired.env.apiKey, "OPENAI_API_KEY");
    assert.equal(repaired.env.baseUrl, "OPENAI_BASE_URL");
    assert.equal(repaired.default_mode, undefined);

    const after = runCli(["doctor", "--json"], env);
    assert.equal(after.status, 0, after.stderr);
    assert.doesNotMatch(after.stdout, /default_mode/);
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
