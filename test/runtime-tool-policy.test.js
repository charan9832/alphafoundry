import test from "node:test";
import assert from "node:assert/strict";
import { join, normalize } from "node:path";

import {
  RUNTIME_TOOL_POLICY_SCHEMA_VERSION,
  mapRuntimeToolIntent,
  mapRuntimeToolPolicy,
} from "../src/runtime/tool-policy.js";

const workspace = normalize(join(process.cwd(), ".tmp-policy-workspace"));
const alphaFoundryHome = normalize(join(process.cwd(), ".tmp-policy-home", ".alphafoundry"));

const context = {
  workspace,
  alphaFoundryHome,
  timestamp: "2026-01-01T00:00:00.000Z",
};

test("runtime tool intents map to serializable permission policy decisions", () => {
  const result = mapRuntimeToolIntent(
    {
      id: "intent_read",
      adapter: "pi",
      toolName: "read",
      risk: "read",
      path: "src/index.js",
      reason: "inspect token=sk-secret1234567890",
      metadata: { requestId: "req_123", apiKey: "sk-secret1234567890" },
    },
    { mode: "ask", ...context },
  );

  assert.equal(result.schemaVersion, RUNTIME_TOOL_POLICY_SCHEMA_VERSION);
  assert.equal(result.intentId, "intent_read");
  assert.equal(result.adapter, "pi");
  assert.equal(result.toolName, "read");
  assert.equal(result.risk, "read");
  assert.equal(result.decision, "allow");
  assert.equal(result.requiresApproval, false);
  assert.equal(result.timestamp, context.timestamp);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
  assert.doesNotMatch(JSON.stringify(result), /sk-secret/);
  assert.match(JSON.stringify(result), /\[REDACTED_SECRET\]/);
});

test("runtime tool policy summaries aggregate allow ask and deny decisions", () => {
  const result = mapRuntimeToolPolicy({
    mode: "ask",
    intents: [
      { id: "intent_read", toolName: "read", risk: "read", path: "src/index.js" },
      { id: "intent_write", toolName: "write", risk: "write", path: "src/index.js" },
    ],
    ...context,
  });

  assert.equal(result.schemaVersion, RUNTIME_TOOL_POLICY_SCHEMA_VERSION);
  assert.equal(result.mode, "ask");
  assert.equal(result.decision, "ask");
  assert.equal(result.requiresApproval, true);
  assert.deepEqual(result.counts, { allow: 1, ask: 1, deny: 0 });
  assert.deepEqual(result.results.map((item) => item.intentId), ["intent_read", "intent_write"]);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("runtime tool policy fails closed for unsupported modes risks and unknown tools", () => {
  const unsupportedMode = mapRuntimeToolPolicy({
    mode: "bypass",
    intents: [{ id: "intent_read", toolName: "read", risk: "read", path: "src/index.js" }],
    ...context,
  });
  assert.equal(unsupportedMode.decision, "deny");
  assert.equal(unsupportedMode.requiresApproval, false);
  assert.match(unsupportedMode.results[0].reason, /Unsupported permission mode/);

  const unsupportedRisk = mapRuntimeToolIntent(
    { id: "intent_network", toolName: "fetch", risk: "finance", path: "src/index.js" },
    { mode: "ask", ...context },
  );
  assert.equal(unsupportedRisk.decision, "deny");
  assert.equal(unsupportedRisk.risk, "destructive");
  assert.match(unsupportedRisk.reason, /Unsupported risk class/);

  const unknownTool = mapRuntimeToolIntent({ id: "intent_unknown", risk: "read" }, { mode: "ask", ...context });
  assert.equal(unknownTool.decision, "deny");
  assert.equal(unknownTool.risk, "destructive");
  assert.match(unknownTool.reason, /Unknown tool/);
});

test("runtime tool policy preserves protected path denial details", () => {
  const result = mapRuntimeToolIntent(
    { id: "intent_env", toolName: "read", risk: "read", path: ".env", reason: "apiKey=sk-secret1234567890" },
    { mode: "auto", ...context },
  );

  assert.equal(result.decision, "deny");
  assert.equal(result.requiresApproval, false);
  assert.equal(result.protectedPath.category, "env");
  assert.doesNotMatch(JSON.stringify(result), /sk-secret/);
});
