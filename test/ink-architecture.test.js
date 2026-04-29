import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reducer } from "../src/tui/state.js";
import { paneWidths } from "../src/tui/layout.js";
import { formatDiffLines, wrapPlain } from "../src/tui/formatters.js";

test("reducer transitions home submit into active workspace", () => {
  const state = reducer(initialState, { type: "SUBMIT_HOME", value: "Fix broken tests" });

  assert.equal(state.view, "workspace");
  assert.equal(state.goal, "Fix broken tests");
  assert.equal(state.status, "running");
  assert.equal(state.action, "Writing command...");
  assert.equal(state.tasks[0].status, "done");
  assert.equal(state.tasks[1].status, "active");
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
