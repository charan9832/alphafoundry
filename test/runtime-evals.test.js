import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStore } from "../src/runtime/session-store.js";
import { createRuntimeEvent } from "../src/runtime/events.js";
import { evaluateSession, compareSummaries } from "../src/runtime/evals.js";

function tempHome() {
  const dir = mkdtempSync(join(tmpdir(), "af-eval-"));
  return dir;
}

test("compareSummaries returns PASS for identical sessions", () => {
  const summaryA = {
    sessionId: "ses_a",
    status: "success",
    eventTotal: 4,
    eventCounts: { run_start: 1, user: 1, assistant: 1, run_end: 1 },
    assistant: { textLength: 10, textDigest: "sha256:abc" },
    toolCallCount: 0,
    toolResultCount: 0,
    errorCount: 0,
    durationMs: 1000,
  };
  const summaryB = { ...summaryA, sessionId: "ses_b" };

  const result = compareSummaries(summaryA, summaryB);
  assert.equal(result.overall, "PASS");
  assert.ok(result.checks.every((c) => c.status === "PASS"));
});

test("compareSummaries returns FAIL on terminal status and eventTotal mismatch", () => {
  const summaryA = {
    sessionId: "ses_a",
    status: "success",
    eventTotal: 4,
    eventCounts: { run_start: 1, user: 1, assistant: 1, run_end: 1 },
    assistant: { textLength: 10, textDigest: "sha256:abc" },
    toolCallCount: 0,
    toolResultCount: 0,
    errorCount: 0,
    durationMs: 1000,
  };
  const summaryB = {
    ...summaryA,
    sessionId: "ses_b",
    status: "error",
    eventTotal: 3,
    eventCounts: { run_start: 1, user: 1, run_end: 1 },
  };

  const result = compareSummaries(summaryA, summaryB);
  assert.equal(result.overall, "FAIL");
  const statusCheck = result.checks.find((c) => c.name === "terminalStatus");
  assert.equal(statusCheck.status, "FAIL");
  const totalCheck = result.checks.find((c) => c.name === "eventTotal");
  assert.equal(totalCheck.status, "FAIL");
});

test("compareSummaries returns WARN on assistant text length mismatch", () => {
  const summaryA = {
    sessionId: "ses_a",
    status: "success",
    eventTotal: 4,
    eventCounts: { run_start: 1, user: 1, assistant: 1, run_end: 1 },
    assistant: { textLength: 10, textDigest: "sha256:abc" },
    toolCallCount: 0,
    toolResultCount: 0,
    errorCount: 0,
    durationMs: 1000,
  };
  const summaryB = {
    ...summaryA,
    sessionId: "ses_b",
    assistant: { textLength: 12, textDigest: "sha256:def" },
  };

  const result = compareSummaries(summaryA, summaryB);
  assert.equal(result.overall, "WARN");
  const assistantCheck = result.checks.find((c) => c.name === "assistantTextLength");
  assert.equal(assistantCheck.status, "WARN");
});

test("compareSummaries returns FAIL when tool counts mismatch", () => {
  const summaryA = {
    sessionId: "ses_a",
    status: "success",
    eventTotal: 5,
    eventCounts: { run_start: 1, tool_call: 1, tool_result: 1, assistant: 1, run_end: 1 },
    assistant: { textLength: 5, textDigest: "sha256:abc" },
    toolCallCount: 1,
    toolResultCount: 1,
    errorCount: 0,
    durationMs: 1000,
  };
  const summaryB = {
    ...summaryA,
    sessionId: "ses_b",
    eventTotal: 4,
    eventCounts: { run_start: 1, assistant: 1, tool_call: 1, run_end: 1 },
    toolCallCount: 1,
    toolResultCount: 0,
  };

  const result = compareSummaries(summaryA, summaryB);
  assert.equal(result.overall, "FAIL");
  const toolResultCheck = result.checks.find((c) => c.name === "toolResultCount");
  assert.equal(toolResultCheck.status, "FAIL");
});

test("evaluateSession returns PASS for healthy session", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "eval test", adapter: "mock" });

    store.appendEvent(
      session.id,
      createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1", payload: { prompt: "hi" } })
    );
    store.appendEvent(
      session.id,
      createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "hello" } })
    );
    store.appendEvent(
      session.id,
      createRuntimeEvent("run_end", { sessionId: session.id, runId: "run_1", payload: { ok: true } })
    );

    const result = evaluateSession(store, session.id);
    assert.equal(result.overall, "PASS");
    assert.ok(result.checks.every((c) => c.status === "PASS"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("evaluateSession returns FAIL for empty session", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "empty", adapter: "mock" });

    const result = evaluateSession(store, session.id);
    assert.equal(result.overall, "FAIL");
    const hasEvents = result.checks.find((c) => c.name === "hasEvents");
    assert.equal(hasEvents.status, "FAIL");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("evaluateSession returns FAIL for session with errors", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "error", adapter: "mock" });

    store.appendEvent(session.id, createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1" }));
    store.appendEvent(session.id, createRuntimeEvent("error", { sessionId: session.id, runId: "run_1", payload: { message: "oops" } }));
    store.appendEvent(session.id, createRuntimeEvent("run_end", { sessionId: session.id, runId: "run_1", payload: { ok: false } }));

    const result = evaluateSession(store, session.id);
    assert.equal(result.overall, "FAIL");
    const completed = result.checks.find((c) => c.name === "completed");
    assert.equal(completed.status, "FAIL");
    const noErrors = result.checks.find((c) => c.name === "noErrors");
    assert.equal(noErrors.status, "FAIL");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("evaluateSession returns WARN for session without assistant text", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "no text", adapter: "mock" });

    store.appendEvent(session.id, createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1" }));
    store.appendEvent(session.id, createRuntimeEvent("run_end", { sessionId: session.id, runId: "run_1", payload: { ok: true } }));

    const result = evaluateSession(store, session.id);
    assert.equal(result.overall, "WARN");
    const hasAssistant = result.checks.find((c) => c.name === "hasAssistantResponse");
    assert.equal(hasAssistant.status, "WARN");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("evaluateSession throws for missing session", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => evaluateSession(store, "ses_missing"), /Unknown AlphaFoundry session/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
