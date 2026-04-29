import test from "node:test";
import assert from "node:assert/strict";
import { renderFrame, parseSlashCommand, spinnerFrame, stripAnsi, designScore } from "../src/tui.js";

test("renderFrame uses Huashu-inspired context-first layout", () => {
  const output = renderFrame({
    cwd: "/tmp/project",
    provider: "azure-openai",
    model: "Kimi-K2.6-1",
    messages: [
      { role: "system", text: "context loaded" },
      { role: "user", text: "make this better" },
      { role: "assistant", text: "I will first inspect the design context." },
    ],
    input: "next task",
    status: "idle",
    sessionID: "ses_test123",
    tokens: 128,
    cost: "$0.00",
  });
  const plain = stripAnsi(output);

  assert.match(plain, /ALPHAFOUNDRY/);
  assert.match(plain, /Design context/);
  assert.match(plain, /No generic AI shell/);
  assert.match(plain, /azure-openai\/Kimi-K2\.6-1/);
  assert.match(plain, /ses_test123/);
  assert.match(plain, /Context/);
  assert.match(plain, /Reasoning/);
  assert.match(plain, /Craft/);
  assert.match(plain, /Score 8\/10/);
  assert.match(plain, /Ask · Search · Build · Review/);
  assert.match(plain, /│ next task/);
});

test("running state shows subtle Huashu-style progress", () => {
  const output = stripAnsi(renderFrame({ status: "running", messages: [], input: "" }));
  assert.match(output, /Designing/);
  assert.match(output, /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
});

test("designScore rewards context and craft", () => {
  assert.equal(designScore({ hasContext: true, hasReasoning: true, restrained: true }), 8);
  assert.equal(designScore({ hasContext: false, hasReasoning: false, restrained: false }), 4);
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
