import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionLog, createSessionId } from "../src/sessions.js";
import { respondToMessage } from "../src/agent/runtime.js";
import type { AppConfig } from "../src/types.js";

async function config(): Promise<AppConfig> {
  return { version: 1, workspace: await mkdtemp(join(tmpdir(), "af-session-")), llm: { provider: "local", model: "local-agent" }, safety: { liveTradingEnabled: false, disclaimerAccepted: true } };
}

describe("session continuity", () => {
  it("preserves distinct safe caller-provided session IDs", () => {
    assert.equal(createSessionId("smoke-session"), "smoke-session");
    assert.equal(createSessionId("other-session"), "other-session");
    assert.notEqual(createSessionId("smoke-session"), createSessionId("other-session"));
    assert.equal(createSessionId("foo.bar"), "foo.bar");
  });

  it("uses stable caller-provided session IDs across turns", async () => {
    const cfg = await config();
    const sessionId = createSessionId("test-session");
    await respondToMessage(cfg, "hey", async () => cfg, { sessionId });
    await respondToMessage(cfg, "remember lesson sessions should persist", async () => cfg, { sessionId });
    const events = await new SessionLog(cfg.workspace, sessionId).readAll();
    assert.equal(events.filter((event) => event.type === "user").length, 2);
    assert.ok(events.some((event) => JSON.stringify(event.data).includes("sessions should persist")));
  });

  it("sanitizes unsafe session IDs", () => {
    assert.equal(createSessionId("../../escape"), "escape");
    const generated = createSessionId();
    assert.match(generated, /^session-/);
    assert.match(new SessionLog("/tmp", generated).sessionId, /^session-/);
  });
});
