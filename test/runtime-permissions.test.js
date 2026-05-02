import test from "node:test";
import assert from "node:assert/strict";
import { dirname, normalize, join } from "node:path";

import {
  PERMISSION_MODES,
  RISK_CLASSES,
  decidePermission,
  normalizeMode,
  normalizeRiskClass,
} from "../src/runtime/permissions.js";
import {
  classifyProtectedPath,
  isPathInsideWorkspace,
  normalizeWorkspacePath,
} from "../src/runtime/protected-paths.js";

const workspace = normalize(join(process.cwd(), "test-workspace"));
const afHome = normalize(join(process.cwd(), ".alphafoundry-test"));
const outsideWorkspace = normalize(join(dirname(workspace), "outside.txt"));

function decision(input) {
  return decidePermission({ workspace, alphaFoundryHome: afHome, ...input });
}

test("permission modes and risk classes are explicit stable enums", () => {
  assert.deepEqual(PERMISSION_MODES, Object.freeze(["plan", "ask", "act", "auto"]));
  assert.deepEqual(RISK_CLASSES, Object.freeze(["read", "write", "shell", "network", "mcp", "credential", "destructive"]));
  assert.equal(normalizeMode("PLAN"), "plan");
  assert.equal(normalizeRiskClass("Shell"), "shell");
  assert.throws(() => normalizeMode("bypass"), /Unsupported permission mode/);
  assert.throws(() => normalizeRiskClass("unknown"), /Unsupported risk class/);
});

test("workspace path normalization handles POSIX and Windows-like paths deterministically", () => {
  const posix = normalizeWorkspacePath("./src/../src/index.js", workspace);
  assert.equal(posix, normalize(join(workspace, "src", "index.js")));

  const windows = normalizeWorkspacePath("src\\nested\\file.js", workspace);
  assert.equal(windows, normalize(join(workspace, "src", "nested", "file.js")));

  assert.equal(isPathInsideWorkspace(join(workspace, "src", "file.js"), workspace), true);
  assert.equal(isPathInsideWorkspace(outsideWorkspace, workspace), false);
  assert.equal(isPathInsideWorkspace("../outside.txt", workspace), false);
});

test("protected path classifier catches git, env, credentials, npm tokens, AlphaFoundry state, and outside workspace", () => {
  const cases = [
    [".git/config", "git"],
    [".env", "env"],
    [".env.local", "env"],
    ["~/.ssh/id_rsa", "ssh"],
    ["~/.aws/credentials", "cloud"],
    ["~/.config/gcloud/application_default_credentials.json", "cloud"],
    ["~/.npmrc", "npm-token"],
    ["~/.yarnrc.yml", "npm-token"],
    ["~/.pnpmrc", "npm-token"],
    [join(afHome, "config.json"), "alphafoundry-state"],
    [join(afHome, "sessions", "ses_test", "events.ndjson"), "alphafoundry-state"],
    ["../outside.txt", "outside-workspace"],
  ];

  for (const [path, category] of cases) {
    const result = classifyProtectedPath(path, { workspace, alphaFoundryHome: afHome });
    assert.equal(result.protected, true, path);
    assert.equal(result.category, category, path);
    assert.doesNotMatch(JSON.stringify(result), /sk-|secret|token=|password=/i);
  }

  assert.equal(classifyProtectedPath("src/index.js", { workspace, alphaFoundryHome: afHome }).protected, false);
});

test("plan mode denies write, shell, network, mcp, credential, and destructive risks", () => {
  for (const risk of ["write", "shell", "network", "mcp", "credential", "destructive"]) {
    const result = decision({ mode: "plan", risk, path: "src/index.js", toolName: `${risk}_tool` });
    assert.equal(result.decision, "deny", risk);
    assert.equal(result.requiresApproval, false, risk);
    assert.equal(result.mode, "plan");
    assert.equal(result.risk, risk);
  }

  const read = decision({ mode: "plan", risk: "read", path: "src/index.js", toolName: "read_file" });
  assert.equal(read.decision, "allow");
  assert.equal(read.requiresApproval, false);
});

test("ask, act, and auto modes classify approval requirements without executing tools", () => {
  assert.equal(decision({ mode: "ask", risk: "read", path: "src/index.js", toolName: "read_file" }).decision, "allow");
  assert.equal(decision({ mode: "ask", risk: "write", path: "src/index.js", toolName: "write_patch" }).decision, "ask");
  assert.equal(decision({ mode: "ask", risk: "shell", path: "src/index.js", toolName: "shell" }).requiresApproval, true);

  assert.equal(decision({ mode: "act", risk: "write", path: "src/index.js", toolName: "write_patch" }).decision, "ask");
  assert.equal(decision({ mode: "auto", risk: "read", path: "src/index.js", toolName: "read_file" }).decision, "allow");
  assert.equal(decision({ mode: "auto", risk: "write", path: "src/index.js", toolName: "write_patch" }).decision, "ask");
  assert.equal(decision({ mode: "auto", risk: "destructive", path: "src/index.js", toolName: "rm" }).decision, "deny");
});

test("protected or outside-workspace paths deny regardless of mode and produce serializable redacted decisions", () => {
  const protectedDecision = decision({ mode: "act", risk: "read", path: ".env", toolName: "read_file", reason: "token=sk-secret1234567890" });
  assert.equal(protectedDecision.decision, "deny");
  assert.equal(protectedDecision.protectedPath.category, "env");
  assert.equal(protectedDecision.requiresApproval, false);
  assert.doesNotMatch(JSON.stringify(protectedDecision), /sk-secret/);
  assert.match(JSON.stringify(protectedDecision), /\[REDACTED_SECRET\]/);

  const outside = decision({ mode: "auto", risk: "read", path: "../outside.txt", toolName: "read_file" });
  assert.equal(outside.decision, "deny");
  assert.equal(outside.protectedPath.category, "outside-workspace");

  assert.doesNotThrow(() => JSON.parse(JSON.stringify(outside)));
});

test("unknown tools default to highest-risk denial", () => {
  const result = decision({ mode: "ask", risk: "read", path: "src/index.js" });
  assert.equal(result.decision, "deny");
  assert.equal(result.risk, "destructive");
  assert.match(result.reason, /Unknown tool/);
});
