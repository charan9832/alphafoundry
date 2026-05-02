import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { piEventToAlphaFoundryEvents, runPiJsonStream } from "../src/runtime/adapters/pi-stream.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("piEventToAlphaFoundryEvents maps agent_start to run_start + user", () => {
  const events = piEventToAlphaFoundryEvents({ type: "agent_start" }, { sessionId: "s1", runId: "r1", prompt: "hello" });
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "run_start");
  assert.equal(events[0].payload.adapter, "pi");
  assert.equal(events[0].payload.prompt, "hello");
  assert.equal(events[1].type, "user");
  assert.equal(events[1].payload.text, "hello");
});

test("piEventToAlphaFoundryEvents maps message_update text_delta to assistant_delta", () => {
  const events = piEventToAlphaFoundryEvents(
    { type: "message_update", message: { role: "assistant" }, assistantMessageEvent: { type: "text_delta", delta: "hi" } },
    { sessionId: "s1", runId: "r1" },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "assistant_delta");
  assert.equal(events[0].payload.delta, "hi");
});

test("piEventToAlphaFoundryEvents maps message_end assistant to assistant + error on errorMessage", () => {
  const events = piEventToAlphaFoundryEvents(
    { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "oops" }], errorMessage: "it broke" } },
    { sessionId: "s1", runId: "r1" },
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].type, "assistant");
  assert.equal(events[0].payload.text, "oops");
  assert.equal(events[1].type, "error");
  assert.equal(events[1].payload.text, "it broke");
});

test("piEventToAlphaFoundryEvents maps tool_execution_start to tool_call", () => {
  const events = piEventToAlphaFoundryEvents(
    { type: "tool_execution_start", toolCallId: "tc1", toolName: "read", args: { file: "x.js" } },
    { sessionId: "s1", runId: "r1" },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "tool_call");
  assert.equal(events[0].payload.name, "read");
});

test("piEventToAlphaFoundryEvents maps tool_execution_end to tool_result", () => {
  const events = piEventToAlphaFoundryEvents(
    { type: "tool_execution_end", toolCallId: "tc1", toolName: "read", result: "content", isError: false },
    { sessionId: "s1", runId: "r1" },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "tool_result");
  assert.equal(events[0].payload.isError, false);
});

test("piEventToAlphaFoundryEvents maps agent_end to run_end", () => {
  const events = piEventToAlphaFoundryEvents(
    { type: "agent_end", messages: [{ role: "user" }, { role: "assistant", content: [{ type: "text", text: "ok" }] }] },
    { sessionId: "s1", runId: "r1" },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "run_end");
  assert.equal(events[0].payload.ok, true);
});

test("piEventToAlphaFoundryEvents agent_end ok=false on assistant errorMessage", () => {
  const events = piEventToAlphaFoundryEvents(
    { type: "agent_end", messages: [{ role: "assistant", content: [], errorMessage: "fail" }] },
    { sessionId: "s1", runId: "r1" },
  );
  assert.equal(events[0].type, "run_end");
  assert.equal(events[0].payload.ok, false);
});

test("runPiJsonStream spawns Pi and returns result without crashing", async () => {
  // Using --version as a safe command that exits quickly.
  // Pi with --mode json --version may not emit agent events, but it should not crash.
  const result = await runPiJsonStream(["--version"], {
    runtimeConfig: { provider: "default", model: "default" },
    sessionId: "s1",
    runId: "r1",
    prompt: "test",
  });
  assert.ok(result);
  assert.ok(typeof result.status === "number");
});

test("runPiJsonStream reports provider assistant errors as failed results", async () => {
  const events = [];
  const result = await runPiJsonStream(["-p", "hello"], {
    runtimeConfig: { provider: "default", model: "default" },
    env: { ...process.env, ALPHAFOUNDRY_PI_CLI_PATH: join(fixtureDir, "fixtures", "fixture-pi-error.mjs") },
    sessionId: "s1",
    runId: "r1",
    prompt: "hello",
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.ok, false);
  assert.notEqual(result.status, 0);
  assert.match(result.error, /fixture provider error/);
  assert.ok(events.some((event) => event.type === "error"));
  assert.equal(events.filter((event) => event.type === "run_end").at(-1).payload.ok, false);
});

test("runPiJsonStream handles abort signal", async () => {
  const controller = new AbortController();
  const promise = runPiJsonStream(["--version"], {
    runtimeConfig: { provider: "default", model: "default" },
    sessionId: "s1",
    runId: "r1",
    prompt: "test",
    signal: controller.signal,
  });
  controller.abort();
  const result = await promise;
  assert.ok(typeof result.status === "number");
});

test("runPiJsonStream times out slow child processes with terminal events", async () => {
  const events = [];
  const result = await runPiJsonStream([], {
    runtimeConfig: { provider: "default", model: "default" },
    env: { ...process.env, ALPHAFOUNDRY_PI_CLI_PATH: join(fixtureDir, "fixtures", "fixture-pi-sleep.mjs") },
    sessionId: "s1",
    runId: "r1",
    prompt: "test",
    timeoutMs: 25,
    onEvent: (event) => events.push(event),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 124);
  assert.equal(result.timedOut, true);
  assert.match(result.error, /timed out after 25 ms/);
  assert.ok(events.some((event) => event.type === "error" && /timed out/.test(event.payload.text)));
  assert.equal(events.filter((event) => event.type === "run_end").at(-1).payload.ok, false);
  assert.equal(events.filter((event) => event.type === "run_end").at(-1).payload.exitCode, 124);
});
