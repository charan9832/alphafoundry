import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { parseSlashCommand, commandHelp } from "../src/tui/commands.js";
import { createInitialState, reducer } from "../src/tui/state.js";
import { initConfig, setConfigValue } from "../src/config.js";

function tempConfigPath() {
  const dir = mkdtempSync(join(tmpdir(), "af-tui-config-"));
  return { dir, path: join(dir, "config.json") };
}

test("TUI initial state uses AlphaFoundry config provider/model with explicit overrides winning", () => {
  const temp = tempConfigPath();
  const previous = process.env.ALPHAFOUNDRY_CONFIG_PATH;
  try {
    process.env.ALPHAFOUNDRY_CONFIG_PATH = temp.path;
    initConfig({ path: temp.path, nonInteractive: true });
    setConfigValue("provider", "openai", { path: temp.path });
    setConfigValue("model", "gpt-4o-mini", { path: temp.path });

    const configured = createInitialState({ cwd: "/tmp/alphafoundry" });
    assert.equal(configured.provider, "openai");
    assert.equal(configured.model, "gpt-4o-mini");

    const overridden = createInitialState({ cwd: "/tmp/alphafoundry", provider: "anthropic", model: "claude-test" });
    assert.equal(overridden.provider, "anthropic");
    assert.equal(overridden.model, "claude-test");
  } finally {
    if (previous === undefined) delete process.env.ALPHAFOUNDRY_CONFIG_PATH;
    else process.env.ALPHAFOUNDRY_CONFIG_PATH = previous;
    rmSync(temp.dir, { recursive: true, force: true });
  }
});

test("Ink slash command parser recognizes all supported commands without legacy TUI", () => {
  assert.deepEqual(parseSlashCommand("/help"), { type: "help" });
  assert.deepEqual(parseSlashCommand("/clear"), { type: "clear" });
  assert.deepEqual(parseSlashCommand("/exit"), { type: "exit" });
  assert.deepEqual(parseSlashCommand("/quit"), { type: "exit" });
  assert.deepEqual(parseSlashCommand("/stats"), { type: "stats" });
  assert.deepEqual(parseSlashCommand("/session"), { type: "session" });
  assert.deepEqual(parseSlashCommand("/new"), { type: "new" });
  assert.deepEqual(parseSlashCommand("/export"), { type: "export" });
  assert.deepEqual(parseSlashCommand("/tools read,write shell"), { type: "tools", tools: ["read", "write", "shell"] });
  assert.deepEqual(parseSlashCommand("/provider openrouter"), { type: "provider", provider: "openrouter" });
  assert.deepEqual(parseSlashCommand("/model openrouter/qwen3-coder"), { type: "model", provider: "openrouter", model: "qwen3-coder" });
  assert.deepEqual(parseSlashCommand("/model qwen3-coder"), { type: "model", model: "qwen3-coder" });
  assert.deepEqual(parseSlashCommand("normal prompt"), { type: "prompt", value: "normal prompt" });
  assert.deepEqual(parseSlashCommand("/unknown value"), { type: "unknown", command: "unknown", value: "value" });
});

test("command help documents every Ink slash command", () => {
  const help = commandHelp();
  for (const command of ["/help", "/clear", "/model", "/provider", "/exit", "/stats", "/tools", "/session", "/new", "/export"]) {
    assert.match(help, new RegExp(command.replace("/", "\\/")));
  }
});

test("command help is honest about local-only runtime command fallbacks", () => {
  const help = commandHelp();
  assert.match(help, /\/model <id>\s+set local model preference/i);
  assert.match(help, /\/provider <name>\s+set local provider preference/i);
  assert.match(help, /\/stats\s+show local TUI counters/i);
  assert.match(help, /\/tools <list>\s+set local tool preference/i);
  assert.match(help, /\/session\s+show local TUI session metadata/i);
  assert.match(help, /\/new\s+start a fresh local TUI session/i);
  assert.match(help, /\/export\s+print local transcript/i);
});

test("reducer applies slash command effects to TUI state", () => {
  const initial = createInitialState({
    cwd: "/tmp/alphafoundry",
    provider: "pi-agent",
    model: "pi-default",
    version: "1.0.0",
    backendVersion: "0.70.6",
  });

  const withHelp = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/help") });
  assert.equal(withHelp.view, "workspace");
  assert.equal(withHelp.events.at(-1).type, "assistant");
  assert.match(withHelp.events.at(-1).text, /\/model/);

  const withModel = reducer(withHelp, { type: "COMMAND", command: parseSlashCommand("/model openrouter/qwen3-coder") });
  assert.equal(withModel.provider, "openrouter");
  assert.equal(withModel.model, "qwen3-coder");
  assert.match(withModel.events.at(-1).text, /openrouter\/qwen3-coder/);
  assert.match(withModel.events.at(-1).text, /local preference/i);

  const withProvider = reducer(withModel, { type: "COMMAND", command: parseSlashCommand("/provider anthropic") });
  assert.equal(withProvider.provider, "anthropic");
  assert.equal(withProvider.model, "qwen3-coder");
  assert.match(withProvider.events.at(-1).text, /local preference/i);

  const withTools = reducer(withProvider, { type: "COMMAND", command: parseSlashCommand("/tools read write") });
  assert.deepEqual(withTools.tools, ["read", "write"]);
  assert.match(withTools.events.at(-1).text, /local tool preference/i);

  const cleared = reducer(withTools, { type: "COMMAND", command: parseSlashCommand("/clear") });
  assert.deepEqual(cleared.events, []);
});

test("runtime-sensitive slash commands do not overclaim backend effects", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });

  const withStats = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/stats") });
  assert.match(withStats.events.at(-1).text, /local TUI counters/i);
  assert.doesNotMatch(withStats.events.at(-1).text, /runtime statistics/i);

  const withSession = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/session") });
  assert.match(withSession.events.at(-1).text, /local TUI session/i);
  assert.doesNotMatch(withSession.events.at(-1).text, /backend session/i);

  const withNew = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/new") });
  assert.match(withNew.events.at(-1).text, /local TUI session/i);
  assert.match(withNew.events.at(-1).text, /backend session not changed/i);

  const withExport = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/export") });
  assert.match(withExport.events.at(-1).text, /Local transcript/i);
  assert.doesNotMatch(withExport.events.at(-1).text, /wrote|saved|exported to/i);
});

test("state supports runtime run lifecycle, cancellation, errors, stats, and sessions", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });
  assert.equal(initial.activeRun, null);
  assert.equal(initial.status, "idle");
  assert.match(initial.session.id, /^ses_/);

  const run = { id: "run_1", abort: () => {} };
  const running = reducer(initial, { type: "RUN_STARTED", prompt: "build", run });
  assert.equal(running.status, "running");
  assert.equal(running.activeRun, run);
  assert.equal(running.goal, "build");

  const cancelling = reducer(running, { type: "RUN_CANCELLING" });
  assert.equal(cancelling.status, "cancelling");
  assert.equal(cancelling.cancelling, true);

  const cancelled = reducer(cancelling, { type: "RUN_CANCELLED", reason: "escape" });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.activeRun, null);
  assert.equal(cancelled.cancelled, true);
  assert.match(cancelled.events.at(-1).text, /escape/);

  const errored = reducer(running, { type: "RUN_ERROR", error: new Error("boom") });
  assert.equal(errored.status, "error");
  assert.equal(errored.activeRun, null);
  assert.equal(errored.error, "boom");

  const withStats = reducer(initial, { type: "RUNTIME_EVENT", event: { type: "stats", tokens: 42, cost: "$0.01", percent: 7 } });
  assert.deepEqual(withStats.tokenUsage, { tokens: 42, cost: "$0.01", percent: 7 });
  assert.equal(withStats.events.at(-1).type, "stats");

  const withSession = reducer(initial, { type: "RUNTIME_EVENT", event: { type: "session", id: "ses_next", title: "Next" } });
  assert.equal(withSession.session.id, "ses_next");
  assert.equal(withSession.events.at(-1).type, "session");
});
