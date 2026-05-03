import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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

test("home and sidebar copy use concrete product language without agent theater", () => {
  const homeSource = readFileSync(new URL("../src/tui/components/Home.jsx", import.meta.url), "utf8");
  const sidebarSource = readFileSync(new URL("../src/tui/components/Sidebar.jsx", import.meta.url), "utf8");

  assert.match(homeSource, /Start a workspace run/);
  assert.match(homeSource, /terminal workspace for agentic software work/);
  assert.match(homeSource, /plan|audit|prompt/);
  assert.match(homeSource, /Sessions|sessions/);
  assert.match(homeSource, /Pre-run approval/);
  assert.match(homeSource, /Diffs/);
  assert.match(homeSource, /Evidence/);
  assert.doesNotMatch(homeSource, /████|What should AlphaFoundry do|mission-control|workspace cockpit|Approval-gated/);

  assert.match(sidebarSource, /State/);
  assert.match(sidebarSource, /Policy/);
  assert.match(sidebarSource, /Evidence/);
  assert.match(sidebarSource, /Project/);
  assert.doesNotMatch(sidebarSource, /mission-control|Language tools|Tasks|waiting for prompt/);
});

test("TUI source has semantic visual tokens and honest run/status surfaces", () => {
  const themeSource = readFileSync(new URL("../src/tui/theme.js", import.meta.url), "utf8");
  const workspaceSource = readFileSync(new URL("../src/tui/components/Workspace.jsx", import.meta.url), "utf8");
  const statusSource = readFileSync(new URL("../src/tui/components/StatusBar.jsx", import.meta.url), "utf8");
  const messageSource = readFileSync(new URL("../src/tui/components/MessagePane.jsx", import.meta.url), "utf8");

  for (const token of ["fg", "surface", "accent", "state", "diff"]) assert.match(themeSource, new RegExp(`${token}:`));
  assert.match(workspaceSource, /af ›/);
assert.match(workspaceSource, /Enter submit.*Esc cancel.*help/);
  assert.doesNotMatch(workspaceSource, /\/doctor|command deck|MISSION|mode \{state\.mode\}/);
  assert.match(statusSource, /approve-tools|pending/);
  assert.match(statusSource, /cancel/);
  assert.doesNotMatch(statusSource, /blocked: approval/);
  assert.match(messageSource, /You|AF|tool|diff|artifact|err/);
  assert.match(messageSource, /off.*hidden|hidden.*newer/);
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

test("paneWidths allocates split layout with usable sidebar and collapses on narrow terminals", () => {
  assert.deepEqual(paneWidths(120), { main: 89, sidebar: 30, showSidebar: true });
  assert.deepEqual(paneWidths(80), { main: 51, sidebar: 28, showSidebar: true });
  assert.deepEqual(paneWidths(79), { main: 79, sidebar: 0, showSidebar: false });
  assert.deepEqual(paneWidths(60), { main: 60, sidebar: 0, showSidebar: false });
  assert.deepEqual(paneWidths(40), { main: 40, sidebar: 0, showSidebar: false });
});

test("home and run input source are reducer-backed for setup states and prompt history", () => {
  const homeSource = readFileSync(new URL("../src/tui/components/Home.jsx", import.meta.url), "utf8");
  const workspaceSource = readFileSync(new URL("../src/tui/components/Workspace.jsx", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/tui/app.jsx", import.meta.url), "utf8");
  const runSource = readFileSync(new URL("../src/tui/run.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(homeSource, /useState/);
  assert.doesNotMatch(workspaceSource, /useState/);
  assert.match(homeSource, /setupStatus/);
  assert.match(homeSource, /Run af onboard/);
  assert.match(workspaceSource, /value=\{state\.input/);
  assert.match(appSource, /PROMPT_HISTORY_PREV/);
  assert.match(appSource, /PROMPT_HISTORY_NEXT/);
  assert.match(runSource, /af --help/);
  assert.match(runSource, /af doctor --json/);
});

test("workspace renders command suggestions and transcript scroll state", () => {
  const workspaceSource = readFileSync(new URL("../src/tui/components/Workspace.jsx", import.meta.url), "utf8");
  const messageSource = readFileSync(new URL("../src/tui/components/MessagePane.jsx", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/tui/app.jsx", import.meta.url), "utf8");

  assert.match(workspaceSource, /commandSuggestions/);
  assert.match(workspaceSource, /Tab complete/);
  assert.match(messageSource, /transcript\.offset/);
  assert.match(messageSource, /PgUp\/PgDn/);
  assert.match(appSource, /SCROLL_TRANSCRIPT/);
  assert.match(appSource, /completeSlashCommand/);
  assert.match(appSource, /runDoctor/);
  assert.match(appSource, /replaySession/);
  assert.match(appSource, /evaluateSession/);
});

test("repository includes CI workflow and README media artifact", () => {
  const workflow = new URL("../.github/workflows/ci.yml", import.meta.url);
  const media = new URL("../docs/media/tui-demo.txt", import.meta.url);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(existsSync(workflow), true);
  assert.equal(existsSync(media), true);
  assert.match(readFileSync(workflow, "utf8"), /node-version: \[20\.x, 22\.x, 24\.x\]/);
  assert.match(readme, /docs\/media\/tui-demo\.txt/);
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

test("README presents an honest visual TUI demo narrative", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  assert.match(readme, /## TUI demo/i);
  assert.match(readme, /Start a workspace run/);
  assert.match(readme, /RUN/);
  assert.match(readme, /pre-run tool approval/i);
  assert.match(readme, /when runtime events are available/i);
  assert.match(readme, /without claiming a live approval pause\/resume loop/i);
  assert.match(readme, /evidence/i);
  assert.match(readme, /diff/i);
  assert.doesNotMatch(readme, /mission-control|cockpit|Approval-gated|blocked: approval/);
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
