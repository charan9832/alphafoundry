import test from "node:test";
import assert from "node:assert/strict";

import { buildConfiguredPiArgs, piCliPath } from "../src/pi-backend.js";
import {
  PI_BUILTIN_TOOLS,
  mapPiToolPolicy,
  normalizePiToolAllowlist,
} from "../src/runtime/pi-tool-policy.js";

const profileCases = [
  ["default", []],
  ["none", ["--no-tools"]],
  ["read-only", ["--tools", "read,grep,find,ls"]],
  ["code-edit", ["--tools", "read,grep,find,ls,edit,write"]],
  ["shell", ["--tools", "read,grep,find,ls,bash"]],
  ["extension-only", ["--no-builtin-tools"]],
];

test("Pi tool profiles map to stable runtime adapter flags", () => {
  assert.deepEqual(PI_BUILTIN_TOOLS, Object.freeze(["read", "bash", "edit", "write", "grep", "find", "ls"]));

  for (const [profile, flags] of profileCases) {
    const result = mapPiToolPolicy({ profile, mode: "ask", approved: true });
    assert.equal(result.ok, true, profile);
    assert.equal(result.profile, profile);
    assert.deepEqual(result.flags, flags, profile);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)), profile);
  }
});

test("explicit Pi allowlists validate built-ins and preserve requested order", () => {
  assert.deepEqual(normalizePiToolAllowlist(["read", "bash", "read", "ls"]), ["read", "bash", "ls"]);
  assert.deepEqual(normalizePiToolAllowlist("read,grep,find"), ["read", "grep", "find"]);

  const result = mapPiToolPolicy({ allow: ["write", "read"], mode: "ask", approved: true });
  assert.equal(result.ok, true);
  assert.equal(result.profile, "explicit");
  assert.deepEqual(result.tools, ["write", "read"]);
  assert.deepEqual(result.flags, ["--tools", "write,read"]);
  assert.equal(result.decisions.length, 2);
  assert.ok(result.decisions.every((decision) => ["allow", "ask"].includes(decision.decision)));
});

test("unknown profiles, tools, and modes fail closed without Pi flags", () => {
  const unknownProfile = mapPiToolPolicy({ profile: "yolo", mode: "auto" });
  assert.equal(unknownProfile.ok, false);
  assert.equal(unknownProfile.decision, "deny");
  assert.deepEqual(unknownProfile.flags, []);
  assert.match(unknownProfile.reason, /Unknown Pi tool profile/);

  const unknownTool = mapPiToolPolicy({ allow: ["read", "curl"], mode: "auto" });
  assert.equal(unknownTool.ok, false);
  assert.equal(unknownTool.decision, "deny");
  assert.deepEqual(unknownTool.flags, []);
  assert.match(unknownTool.reason, /Unknown Pi tool/);

  const unknownMode = mapPiToolPolicy({ profile: "none", mode: "bypass" });
  assert.equal(unknownMode.ok, false);
  assert.equal(unknownMode.decision, "deny");
  assert.equal(unknownMode.requiresApproval, false);
  assert.deepEqual(unknownMode.flags, []);
  assert.match(unknownMode.reason, /Unsupported permission mode/);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(unknownMode)));
});

test("policy decisions are derived from AlphaFoundry permission mode", () => {
  const planShell = mapPiToolPolicy({ profile: "shell", mode: "plan" });
  assert.equal(planShell.ok, false);
  assert.equal(planShell.decision, "deny");
  assert.deepEqual(planShell.flags, []);
  assert.equal(planShell.deniedTool, "bash");
  assert.ok(planShell.decisions.some((decision) => decision.toolName === "bash" && decision.decision === "deny"));

  const askShell = mapPiToolPolicy({ profile: "shell", mode: "ask" });
  assert.equal(askShell.ok, false);
  assert.equal(askShell.decision, "deny");
  assert.match(askShell.reason, /requires approval/i);
  assert.deepEqual(askShell.flags, []);

  const approvedShell = mapPiToolPolicy({ profile: "shell", mode: "ask", approved: true });
  assert.equal(approvedShell.ok, true);
  assert.equal(approvedShell.requiresApproval, true);
  assert.deepEqual(approvedShell.flags, ["--tools", "read,grep,find,ls,bash"]);
});

test("configured Pi prompt args include mapped tool policy flags", () => {
  const args = buildConfiguredPiArgs(["-p", "hello"], { provider: "openai", model: "gpt-test" }, { toolProfile: "read-only", permissionMode: "ask" });

  assert.deepEqual(args.slice(0, 1), [piCliPath()]);
  assert.deepEqual(args.slice(-2), ["--tools", "read,grep,find,ls"]);
});

test("configured Pi prompt args fail closed for denied tool policy", () => {
  assert.throws(
    () => buildConfiguredPiArgs(["-p", "hello"], {}, { toolProfile: "shell", permissionMode: "auto" }),
    /Pi tool policy denied: shell operations are denied in auto mode\./,
  );
});
