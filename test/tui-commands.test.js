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
  assert.deepEqual(parseSlashCommand("/approve-tools"), { type: "approve-tools" });
  assert.deepEqual(parseSlashCommand("/mode act"), { type: "mode", mode: "act" });
  assert.deepEqual(parseSlashCommand("/provider openrouter"), { type: "provider", provider: "openrouter" });
  assert.deepEqual(parseSlashCommand("/model openrouter/qwen3-coder"), { type: "model", provider: "openrouter", model: "qwen3-coder" });
  assert.deepEqual(parseSlashCommand("/model qwen3-coder"), { type: "model", model: "qwen3-coder" });
  assert.deepEqual(parseSlashCommand("normal prompt"), { type: "prompt", value: "normal prompt" });
  assert.deepEqual(parseSlashCommand("/unknown value"), { type: "unknown", command: "unknown", value: "value" });
});

test("command help documents every Ink slash command", () => {
  const help = commandHelp();
  for (const command of ["/help", "/clear", "/model", "/provider", "/exit", "/stats", "/tools", "/approve-tools", "/mode", "/session", "/new", "/export"]) {
    assert.match(help, new RegExp(command.replace("/", "\\/")));
  }
});

test("command help is honest about local-only runtime command fallbacks", () => {
  const help = commandHelp();
  assert.match(help, /\/model <id>\s+set local model preference/i);
  assert.match(help, /\/provider <name>\s+set local provider preference/i);
  assert.match(help, /\/stats\s+show local TUI counters/i);
  assert.match(help, /\/tools <list>\s+request runtime tools/i);
  assert.match(help, /\/approve-tools\s+approve pending tool request/i);
  assert.match(help, /\/mode <mode>\s+set tool permission mode/i);
  assert.match(help, /\/session\s+show durable session metadata/i);
  assert.match(help, /\/new\s+start a fresh durable session/i);
  assert.match(help, /\/export\s+print visible transcript/i);
});

test("command help documents keyboard hints without one-shot prompt flags", () => {
  const help = commandHelp();
  assert.match(help, /Keys:/);
  assert.match(help, /Enter\s+submit prompt/i);
  assert.match(help, /↑\/↓\s+recall prompt history/i);
  assert.match(help, /Esc or Ctrl\+C\s+cancel/i);
  assert.match(help, /multiline/i);
  assert.doesNotMatch(help, /af run/);
  assert.doesNotMatch(help, /\s-p\b|--prompt/);
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

  const withTools = reducer(withProvider, { type: "COMMAND", command: parseSlashCommand("/tools read grep") });
  assert.deepEqual(withTools.tools, ["read", "grep"]);
  assert.equal(withTools.pendingToolApproval, null);
  assert.match(withTools.events.at(-1).text, /runtime tools enabled/i);

  const withWriteTools = reducer(withProvider, { type: "COMMAND", command: parseSlashCommand("/tools write") });
  assert.deepEqual(withWriteTools.tools, []);
  assert.deepEqual(withWriteTools.pendingToolApproval.tools, ["write"]);
  assert.match(withWriteTools.events.at(-1).text, /requires approval/i);

  const approvedTools = reducer(withWriteTools, { type: "COMMAND", command: parseSlashCommand("/approve-tools") });
  assert.deepEqual(approvedTools.tools, ["write"]);
  assert.equal(approvedTools.pendingToolApproval, null);
  assert.match(approvedTools.events.at(-1).text, /approved runtime tools/i);

  const withMode = reducer(approvedTools, { type: "COMMAND", command: parseSlashCommand("/mode plan") });
  assert.equal(withMode.permissionMode, "plan");

  const cleared = reducer(withTools, { type: "COMMAND", command: parseSlashCommand("/clear") });
  assert.deepEqual(cleared.events, []);
});

test("runtime-sensitive slash commands do not overclaim backend effects", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });

  const withStats = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/stats") });
  assert.equal(initial.permissionMode, "ask");
  assert.equal(initial.pendingToolApproval, null);
  assert.match(withStats.events.at(-1).text, /local TUI counters/i);
  assert.doesNotMatch(withStats.events.at(-1).text, /runtime statistics/i);

  const withSession = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/session") });
  assert.match(withSession.events.at(-1).text, /durable session/i);
  assert.doesNotMatch(withSession.events.at(-1).text, /backend session/i);

  const withNew = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/new") });
  assert.match(withNew.events.at(-1).text, /started durable session/i);
  assert.doesNotMatch(withNew.events.at(-1).text, /backend session not changed/i);

  const withExport = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/export") });
  assert.match(withExport.events.at(-1).text, /Visible transcript/i)
  assert.doesNotMatch(withExport.events.at(-1).text, /wrote|saved|exported to/i);
});

test("/export redacts runtime and tool transcript text", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });
  const apiSecret = "sk-" + "live-secret";
  const bearerSecret = "Bearer " + "abc123";
  const withAssistantSecret = reducer(initial, { type: "RUNTIME_EVENT", event: { type: "assistant", text: `token=${apiSecret}` } });
  const withToolSecret = reducer(withAssistantSecret, { type: "RUNTIME_EVENT", event: { type: "tool", name: "shell", text: `Authorization: ${bearerSecret}` } });
  const exported = reducer(withToolSecret, { type: "COMMAND", command: parseSlashCommand("/export") });

  assert.match(exported.events.at(-1).text, /Visible transcript/i);
  assert.doesNotMatch(exported.events.at(-1).text, new RegExp(apiSecret));
  assert.doesNotMatch(exported.events.at(-1).text, new RegExp(bearerSecret));
  assert.match(exported.events.at(-1).text, /token=/);
  assert.match(exported.events.at(-1).text, /Authorization: \[REDACTED_SECRET\]/);
});

test("state supports runtime run lifecycle, cancellation, errors, stats, and sessions", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });
  assert.equal(initial.activeRun, null);
  assert.equal(initial.status, "idle");
  assert.equal(initial.terminalState, "idle");
  assert.deepEqual(initial.evidence, []);
  assert.deepEqual(initial.sessions, [initial.session]);
  assert.match(initial.session.id, /^ses_/);

  const run = { id: "run_1", abort: () => {} };
  const running = reducer(initial, { type: "RUN_STARTED", prompt: "build", run });
  assert.equal(running.status, "running");
  assert.equal(running.terminalState, "running");
  assert.equal(running.activeRun, run);
  assert.equal(running.goal, "build");
  assert.deepEqual(running.intent, { prompt: "build" });
  assert.equal(running.tasks.length, 0);
  assert.doesNotMatch(JSON.stringify(running.events), /af -p/);

  const cancelling = reducer(running, { type: "RUN_CANCELLING" });
  assert.equal(cancelling.status, "cancelling");
  assert.equal(cancelling.terminalState, "cancelling");
  assert.equal(cancelling.cancelling, true);

  const cancelled = reducer(cancelling, { type: "RUN_CANCELLED", reason: "escape" });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.terminalState, "cancelled");
  assert.equal(cancelled.activeRun, null);
  assert.equal(cancelled.cancelled, true);
  assert.match(cancelled.events.at(-1).text, /escape/);

  const finished = reducer(running, { type: "RUN_FINISHED", result: { ok: true } });
  assert.equal(finished.status, "idle");
  assert.equal(finished.terminalState, "success");

  const errored = reducer(running, { type: "RUN_ERROR", error: new Error("Missing OPENAI_API_KEY ***") });
  assert.equal(errored.status, "error");
  assert.equal(errored.terminalState, "error");
  assert.equal(errored.activeRun, null);
  assert.doesNotMatch(errored.error, /sk-live-secret/);
  assert.match(errored.error, /af config set env.apiKey/);

  const withStats = reducer(initial, { type: "RUNTIME_EVENT", event: { type: "stats", stats: { runs: 1, completed: 1 }, tokens: 42, cost: "$0.01", percent: 7 } });
  assert.deepEqual(withStats.tokenUsage, { tokens: 42, cost: "$0.01", percent: 7 });
  assert.deepEqual(withStats.runtimeStats, { runs: 1, completed: 1 });
  assert.equal(withStats.events.at(-1).type, "stats");

  const withSession = reducer(initial, { type: "RUNTIME_EVENT", event: { type: "session", id: "ses_next", title: "Next" } });
  assert.equal(withSession.session.id, "ses_next");
  assert.equal(withSession.sessions.at(-1).id, "ses_next");
  assert.equal(withSession.events.at(-1).type, "session");
});

test("canonical runtime events drive terminal state, errors, stats, sessions, and evidence", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });

  const started = reducer(initial, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "run_start", sessionId: "ses_runtime", runId: "run_2", payload: { prompt: "inspect", provider: "pi-agent", model: "pi-default" } } });
  assert.equal(started.status, "running");
  assert.equal(started.terminalState, "running");
  assert.equal(started.goal, "inspect");
  assert.deepEqual(started.intent, { prompt: "inspect" });
  assert.equal(started.session.id, "ses_runtime");
  assert.equal(started.session.runtimeObserved, true);
  assert.equal(started.sessions.at(-1).id, "ses_runtime");

  const withStats = reducer(started, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "stats", sessionId: "ses_runtime", runId: "run_2", payload: { stats: { runs: 1, running: true }, tokens: 64, percent: 12, cost: "$0.02" } } });
  assert.deepEqual(withStats.runtimeStats, { runs: 1, running: true });
  assert.deepEqual(withStats.tokenUsage, { tokens: 64, percent: 12, cost: "$0.02" });

  const withEvidence = reducer(withStats, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "artifact", sessionId: "ses_runtime", runId: "run_2", payload: { evidence: { kind: "artifact", title: "Run summary", uri: "artifacts/run-summary.json" } } } });
  assert.deepEqual(withEvidence.evidence, [{ kind: "artifact", title: "Run summary", uri: "artifacts/run-summary.json" }]);
  assert.equal(withEvidence.events.at(-1).type, "artifact");

  const ended = reducer(withEvidence, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "run_end", sessionId: "ses_runtime", runId: "run_2", payload: { ok: true, exitCode: 0 } } });
  assert.equal(ended.status, "idle");
  assert.equal(ended.terminalState, "success");
  assert.equal(ended.activeRun, null);

  const aborted = reducer(started, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "run_end", sessionId: "ses_runtime", runId: "run_2", payload: { aborted: true } } });
  assert.equal(aborted.status, "cancelled");
  assert.equal(aborted.terminalState, "cancelled");
  assert.match(aborted.events.at(-1).text, /cancelled/);
  assert.doesNotMatch(aborted.events.at(-1).text, /success/);

  const failed = reducer(started, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "error", sessionId: "ses_runtime", runId: "run_2", payload: { error: "boom" } } });
  assert.equal(failed.status, "error");
  assert.equal(failed.terminalState, "error");
  assert.equal(failed.error, "boom");
});

test("runtime-backed commands report observed runtime data when available", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });
  const withRuntimeSession = reducer(initial, { type: "RUNTIME_EVENT", event: { type: "session", sessionId: "ses_runtime", title: "Runtime session" } });
  const withStats = reducer(withRuntimeSession, { type: "RUNTIME_EVENT", event: { type: "stats", stats: { runs: 2, completed: 1, failed: 1, running: false }, tokens: 128, percent: 20, cost: "$0.03" } });

  const stats = reducer(withStats, { type: "COMMAND", command: parseSlashCommand("/stats") });
  assert.match(stats.events.at(-1).text, /runtime stats/i);
  assert.match(stats.events.at(-1).text, /runs 2/i);
  assert.match(stats.events.at(-1).text, /completed 1/i);
  assert.match(stats.events.at(-1).text, /failed 1/i);
  assert.doesNotMatch(stats.events.at(-1).text, /local TUI counters/i);

  const session = reducer(withStats, { type: "COMMAND", command: parseSlashCommand("/session") });
  assert.match(session.events.at(-1).text, /runtime-observed session ses_runtime/i);
  assert.match(session.events.at(-1).text, /2 known sessions/i);
});

test("workspace status labels preserve AlphaFoundry product identity without synthetic agentic tasks", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "pi-agent", model: "pi-default" });

  const submitted = reducer(initial, { type: "SUBMIT_HOME", value: "inspect" });
  assert.equal(submitted.product, "AlphaFoundry");
  assert.deepEqual(submitted.intent, { prompt: "inspect" });
  assert.equal(submitted.status, "idle");
  assert.equal(submitted.terminalState, "idle");
  assert.deepEqual(submitted.tasks, []);
  assert.doesNotMatch(JSON.stringify(submitted.events), /Understand request|Read AlphaFoundry project context|Verify result/);

  const running = reducer(initial, { type: "RUN_STARTED", prompt: "inspect", run: { id: "run_1" } });
  assert.equal(running.action, "Runtime request running");
  assert.doesNotMatch(running.action, /Pi runtime/);
  assert.doesNotMatch(JSON.stringify(running.events), /af -p/);
});
