import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, reducer, createInitialState } from "../src/tui/state.js";
import { paneWidths } from "../src/tui/layout.js";
import { formatDiffLines, wrapPlain } from "../src/tui/formatters.js";
import { summarizeSafety } from "../src/tui/safety.js";

test("createInitialState uses real AlphaFoundry runtime data", () => {
  const state = createInitialState({
    cwd: "/tmp/alphafoundry",
    version: "9.9.9",
    packageName: "alphafoundry",
    nodeVersion: "v99.0.0",
    backendPackage: "AlphaFoundry runtime",
    backendVersion: "0.70.6",
    gitBranch: "main",
    gitDirty: false,
    model: "local-agent",
    provider: "pi-backend",
  });

  assert.equal(state.product, "AlphaFoundry");
  assert.equal(state.model, "local-agent");
  assert.equal(state.provider, "pi-backend");
  assert.equal(state.runtime.nodeVersion, "v99.0.0");
  assert.equal(state.runtime.backendVersion, "0.70.6");
  assert.equal(state.project.gitBranch, "main");
  assert.equal(state.lsp.length, 0);
});

test("initial state is AlphaFoundry branded and does not use OpenCode placeholders", () => {
  const serialized = JSON.stringify(initialState);
  assert.match(serialized, /AlphaFoundry/);
  assert.doesNotMatch(serialized, /OpenCode|Claude Opus|Hard Connected/);
});

test("reducer records home submit intent without claiming runtime work", () => {
  const state = reducer(initialState, { type: "SUBMIT_HOME", value: "Fix broken tests" });

  assert.equal(state.view, "workspace");
  assert.equal(state.goal, "Fix broken tests");
  assert.deepEqual(state.intent, { prompt: "Fix broken tests" });
  assert.equal(state.status, "idle");
  assert.equal(state.terminalState, "idle");
  assert.equal(state.action, "ready");
  assert.deepEqual(state.tasks, []);
  assert.equal(state.events[0].type, "user");
});

test("paneWidths allocates split layout with usable sidebar", () => {
  assert.deepEqual(paneWidths(120), { main: 89, sidebar: 30 });
  assert.deepEqual(paneWidths(80), { main: 51, sidebar: 28 });
});

test("formatDiffLines preserves signs, line numbers, and wraps safely", () => {
  const lines = formatDiffLines(`diff --git a/a.js b/a.js
@@ -1,2 +1,2 @@
-old value that is very long and should wrap cleanly
+new value that is very long and should wrap cleanly
 unchanged`, 36);

  assert.equal(lines[0].kind, "meta");
  assert.equal(lines[1].kind, "hunk");
  assert.ok(lines.some((line) => line.kind === "remove" && line.text.includes("-old")));
  assert.ok(lines.some((line) => line.kind === "add" && line.text.includes("+new")));
  assert.ok(lines.every((line) => line.text.length <= 40));
});

test("wrapPlain wraps text without dropping content", () => {
  const lines = wrapPlain("alpha beta gamma delta", 10);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(" ").replace(/\s+/g, " ").trim(), "alpha beta gamma delta");
});

test("loadRuntimeRunner clears rejected cached runner promise before retry", () => {
  const source = readFileSync(new URL("../src/tui/app.jsx", import.meta.url), "utf8");

  assert.match(source, /createRuntimeRunner\(\)\.catch\(\(error\) => \{/);
  assert.match(source, /cachedRuntimeRunnerPromise = undefined;/);
  assert.match(source, /throw error;/);
});

test("TUI safety summary is explicit about mode, disabled tools, approvals, and approved tools", () => {
  const state = createInitialState({ cwd: "/tmp/alphafoundry", provider: "runtime", model: "default-model" });
  assert.deepEqual(summarizeSafety(state), {
    tone: "restricted",
    short: "mode ask · tools off",
    detail: "runtime tools disabled until /tools",
  });

  const pending = { ...state, pendingToolApproval: { tools: ["write"] } };
  assert.equal(summarizeSafety(pending).tone, "pending");
  assert.match(summarizeSafety(pending).detail, /write/);

  const approved = { ...state, tools: ["read", "grep"], permissionMode: "ask" };
  assert.equal(summarizeSafety(approved).tone, "approved");
  assert.match(summarizeSafety(approved).detail, /read, grep/);

  const plan = { ...state, permissionMode: "plan" };
  assert.equal(summarizeSafety(plan).tone, "safe");
});
