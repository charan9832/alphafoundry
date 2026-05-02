import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeRunner } from "../src/tui/runtime-runner.js";
import { createSessionStore } from "../src/runtime/session-store.js";

function tempHome() {
  return mkdtempSync(join(tmpdir(), "af-tui-agent-"));
}

test("TUI runtime runner uses AlphaFoundry durable sessions", async () => {
  const home = tempHome();
  const previousHome = process.env.ALPHAFOUNDRY_HOME;
  const previousAdapter = process.env.ALPHAFOUNDRY_RUNTIME_ADAPTER;
  try {
    process.env.ALPHAFOUNDRY_HOME = home;
    process.env.ALPHAFOUNDRY_RUNTIME_ADAPTER = "mock";
    const runner = await createRuntimeRunner();
    const seen = [];
    const result = await runner("hello from installed tui", {
      provider: "test-provider",
      model: "test-model",
      session: { id: "ses_tui_ready", title: "TUI ready", cwd: "/repo" },
      onEvent: (event) => seen.push(event),
    });

    assert.equal(result.result.ok, true);
    assert.equal(result.session.id, "ses_tui_ready");
    assert.ok(seen.some((event) => event.type === "run_start"));
    assert.ok(seen.some((event) => event.type === "assistant"));

    const stored = createSessionStore({ env: process.env }).readSession("ses_tui_ready");
    assert.equal(stored.manifest.id, "ses_tui_ready");
    assert.ok(stored.events.length >= 3);
    assert.ok(stored.events.some((event) => event.type === "assistant"));
  } finally {
    if (previousHome === undefined) delete process.env.ALPHAFOUNDRY_HOME;
    else process.env.ALPHAFOUNDRY_HOME = previousHome;
    if (previousAdapter === undefined) delete process.env.ALPHAFOUNDRY_RUNTIME_ADAPTER;
    else process.env.ALPHAFOUNDRY_RUNTIME_ADAPTER = previousAdapter;
    rmSync(home, { recursive: true, force: true });
  }
});
