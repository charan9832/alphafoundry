import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStore } from "../src/runtime/session-store.js";
import { createRuntimeEvent } from "../src/runtime/events.js";
import { replaySession } from "../src/runtime/replay.js";

function tempHome() {
  const dir = mkdtempSync(join(tmpdir(), "af-replay-"));
  return dir;
}

test("replaySession produces deterministic summary with counts, digest, and duration", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "replay test", adapter: "mock" });

    store.appendEvent(
      session.id,
      createRuntimeEvent("run_start", {
        sessionId: session.id,
        runId: "run_1",
        timestamp: "2026-01-01T00:00:00.000Z",
        payload: { prompt: "hello" },
      })
    );

    store.appendEvent(
      session.id,
      createRuntimeEvent("assistant", {
        sessionId: session.id,
        runId: "run_1",
        timestamp: "2026-01-01T00:00:01.000Z",
        payload: { text: "world" },
      })
    );

    store.appendEvent(
      session.id,
      createRuntimeEvent("run_end", {
        sessionId: session.id,
        runId: "run_1",
        timestamp: "2026-01-01T00:00:02.500Z",
        payload: { ok: true, exitCode: 0 },
      })
    );

    const summary = replaySession(store, session.id);
    assert.equal(summary.sessionId, session.id);
    assert.equal(summary.status, "success");
    assert.equal(summary.eventTotal, 3);
    assert.deepEqual(summary.eventCounts, { run_start: 1, assistant: 1, run_end: 1 });
    assert.equal(summary.assistant.textLength, 5);
    assert.ok(summary.assistant.textDigest.startsWith("sha256:"));
    assert.equal(summary.toolCallCount, 0);
    assert.equal(summary.toolResultCount, 0);
    assert.equal(summary.errorCount, 0);
    assert.equal(summary.durationMs, 2500);
    assert.equal(summary.redacted, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("replaySession redacts secrets in assistant text before digest", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "redaction test", adapter: "mock" });

    store.appendEvent(
      session.id,
      createRuntimeEvent("assistant", {
        sessionId: session.id,
        runId: "run_1",
        payload: { text: "key=sk-secret1234567890" },
      })
    );

    const summary = replaySession(store, session.id);
    assert.doesNotMatch(JSON.stringify(summary), /sk-secret/);
    assert.equal(summary.assistant.textLength, "key=[REDACTED_SECRET]".length);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("replaySession counts tool calls, errors, and multiple assistant events", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "complex test", adapter: "mock" });

    store.appendEvent(session.id, createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1", timestamp: "2026-01-01T00:00:00.000Z", payload: {} }));
    store.appendEvent(session.id, createRuntimeEvent("assistant_delta", { sessionId: session.id, runId: "run_1", payload: { text: "a" } }));
    store.appendEvent(session.id, createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "b" } }));
    store.appendEvent(session.id, createRuntimeEvent("tool_call", { sessionId: session.id, runId: "run_1", payload: { name: "read" } }));
    store.appendEvent(session.id, createRuntimeEvent("tool_result", { sessionId: session.id, runId: "run_1", payload: { ok: true } }));
    store.appendEvent(session.id, createRuntimeEvent("tool_call", { sessionId: session.id, runId: "run_1", payload: { name: "write" } }));
    store.appendEvent(session.id, createRuntimeEvent("error", { sessionId: session.id, runId: "run_1", payload: { message: "oops" } }));
    store.appendEvent(session.id, createRuntimeEvent("run_end", { sessionId: session.id, runId: "run_1", timestamp: "2026-01-01T00:00:05.000Z", payload: { ok: false } }));

    const summary = replaySession(store, session.id);
    assert.equal(summary.eventTotal, 8);
    assert.equal(summary.eventCounts.run_start, 1);
    assert.equal(summary.eventCounts.assistant_delta, 1);
    assert.equal(summary.eventCounts.assistant, 1);
    assert.equal(summary.eventCounts.tool_call, 2);
    assert.equal(summary.eventCounts.tool_result, 1);
    assert.equal(summary.eventCounts.error, 1);
    assert.equal(summary.eventCounts.run_end, 1);
    assert.equal(summary.assistant.textLength, 2); // "a" + "b"
    assert.equal(summary.toolCallCount, 2);
    assert.equal(summary.toolResultCount, 1);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.status, "error");
    assert.equal(summary.durationMs, 5000);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("replaySession handles empty session", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "empty test", adapter: "mock" });

    const summary = replaySession(store, session.id);
    assert.equal(summary.sessionId, session.id);
    assert.equal(summary.status, "created");
    assert.equal(summary.eventTotal, 0);
    assert.deepEqual(summary.eventCounts, {});
    assert.equal(summary.assistant.textLength, 0);
    assert.equal(summary.durationMs, null);
    assert.equal(summary.toolCallCount, 0);
    assert.equal(summary.toolResultCount, 0);
    assert.equal(summary.errorCount, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("replaySession throws for missing session", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => replaySession(store, "ses_missing"), /Unknown AlphaFoundry session/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
