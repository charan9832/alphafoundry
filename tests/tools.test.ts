import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry } from "../src/agent/runtime.js";
import { ToolRegistry } from "../src/tools/registry.js";

describe("tool registry", () => {
  it("returns structured error for unknown tools", async () => {
    const registry = new ToolRegistry();
    const result = await registry.call("missing", {}, { workspace: "/tmp" });
    assert.equal(result.ok, false);
    assert.match(String(result.error), /Unknown tool/);
  });

  it("default registry is domain-neutral and contains no finance-era tools or categories", () => {
    const registry = buildRegistry(async () => null);
    const forbidden = /finance|backtest|broker|order|strategy|trading|paper validation|financial advice/i;
    for (const tool of registry.list()) {
      assert.doesNotMatch(tool.name, forbidden);
      assert.doesNotMatch(tool.description, forbidden, tool.name);
      assert.doesNotMatch(tool.category, /backtest|validation/i, tool.name);
    }
  });
});
