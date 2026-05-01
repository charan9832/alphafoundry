import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TOOL_PACK_REGISTRY,
  TOOL_PACK_SCHEMA_VERSION,
  createToolPackRegistry,
  resolveToolPackEnablement,
  validateToolPackId,
} from "../src/runtime/tool-packs.js";

test("default tool-pack registry is empty and excludes optional/domain packs", () => {
  assert.equal(DEFAULT_TOOL_PACK_REGISTRY.schemaVersion, TOOL_PACK_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(DEFAULT_TOOL_PACK_REGISTRY.packs), []);

  const result = resolveToolPackEnablement();
  assert.equal(result.decision, "allow");
  assert.deepEqual(result.enabled, []);
  assert.deepEqual(result.decisions, []);
  assert.match(result.reason, /No optional tool packs requested/);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("tool-pack ids validate generic kebab-case and reject gated domain names", () => {
  assert.deepEqual(validateToolPackId("quality-gates"), {
    ok: true,
    id: "quality-gates",
    reason: "Tool pack id is valid.",
  });

  for (const id of ["finance", "trading-tools", "market-data", "broker-adapter", "backtest-lab", "portfolio-risk", "order-routing", "account-sync"]) {
    const result = validateToolPackId(id);
    assert.equal(result.ok, false, id);
    assert.equal(result.id, id);
    assert.match(result.reason, /Domain-specific tool pack ids are gated/);
  }

  for (const id of ["", "A", "bad_name", "1bad", "x".repeat(65)]) {
    const result = validateToolPackId(id);
    assert.equal(result.ok, false, id);
    assert.match(result.reason, /kebab-case/);
  }
});

test("unknown tool packs fail closed even when explicitly requested", () => {
  const result = resolveToolPackEnablement({ enable: ["quality-gates"] });

  assert.equal(result.schemaVersion, TOOL_PACK_SCHEMA_VERSION);
  assert.equal(result.decision, "deny");
  assert.deepEqual(result.enabled, []);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].packId, "quality-gates");
  assert.equal(result.decisions[0].decision, "deny");
  assert.match(result.decisions[0].reason, /Unknown tool pack/);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("registered generic tool packs require explicit enablement", () => {
  const registry = createToolPackRegistry({
    "quality-gates": {
      name: "Quality gates",
      description: "Generic verification commands and evidence collection.",
      tools: ["verify", "evidence"],
      metadata: { apiKey: "sk-secret1234567890" },
    },
  });

  assert.deepEqual(Object.keys(registry.packs), ["quality-gates"]);
  assert.equal(registry.packs["quality-gates"].enabledByDefault, false);
  assert.doesNotMatch(JSON.stringify(registry), /sk-secret/);
  assert.match(JSON.stringify(registry), /\[REDACTED_SECRET\]/);

  const defaultResult = resolveToolPackEnablement({ registry });
  assert.equal(defaultResult.decision, "allow");
  assert.deepEqual(defaultResult.enabled, []);

  const enabledResult = resolveToolPackEnablement({ registry, enable: ["quality-gates"] });
  assert.equal(enabledResult.decision, "allow");
  assert.deepEqual(enabledResult.enabled, ["quality-gates"]);
  assert.equal(enabledResult.decisions[0].pack.enabledByDefault, false);
});

test("registry creation rejects finance-like packs before they can be registered", () => {
  assert.throws(
    () => createToolPackRegistry({ "finance-research": { name: "Finance research" } }),
    /Domain-specific tool pack ids are gated/,
  );
});
