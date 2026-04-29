import test from "node:test";
import assert from "node:assert/strict";
import { renderFrame, parseSlashCommand, spinnerFrame, stripAnsi } from "../src/tui.js";

test("renderFrame uses OpenCode-like session layout", () => {
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
    sessionID: "ses_test123",
    tokens: 128,
    cost: "$0.00",
  });
  const plain = stripAnsi(output);

  assert.match(plain, /alphafoundry\s+ses_test123/i);
  assert.match(plain, /azure-openai\/Kimi-K2\.6-1/);
  assert.match(plain, /▸ you/);
  assert.match(plain, /▸ assistant/);
  assert.match(plain, /ctrl\+p command/);
  assert.match(plain, /ctrl\+x m model/);
  assert.match(plain, /tokens 128/);
  assert.match(plain, /cost \$0\.00/);
  assert.match(plain, /│ next task/);
});

test("running state shows OpenCode-style spinner frame", () => {
  const output = stripAnsi(renderFrame({ status: "running", messages: [], input: "" }));
  assert.match(output, /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] thinking/);
});

test("spinnerFrame cycles through braille frames", () => {
  assert.equal(spinnerFrame(0), "⠋");
  assert.equal(spinnerFrame(1), "⠙");
  assert.equal(spinnerFrame(10), "⠋");
});

test("parseSlashCommand recognizes core TUI commands", () => {
  assert.deepEqual(parseSlashCommand("/help"), { type: "help" });
  assert.deepEqual(parseSlashCommand("/clear"), { type: "clear" });
  assert.deepEqual(parseSlashCommand("/model openrouter/free"), { type: "model", value: "openrouter/free" });
  assert.deepEqual(parseSlashCommand("normal prompt"), { type: "prompt", value: "normal prompt" });
});
