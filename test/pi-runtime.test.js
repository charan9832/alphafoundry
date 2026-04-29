import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createPiRuntime, normalizeRpcEvent } from "../src/pi-runtime/client.js";

function createFakeSpawn() {
  const calls = [];
  const spawn = (command, args = [], options = {}) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.killed = false;
    child.killCalls = [];
    child.kill = (signal = "SIGTERM") => {
      child.killed = true;
      child.killCalls.push(signal);
      child.emit("close", null, signal);
      return true;
    };
    calls.push({ command, args, options, child });
    return child;
  };
  spawn.calls = calls;
  return spawn;
}

function collectEvents(runtime) {
  const events = [];
  const unsubscribe = runtime.onEvent((event) => events.push(event));
  return { events, unsubscribe };
}

test("runtime streams structured chunks from a spawned Pi process", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi", cwd: "/tmp/project" });
  const { events } = collectEvents(runtime);

  const run = runtime.sendPrompt("hello", { provider: "openai", model: "gpt-test" });
  const child = fakeSpawn.calls[0].child;
  child.stdout.write("hello ");
  child.stdout.write("world");
  child.stderr.write("debug\n");
  child.emit("close", 0, null);
  const result = await run;

  assert.equal(result.ok, true);
  assert.equal(result.stdout, "hello world");
  assert.equal(result.stderr, "debug\n");
  assert.deepEqual(events.map((event) => event.type), [
    "run_start",
    "command",
    "stdout",
    "assistant",
    "stdout",
    "assistant",
    "stderr",
    "run_end",
    "stats",
  ]);
  assert.equal(events[0].prompt, "hello");
  assert.equal(events[1].command, "pi");
  assert.equal(events[3].text, "hello ");
  assert.equal(events[5].text, "world");
  assert.equal(events[6].text, "debug\n");
  assert.equal(fakeSpawn.calls[0].command, "pi");
  assert.ok(fakeSpawn.calls[0].args.includes("-p"));
  assert.equal(fakeSpawn.calls[0].args.includes("--no-session"), false);
  assert.ok(fakeSpawn.calls[0].args.includes("hello"));
  assert.equal(fakeSpawn.calls[0].options.cwd, "/tmp/project");
});

test("runtime abort cancels the active child process and emits aborted", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi" });
  const { events } = collectEvents(runtime);

  const run = runtime.sendPrompt("stop me");
  const child = fakeSpawn.calls[0].child;
  runtime.abort();
  const result = await run;

  assert.equal(child.killed, true);
  assert.deepEqual(child.killCalls, ["SIGTERM"]);
  assert.equal(result.aborted, true);
  assert.ok(events.some((event) => event.type === "aborted"));
  assert.ok(events.some((event) => event.type === "run_end" && event.aborted === true));
});

test("runtime supports AbortController signals for cancellation", async () => {
  const fakeSpawn = createFakeSpawn();
  const controller = new AbortController();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi" });

  const run = runtime.sendPrompt("abort signal", { signal: controller.signal });
  const child = fakeSpawn.calls[0].child;
  controller.abort();
  const result = await run;

  assert.equal(child.killed, true);
  assert.equal(result.aborted, true);
});

test("runtime updates stats after completed runs", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi" });

  const first = runtime.sendPrompt("one");
  fakeSpawn.calls[0].child.stdout.write("abc");
  fakeSpawn.calls[0].child.emit("close", 0, null);
  await first;

  const second = runtime.sendPrompt("two");
  fakeSpawn.calls[1].child.stderr.write("err");
  fakeSpawn.calls[1].child.emit("close", 2, null);
  await second;

  assert.deepEqual(runtime.getStats(), {
    runs: 2,
    completed: 1,
    failed: 1,
    aborted: 0,
    stdoutBytes: 3,
    stderrBytes: 3,
    outputBytes: 6,
    cappedBytes: 0,
    lastExitCode: 2,
    running: false,
  });
});

test("setModel updates defaults used for subsequent prompts", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi", provider: "old", model: "old-model" });

  runtime.setModel({ provider: "anthropic", model: "claude-test" });
  const run = runtime.sendPrompt("model prompt");
  fakeSpawn.calls[0].child.emit("close", 0, null);
  await run;

  const args = fakeSpawn.calls[0].args;
  assert.ok(args.includes("--provider"));
  assert.ok(args.includes("anthropic"));
  assert.ok(args.includes("--model"));
  assert.ok(args.includes("claude-test"));
  assert.deepEqual(runtime.getStats().model, { provider: "anthropic", model: "claude-test" });
});

test("runtime caps retained output bytes while still reporting capped bytes", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi", maxOutputBytes: 5 });
  const { events } = collectEvents(runtime);

  const run = runtime.sendPrompt("cap");
  const child = fakeSpawn.calls[0].child;
  child.stdout.write("1234");
  child.stdout.write("5678");
  child.stderr.write("abcdef");
  child.emit("close", 0, null);
  const result = await run;

  assert.equal(result.stdout, "12345");
  assert.equal(result.stderr, "");
  assert.equal(result.capped, true);
  assert.equal(runtime.getStats().outputBytes, 14);
  assert.equal(runtime.getStats().cappedBytes, 9);
  assert.deepEqual(events.filter((event) => event.type === "assistant").map((event) => event.text), ["1234", "5"]);
});

test("runtime emits error events for spawn failures", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi" });
  const { events } = collectEvents(runtime);

  const run = runtime.sendPrompt("boom");
  fakeSpawn.calls[0].child.emit("error", new Error("spawn failed"));
  const result = await run;

  assert.equal(result.ok, false);
  assert.equal(result.error, "spawn failed");
  assert.ok(events.some((event) => event.type === "error" && event.error === "spawn failed"));
  assert.ok(events.some((event) => event.type === "run_end" && event.ok === false));
});

test("onEvent returns an unsubscribe callback", async () => {
  const fakeSpawn = createFakeSpawn();
  const runtime = createPiRuntime({ spawn: fakeSpawn, command: "pi" });
  let count = 0;
  const unsubscribe = runtime.onEvent(() => count++);
  unsubscribe();

  const run = runtime.sendPrompt("no listener");
  fakeSpawn.calls[0].child.emit("close", 0, null);
  await run;

  assert.equal(count, 0);
});

test("normalizeRpcEvent maps Pi RPC tool and message events to AlphaFoundry events", () => {
  assert.deepEqual(normalizeRpcEvent({ type: "message_delta", delta: "hello" }), { type: "assistant", text: "hello" });
  assert.deepEqual(normalizeRpcEvent({ type: "tool_execution_start", toolName: "read" }), { type: "tool", name: "read", status: "start", text: "read started" });
  assert.deepEqual(normalizeRpcEvent({ type: "tool_execution_end", toolName: "bash", isError: false }), { type: "tool", name: "bash", status: "done", text: "bash done" });
  assert.deepEqual(normalizeRpcEvent({ type: "agent_end" }), { type: "run_end", ok: true });
});
