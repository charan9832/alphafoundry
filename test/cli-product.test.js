import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { createApprovalStore } from "../src/runtime/approval-store.js";
import { createSessionStore } from "../src/runtime/session-store.js";
import { createRuntimeEvent } from "../src/runtime/events.js";
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

test("doctor reports configured env var names as warn when unresolved and pass when present", () => {
  const temp = tempConfigPath();
  try {
    initConfig({ path: temp.path, nonInteractive: true });
    setConfigValue("env.apiKey", "AF_TEST_API_KEY", { path: temp.path });
    setConfigValue("env.baseUrl", "AF_TEST_BASE_URL", { path: temp.path });

    const missingReport = runDoctor({ configPath: temp.path, cwd: process.cwd(), env: { ALPHAFOUNDRY_CONFIG_PATH: temp.path } });
    const missingEnv = missingReport.checks.find((check) => check.name === "env");
    assert.equal(missingEnv.status, "warn");
    assert.deepEqual(missingEnv.details.missing, ["AF_TEST_API_KEY", "AF_TEST_BASE_URL"]);
    assert.match(missingEnv.message, /AF_TEST_API_KEY/);
    assert.doesNotMatch(JSON.stringify(missingEnv), /secret-value/);

    const presentReport = runDoctor({
      configPath: temp.path,
      cwd: process.cwd(),
      env: { ALPHAFOUNDRY_CONFIG_PATH: temp.path, AF_TEST_API_KEY: "secret-value", AF_TEST_BASE_URL: "https://example.invalid" },
    });
    const presentEnv = presentReport.checks.find((check) => check.name === "env");
    assert.equal(presentEnv.status, "pass");
    assert.deepEqual(presentEnv.details.missing, []);
    assert.doesNotMatch(JSON.stringify(presentEnv), /secret-value|https:\/\/example\.invalid/);
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

test("af models, af tool-packs, and af session are native informational commands", () => {
  const models = runCli(["models"]);
  assert.equal(models.status, 0, models.stderr);
  assert.match(models.stdout, /delegated/i);

  const toolPacks = runCli(["tool-packs"]);
  assert.equal(toolPacks.status, 0, toolPacks.stderr);
  assert.match(toolPacks.stdout, /Default optional packs: none enabled/);
  assert.match(toolPacks.stdout, /domain packs are gated/i);

  const toolPacksJson = runCli(["tool-packs", "--json"]);
  assert.equal(toolPacksJson.status, 0, toolPacksJson.stderr);
  const toolPacksPayload = JSON.parse(toolPacksJson.stdout);
  assert.equal(toolPacksPayload.product, "AlphaFoundry");
  assert.equal(toolPacksPayload.registry.registeredCount, 0);
  assert.deepEqual(toolPacksPayload.enablement.enabled, []);
  assert.equal(toolPacksPayload.boundary.optionalPacksEnabledByDefault, false);
  assert.equal(toolPacksPayload.boundary.domainPacksGated, true);
  assert.equal(toolPacksPayload.boundary.executablePacksAvailable, false);

  const session = runCli(["session"]);
  assert.equal(session.status, 0, session.stderr);
  assert.match(session.stdout, /session/i);
});

test("af sessions list is real and machine-readable for an empty session store", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_HOME: temp.dir };
    const result = runCli(["sessions", "list", "--json"], env);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.deepEqual(payload.sessions, []);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("one-shot prompt CLI flags are not public commands", () => {
  const prompt = runCli(["-p", "hello"]);
  assert.notEqual(prompt.status, 0);
  assert.match(prompt.stderr, /Unknown AlphaFoundry command: -p/);
  assert.match(prompt.stderr, /Use af to open the app/);

  const promptLong = runCli(["--prompt", "hello"]);
  assert.notEqual(promptLong.status, 0);
  assert.match(promptLong.stderr, /Unknown AlphaFoundry command: --prompt/);

  const providerPrompt = runCli(["--provider", "openai", "--model", "gpt-4o-mini", "-p", "hello"]);
  assert.notEqual(providerPrompt.status, 0);
  assert.match(providerPrompt.stderr, /Unknown AlphaFoundry command: --provider/);
});

test("af sessions replay and eval expose deterministic local summaries", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_HOME: temp.dir };
    const store = createSessionStore({ env });
    const manifest = store.createSession({ adapter: "test", title: "Replay fixture", cwd: process.cwd() });
    const runId = "run_cli_fixture";
    store.appendEvent(manifest.id, createRuntimeEvent("run_start", { sessionId: manifest.id, runId, payload: { provider: "test", model: "test" } }));
    store.appendEvent(manifest.id, createRuntimeEvent("user", { sessionId: manifest.id, runId, payload: { text: "hello replay" } }));
    store.appendEvent(manifest.id, createRuntimeEvent("assistant", { sessionId: manifest.id, runId, payload: { text: "hello back" } }));
    store.appendEvent(manifest.id, createRuntimeEvent("run_end", { sessionId: manifest.id, runId, payload: { ok: true } }));

    const replay = runCli(["sessions", "replay", manifest.id, "--json"], env);
    assert.equal(replay.status, 0, replay.stderr);
    const replayPayload = JSON.parse(replay.stdout);
    assert.equal(replayPayload.sessionId, manifest.id);
    assert.ok(replayPayload.eventTotal >= 4);
    assert.ok(replayPayload.assistant.textDigest.startsWith("sha256:"));
    assert.doesNotMatch(replay.stdout, /sk-tes/);

    const replayText = runCli(["sessions", "replay", manifest.id], env);
    assert.equal(replayText.status, 0, replayText.stderr);
    assert.match(replayText.stdout, /Replay ses_/);
    assert.match(replayText.stdout, /Events:/);

    const evaluation = runCli(["sessions", "eval", manifest.id, "--json"], env);
    assert.equal(evaluation.status, 0, evaluation.stderr);
    const evalPayload = JSON.parse(evaluation.stdout);
    assert.equal(evalPayload.sessionId, manifest.id);
    assert.ok(["PASS", "WARN", "FAIL"].includes(evalPayload.overall));
    assert.ok(evalPayload.checks.some((check) => check.name === "hasEvents"));

    const evalText = runCli(["sessions", "eval", manifest.id], env);
    assert.equal(evalText.status, 0, evalText.stderr);
    assert.match(evalText.stdout, /Eval ses_/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("af approvals commands list show export and expire redacted decisions", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_HOME: temp.dir };
    const empty = runCli(["approvals", "list"], env);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /No AlphaFoundry approval decisions/);

    const store = createApprovalStore({ env });
    const decision = store.create({
      id: "apr_cli_test",
      status: "ask",
      toolName: "write_file",
      risk: "write",
      sessionId: "ses_cli",
      runId: "run_cli",
      reason: "token=sk-tes...7890",
      metadata: { apiKey: "sk-tes...7890" },
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const listed = runCli(["approvals", "list", "--json"], env);
    assert.equal(listed.status, 0, listed.stderr);
    assert.doesNotMatch(listed.stdout, /sk-tes/);
    const listPayload = JSON.parse(listed.stdout);
    assert.equal(listPayload.decisions.length, 1);
    assert.equal(listPayload.decisions[0].decisionId, decision.decisionId);

    const shown = runCli(["approvals", "show", decision.decisionId, "--json"], env);
    assert.equal(shown.status, 0, shown.stderr);
    assert.doesNotMatch(shown.stdout, /sk-tes/);
    const showPayload = JSON.parse(shown.stdout);
    assert.equal(showPayload.status, "ask");
    assert.equal(showPayload.reason, "token=[REDACTED_SECRET]");

    const exported = runCli(["approvals", "export", "--ndjson"], env);
    assert.equal(exported.status, 0, exported.stderr);
    assert.ok(exported.stdout.trim().split("\n").every((line) => JSON.parse(line).schemaVersion === 1));
    assert.doesNotMatch(exported.stdout, /sk-tes/);

    const expired = runCli(["approvals", "expire", decision.decisionId, "--json"], env);
    assert.equal(expired.status, 0, expired.stderr);
    const expiredPayload = JSON.parse(expired.stdout);
    assert.equal(expiredPayload.status, "expired");
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("af approvals and replay commands provide recovery guidance for missing ids", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_HOME: temp.dir };
    const approval = runCli(["approvals", "show", "missing-approval"], env);
    assert.notEqual(approval.status, 0);
    assert.match(approval.stderr, /Unknown approval decision/);
    assert.match(approval.stderr, /Recovery: run 'af approvals list'/);

    const replay = runCli(["sessions", "replay", "missing-session"], env);
    assert.notEqual(replay.status, 0);
    assert.match(replay.stderr, /Unknown AlphaFoundry session: missing-session/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("help presents AlphaFoundry app command surface without one-shot prompt flags", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /af init/);
  assert.match(result.stdout, /af doctor/);
  assert.match(result.stdout, /af config path/);
  assert.match(result.stdout, /af models/);
  assert.match(result.stdout, /af tool-packs/);
  assert.match(result.stdout, /af session/);
  assert.match(result.stdout, /af sessions list/);
  assert.match(result.stdout, /af sessions replay <id>/);
  assert.match(result.stdout, /af sessions eval <id>/);
  assert.match(result.stdout, /af approvals list/);
  assert.doesNotMatch(result.stdout, /af run/);
  assert.doesNotMatch(result.stdout, /af -p/);
  assert.doesNotMatch(result.stdout, /--prompt/);
  assert.doesNotMatch(result.stdout, /--tools code-edit/);
});

test("af --version and af -v print the exact package version", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const version = packageJson.version;

  const resultLong = runCli(["--version"]);
  assert.equal(resultLong.status, 0, resultLong.stderr);
  assert.equal(resultLong.stdout.trim(), version);

  const resultShort = runCli(["-v"]);
  assert.equal(resultShort.status, 0, resultShort.stderr);
  assert.equal(resultShort.stdout.trim(), version);
});

test("af run is not a public command", () => {
  const result = runCli(["run"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown AlphaFoundry command: run/);
  assert.match(result.stderr, /Use af to open the app/);
});

test("af sessions show/export missing id exit non-zero with clear error", () => {
  const temp = tempConfigPath();
  try {
    const env = { ALPHAFOUNDRY_HOME: temp.dir };
    const shown = runCli(["sessions", "show", "missing-session"], env);
    assert.notEqual(shown.status, 0);
    assert.match(shown.stderr, /Unknown AlphaFoundry session: missing-session/);

    const exported = runCli(["sessions", "export", "missing-session", "--json"], env);
    assert.notEqual(exported.status, 0);
    assert.match(exported.stderr, /Unknown AlphaFoundry session: missing-session/);
  } finally {
    rmSync(temp.dir, { recursive: true, force: true });
  }
});
