import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

import { alphaFoundryHome, sessionsDir, dataDir } from "../src/paths.js";
import { createRuntimeEvent, RUNTIME_EVENT_TYPES } from "../src/runtime/events.js";
import { createSessionStore } from "../src/runtime/session-store.js";
import { piResultToEvents } from "../src/runtime/adapters/pi.js";

function tempHome() {
  const dir = mkdtempSync(join(tmpdir(), "af-runtime-"));
  return dir;
}

test("paths resolve AlphaFoundry home, data, and sessions with env overrides", () => {
  assert.equal(alphaFoundryHome({ ALPHAFOUNDRY_HOME: "/tmp/af-home" }), normalize("/tmp/af-home"));
  assert.equal(alphaFoundryHome({ HOME: "/home/example" }), normalize("/home/example/.alphafoundry"));
  assert.equal(dataDir({ ALPHAFOUNDRY_HOME: "/tmp/af-home" }), normalize("/tmp/af-home/data"));
  assert.equal(dataDir({ ALPHAFOUNDRY_DATA_DIR: "/tmp/af-data" }), normalize("/tmp/af-data"));
  assert.equal(sessionsDir({ ALPHAFOUNDRY_HOME: "/tmp/af-home" }), normalize("/tmp/af-home/sessions"));
  assert.equal(sessionsDir({ ALPHAFOUNDRY_SESSIONS_DIR: "/tmp/af-sessions" }), normalize("/tmp/af-sessions"));
});

test("createRuntimeEvent emits schema-versioned redacted events", () => {
  assert.ok(RUNTIME_EVENT_TYPES.includes("run_start"));
  assert.ok(RUNTIME_EVENT_TYPES.includes("assistant"));
  assert.ok(RUNTIME_EVENT_TYPES.includes("run_end"));

  const event = createRuntimeEvent("assistant", {
    sessionId: "ses_test",
    runId: "run_test",
    payload: { text: "token=sk-secret1234567890" },
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(event.schemaVersion, 1);
  assert.equal(event.type, "assistant");
  assert.equal(event.sessionId, "ses_test");
  assert.equal(event.runId, "run_test");
  assert.match(event.eventId, /^evt_/);
  assert.doesNotMatch(JSON.stringify(event), /sk-secret/);
  assert.match(JSON.stringify(event), /\[REDACTED_SECRET\]/);
  assert.throws(() => createRuntimeEvent("unknown"), /Unknown AlphaFoundry runtime event type/);
});

test("session store creates manifests, appends NDJSON events, lists and exports sessions", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "test run", adapter: "pi" });
    assert.match(session.id, /^ses_/);
    assert.equal(session.cwd, normalize("/repo"));

    const first = store.appendEvent(session.id, createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1", payload: { prompt: "hello" } }));
    const second = store.appendEvent(session.id, createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "api_key=sk-secret1234567890" } }));
    store.appendEvent(session.id, createRuntimeEvent("run_end", { sessionId: session.id, runId: "run_1", payload: { ok: true, exitCode: 0 } }));

    assert.equal(first.sequence, 1);
    assert.equal(second.sequence, 2);

    const listed = store.listSessions();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, session.id);
    assert.equal(listed[0].eventCount, 3);

    const read = store.readSession(session.id);
    assert.equal(read.events.length, 3);
    assert.doesNotMatch(JSON.stringify(read), /sk-secret/);
    assert.match(JSON.stringify(read), /\[REDACTED_SECRET\]/);

    const exported = store.exportSession(session.id, { format: "json" });
    assert.equal(exported.manifest.id, session.id);
    assert.equal(exported.events.length, 3);

    const ndjson = store.exportSession(session.id, { format: "ndjson" });
    assert.equal(ndjson.trim().split("\n").length, 3);
    assert.doesNotMatch(ndjson, /sk-secret/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("session store rejects missing sessions", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.readSession("ses_missing"), /Unknown AlphaFoundry session/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("session store rejects path traversal session ids", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.createSession({ id: "../escape" }), /Invalid session id/);
    assert.throws(() => store.readSession("../escape"), /Invalid session id/);
    assert.throws(() => store.appendEvent("../escape", createRuntimeEvent("run_start")), /Invalid session id/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("session store tolerates corrupt NDJSON event lines", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "corrupt events", adapter: "mock" });
    const valid = store.appendEvent(session.id, createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "hello" } }));
    const eventsPath = join(home, "sessions", session.id, "events.ndjson");
    writeFileSync(eventsPath, `${JSON.stringify(valid)}\nnot-json\n${JSON.stringify({ schemaVersion: 1, type: "not_a_type" })}\n`, { encoding: "utf8" });

    const read = store.readSession(session.id);
    assert.equal(read.events.length, 1);
    assert.equal(read.events[0].type, "assistant");
    assert.equal(store.exportSession(session.id, { format: "ndjson" }).trim().split("\n").length, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("session store compacts events by dropping corrupt lines and updating manifest", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "compact events", adapter: "mock" });
    const first = store.appendEvent(session.id, createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1", payload: { n: 1 } }));
    const second = store.appendEvent(session.id, createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "answer" } }));
    const eventsPath = join(home, "sessions", session.id, "events.ndjson");
    writeFileSync(eventsPath, `${JSON.stringify(first)}\n{bad json\n${JSON.stringify(second)}\n`, { encoding: "utf8" });

    const compacted = store.compactSession(session.id);
    assert.equal(compacted.events.length, 2);
    assert.deepEqual(compacted.events.map((event) => event.sequence), [1, 2]);
    const read = store.readSession(session.id);
    assert.equal(read.manifest.eventCount, 2);
    assert.doesNotMatch(readFileSync(eventsPath, "utf8"), /bad json/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("session store optionally retains only the latest events per session", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home }, maxEventsPerSession: 2 });
    const session = store.createSession({ cwd: "/repo", title: "retention", adapter: "mock" });
    store.appendEvent(session.id, createRuntimeEvent("run_start", { sessionId: session.id, runId: "run_1", payload: { n: 1 } }));
    store.appendEvent(session.id, createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "two" } }));
    store.appendEvent(session.id, createRuntimeEvent("run_end", { sessionId: session.id, runId: "run_1", payload: { ok: true } }));

    const read = store.readSession(session.id);
    assert.equal(read.events.length, 2);
    assert.deepEqual(read.events.map((event) => event.sequence), [1, 2]);
    assert.deepEqual(read.events.map((event) => event.type), ["assistant", "run_end"]);
    assert.equal(read.manifest.eventCount, 2);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("session store refuses concurrent writes while a session lock exists", () => {
  const home = tempHome();
  try {
    const store = createSessionStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const session = store.createSession({ cwd: "/repo", title: "locked", adapter: "mock" });
    mkdirSync(join(home, "sessions", session.id, ".lock"));
    assert.throws(
      () => store.appendEvent(session.id, createRuntimeEvent("assistant", { sessionId: session.id, runId: "run_1", payload: { text: "blocked" } })),
      /session is locked/,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("Pi adapter converts prompt results into canonical runtime events", () => {
  const events = piResultToEvents({
    sessionId: "ses_test",
    runId: "run_test",
    prompt: "hello",
    provider: "openai",
    model: "gpt-test",
    result: { ok: true, status: 0, output: "answer sk-secret1234567890", error: "", cappedBytes: 0 },
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(events.map((event) => event.type), ["run_start", "user", "assistant", "run_end"]);
  assert.equal(events[0].payload.adapter, "pi");
  assert.equal(events[0].payload.provider, "openai");
  assert.equal(events[0].payload.model, "gpt-test");
  assert.doesNotMatch(JSON.stringify(events), /sk-secret/);
  assert.match(JSON.stringify(events), /\[REDACTED_SECRET\]/);
});
