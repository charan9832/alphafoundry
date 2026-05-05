import test from "node:test";
import assert from "node:assert/strict";
import { runPromptWithEvents } from "../src/tui/prompt-flow.js";

test("runPromptWithEvents streams fake runtime events and returns result", async () => {
  const seen = [];
  const runner = async (prompt, options = {}) => {
    assert.equal(prompt, "inspect workspace");
    assert.equal(options.provider, "test-provider");
    options.onEvent({ type: "assistant", text: "thinking" });
    options.onEvent({ type: "tool", name: "fake-tool", status: "done" });
    // Adapter already emitted events inline via onEvent — streaming pattern.
    // result.events is the same array used during streaming so we don't replay it.
    return { ok: true, events: [{ type: "assistant", text: "thinking" }, { type: "tool", name: "fake-tool", status: "done" }] };
  };

  const result = await runPromptWithEvents(
    runner,
    "inspect workspace",
    { provider: "test-provider" },
    (event) => seen.push(event),
  );

  assert.deepEqual(result, { ok: true, events: [{ type: "assistant", text: "thinking" }, { type: "tool", name: "fake-tool", status: "done" }] });
  // Only the inline-emitted events should be visible — result.events should NOT be replayed
  assert.deepEqual(seen, [
    { type: "assistant", text: "thinking" },
    { type: "tool", name: "fake-tool", status: "done" },
  ]);
});

test("runPromptWithEvents supports async iterable fake runtimes", async () => {
  const seen = [];
  async function* runtime() {
    yield { type: "assistant", text: "chunk one" };
    yield { type: "assistant", text: "chunk two" };
  }

  const result = await runPromptWithEvents(
    () => runtime(),
    "stream",
    {},
    (event) => seen.push(event),
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(seen, [
    { type: "assistant", text: "chunk one" },
    { type: "assistant", text: "chunk two" },
  ]);
});
