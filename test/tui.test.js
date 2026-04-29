import test from "node:test";
import assert from "node:assert/strict";
import { renderFrame, parseSlashCommand } from "../src/tui.js";

test("renderFrame shows OpenCode-style AlphaFoundry layout", () => {
  const output = renderFrame({
    cwd: "/tmp/project",
    provider: "azure-openai",
    model: "Kimi-K2.6-1",
    messages: [
      { role: "system", text: "ready" },
      { role: "user", text: "hello" },
      { role: "assistant", text: "Hi — AlphaFoundry is ready." },
    ],
    input: "next task",
    status: "idle",
  });

  assert.match(output, /AlphaFoundry/);
  assert.match(output, /azure-openai/);
  assert.match(output, /Kimi-K2\.6-1/);
  assert.match(output, /\/help/);
  assert.match(output, /ctrl\+c/i);
  assert.match(output, /> next task/);
});

test("parseSlashCommand recognizes core TUI commands", () => {
  assert.deepEqual(parseSlashCommand("/help"), { type: "help" });
  assert.deepEqual(parseSlashCommand("/clear"), { type: "clear" });
  assert.deepEqual(parseSlashCommand("/model openrouter/free"), { type: "model", value: "openrouter/free" });
  assert.deepEqual(parseSlashCommand("normal prompt"), { type: "prompt", value: "normal prompt" });
});
