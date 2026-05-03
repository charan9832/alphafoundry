import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { parseSlashCommand, commandHelp, commandSuggestions, completeSlashCommand } from "../src/tui/commands.js";
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

test("slash command suggestions and completion expose discoverable command palette", () => {
  assert.deepEqual(commandSuggestions("/mo").map((item) => item.command), ["mode", "model"]);
  assert.ok(commandSuggestions("/").some((item) => item.command === "doctor" && /health/.test(item.description)));
  assert.ok(commandSuggestions("/tools ").some((item) => item.command === "tools" && /read grep/.test(item.hint)));
  assert.equal(completeSlashCommand("/mo"), "/mode ");
  assert.equal(completeSlashCommand("/doctor"), "/doctor");
});

test("Ink slash command parser recognizes all supported commands without legacy TUI", () => {
  assert.deepEqual(parseSlashCommand("/help"), { type: "help" });
  assert.deepEqual(parseSlashCommand("/clear"), { type: "clear" });
  assert.deepEqual(parseSlashCommand("/exit"), { type: "exit" });
  assert.deepEqual(parseSlashCommand("/quit"), { type: "exit" });
  assert.deepEqual(parseSlashCommand("/stats"), { type: "stats" });
  assert.deepEqual(parseSlashCommand("/session"), { type: "session" });
  assert.deepEqual(parseSlashCommand("/new"), { type: "new" });
  assert.deepEqual(parseSlashCommand("/export"), { type: "export", scope: "visible" });
  assert.deepEqual(parseSlashCommand("/print"), { type: "export", scope: "visible" });
  assert.deepEqual(parseSlashCommand("/doctor"), { type: "doctor" });
  assert.deepEqual(parseSlashCommand("/retry"), { type: "retry" });
  assert.deepEqual(parseSlashCommand("/sessions"), { type: "sessions" });
  assert.deepEqual(parseSlashCommand("/replay"), { type: "replay" });
  assert.deepEqual(parseSlashCommand("/eval"), { type: "eval" });
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
  for (const command of ["/help", "/clear", "/model", "/provider", "/exit", "/stats", "/tools", "/approve-tools", "/mode", "/session", "/sessions", "/new", "/doctor", "/retry", "/replay", "/eval", "/export", "/print"]) {
    assert.match(help, new RegExp(command.replace("/", "\\/")));
  }
});

test("command help is honest about local-only runtime command fallbacks", () => {
  const help = commandHelp();
  assert.match(help, /Conversation/);
  assert.match(help, /Model \+ session/);
  assert.match(help, /Tools \+ safety/);
  assert.match(help, /\/model <id>\s+set local model preference/i);
  assert.match(help, /\/provider <name>\s+set local provider preference/i);
  assert.match(help, /\/stats\s+show local TUI counters/i);
  assert.match(help, /\/tools <list>\s+request runtime tools/i);
  assert.match(help, /\/approve-tools\s+approve pending tool request/i);
  assert.match(help, /\/mode <mode>\s+set tool permission mode/i);
  assert.match(help, /\/session\s+show durable session metadata/i);
  assert.match(help, /\/sessions\s+list known TUI sessions/i);
  assert.match(help, /\/new\s+start a fresh durable session/i);
  assert.match(help, /\/doctor\s+show local health guidance/i);
  assert.match(help, /\/retry\s+retry the last prompt/i);
  assert.match(help, /\/replay\s+summarize the current visible session/i);
  assert.match(help, /\/eval\s+run local visible-session checks/i);
  assert.match(help, /\/export\s+print visible transcript/i);
  assert.match(help, /\/print\s+alias for \/export/i);
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
    provider: "runtime",
    model: "default-model",
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
  assert.equal(withWriteTools.pendingToolApproval.source, "tui-slash-command");
  assert.equal(withWriteTools.pendingToolApproval.scope, "session");
  assert.equal(withWriteTools.pendingToolApproval.ttlSeconds, 300);
  assert.match(withWriteTools.pendingToolApproval.decisionId, /^apr_tui_/);
  assert.ok(withWriteTools.pendingToolApproval.expiresAt);
  assert.match(withWriteTools.events.at(-1).text, /requires approval/i);

  const approvedTools = reducer(withWriteTools, { type: "COMMAND", command: parseSlashCommand("/approve-tools") });
  assert.deepEqual(approvedTools.tools, ["write"]);
  assert.equal(approvedTools.pendingToolApproval, null);
  assert.equal(approvedTools.events.at(-1).payload.status, "allow");
  assert.deepEqual(approvedTools.events.at(-1).payload.tools, ["write"]);
  assert.match(approvedTools.events.at(-1).text, /approved runtime tools/i);

  const withMode = reducer(approvedTools, { type: "COMMAND", command: parseSlashCommand("/mode plan") });
  assert.equal(withMode.permissionMode, "plan");

  const cleared = reducer(withTools, { type: "COMMAND", command: parseSlashCommand("/clear") });
  assert.deepEqual(cleared.events, []);
});

test("scrollback actions move transcript view and disable follow mode", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const withEvents = Array.from({ length: 20 }, (_, index) => ({ type: "assistant", text: `event ${index}` })).reduce(
    (state, event) => reducer(state, { type: "ADD_EVENT", event }),
    initial,
  );

  const up = reducer(withEvents, { type: "SCROLL_TRANSCRIPT", direction: "up", amount: 5 });
  assert.equal(up.transcript.follow, false);
  assert.equal(up.transcript.offset, 5);

  const down = reducer(up, { type: "SCROLL_TRANSCRIPT", direction: "down", amount: 2 });
  assert.equal(down.transcript.offset, 3);

  const latest = reducer(down, { type: "SCROLL_TRANSCRIPT", direction: "latest" });
  assert.equal(latest.transcript.follow, true);
  assert.equal(latest.transcript.offset, 0);
});

test("doctor replay and eval commands request real durable engines before falling back", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });

  const doctor = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/doctor") });
  assert.equal(doctor.effectRequests.at(-1).kind, "doctor");
  assert.match(doctor.events.at(-1).text, /Running AlphaFoundry doctor/i);

  const replay = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/replay") });
  assert.equal(replay.effectRequests.at(-1).kind, "replay");
  assert.equal(replay.effectRequests.at(-1).sessionId, initial.session.id);

  const evaluated = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/eval") });
  assert.equal(evaluated.effectRequests.at(-1).kind, "eval");
  assert.equal(evaluated.effectRequests.at(-1).sessionId, initial.session.id);

  const applied = reducer(initial, { type: "EFFECT_RESULT", request: { kind: "replay" }, result: { ok: true, text: "Replay ses_1" } });
  assert.match(applied.events.at(-1).text, /Replay ses_1/);
});

test("pending tool approvals block prompt runs until approval is handled", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const pending = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/tools write") });
  const blocked = reducer(pending, { type: "SUBMIT_PROMPT", value: "modify files" });

  assert.equal(blocked.status, "idle");
  assert.equal(blocked.activeRun, null);
  assert.match(blocked.events.at(-1).text, /approve-tools/i);
  assert.match(blocked.events.at(-1).text, /pending tool approval/i);
  assert.deepEqual(blocked.promptHistory, []);

  const approved = reducer(pending, { type: "COMMAND", command: parseSlashCommand("/approve-tools") });
  const runnable = reducer(approved, { type: "SUBMIT_PROMPT", value: "modify files" });
  assert.equal(runnable.status, "ready-to-run");
  assert.equal(runnable.intent.prompt, "modify files");
  assert.deepEqual(runnable.promptHistory, ["modify files"]);
});

test("setup status, retry, doctor, sessions, replay, and eval commands expose recoverable UX state", () => {
  const setup = createInitialState({ cwd: "/tmp/alphafoundry", provider: "default", model: "default", setupStatus: { level: "missing-config", message: "No config found" } });
  assert.equal(setup.setupStatus.level, "missing-config");

  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const submitted = reducer(initial, { type: "SUBMIT_PROMPT", value: "inspect repo" });
  assert.equal(submitted.lastPrompt, "inspect repo");
  assert.equal(submitted.status, "ready-to-run");

  const retry = reducer(submitted, { type: "COMMAND", command: parseSlashCommand("/retry") });
  assert.equal(retry.status, "ready-to-run");
  assert.match(retry.events.at(-1).text, /Retry queued/i);

  const doctor = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/doctor") });
  assert.match(doctor.events.at(-1).text, /af doctor/i);
  assert.match(doctor.events.at(-1).text, /Config/i);

  const sessions = reducer(retry, { type: "COMMAND", command: parseSlashCommand("/sessions") });
  assert.match(sessions.events.at(-1).text, /Known TUI sessions/i);

  const replay = reducer(retry, { type: "COMMAND", command: parseSlashCommand("/replay") });
  assert.match(replay.events.at(-1).text, /Visible replay/i);

  const evaluated = reducer(retry, { type: "COMMAND", command: parseSlashCommand("/eval") });
  assert.match(evaluated.events.at(-1).text, /Visible eval/i);
});

test("TUI state exposes persistence hooks for approvals and new sessions", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const pending = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/tools write") });
  assert.equal(pending.persistRequests.at(-1).kind, "approval");
  assert.equal(pending.persistRequests.at(-1).status, "ask");

  const approved = reducer(pending, { type: "COMMAND", command: parseSlashCommand("/approve-tools") });
  assert.equal(approved.persistRequests.at(-1).kind, "approval");
  assert.equal(approved.persistRequests.at(-1).status, "allow");

  const fresh = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/new") });
  assert.equal(fresh.persistRequests.at(-1).kind, "session");
  assert.equal(fresh.persistRequests.at(-1).session.id, fresh.session.id);
});

test("expired pending tool approvals are refused", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const pending = reducer(initial, { type: "COMMAND", command: parseSlashCommand("/tools write") });
  const expired = {
    ...pending,
    pendingToolApproval: {
      ...pending.pendingToolApproval,
      expiresAt: "2000-01-01T00:00:00.000Z",
    },
  };

  const result = reducer(expired, { type: "COMMAND", command: parseSlashCommand("/approve-tools") });
  assert.deepEqual(result.tools, []);
  assert.equal(result.pendingToolApproval, null);
  assert.match(result.events.at(-1).text, /approval expired/i);
});

test("prompt history preserves multiline prompts and restores drafts", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const multiline = "first line\nsecond line";
  const afterRun = reducer(initial, { type: "RUN_STARTED", prompt: multiline, run: { id: "run_1" } });
  assert.deepEqual(afterRun.promptHistory, [multiline]);
  assert.equal(afterRun.input, "");

  const withDraft = reducer(afterRun, { type: "SET_INPUT", value: "draft prompt" });
  const previous = reducer(withDraft, { type: "PROMPT_HISTORY_PREV" });
  assert.equal(previous.input, multiline);
  assert.equal(previous.promptDraft, "draft prompt");

  const restored = reducer(previous, { type: "PROMPT_HISTORY_NEXT" });
  assert.equal(restored.input, "draft prompt");
  assert.equal(restored.promptHistoryIndex, null);
});

test("prompt history does not duplicate consecutive prompts", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  const first = reducer(initial, { type: "RUN_STARTED", prompt: "inspect", run: { id: "run_1" } });
  const second = reducer(first, { type: "RUN_STARTED", prompt: "inspect", run: { id: "run_2" } });
  assert.deepEqual(second.promptHistory, ["inspect"]);
});

test("runtime-sensitive slash commands do not overclaim backend effects", () => {
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });

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
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
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
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
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
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });

  const started = reducer(initial, { type: "RUNTIME_EVENT", event: { schemaVersion: 1, type: "run_start", sessionId: "ses_runtime", runId: "run_2", payload: { prompt: "inspect", provider: "runtime", model: "default-model" } } });
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
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
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
  const initial = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });

  const submitted = reducer(initial, { type: "SUBMIT_HOME", value: "inspect" });
  assert.equal(submitted.product, "AlphaFoundry");
  assert.deepEqual(submitted.intent, { prompt: "inspect" });
  assert.equal(submitted.status, "idle");
  assert.equal(submitted.terminalState, "idle");
  assert.deepEqual(submitted.tasks, []);
  assert.doesNotMatch(JSON.stringify(submitted.events), /Understand request|Read AlphaFoundry project context|Verify result/);

  const running = reducer(initial, { type: "RUN_STARTED", prompt: "inspect", run: { id: "run_1" } });
  assert.equal(running.action, "Runtime request running");
  assert.doesNotMatch(running.action, /internal runtime/i);
  assert.doesNotMatch(JSON.stringify(running.events), /af -p/);
});
