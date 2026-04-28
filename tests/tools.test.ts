import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../src/tools/registry.js";

describe("tool registry", () => {
  it("returns structured error for unknown tools", async () => {
    const registry = new ToolRegistry();
    const result = await registry.call("missing", {}, { workspace: "/tmp" });
    assert.equal(result.ok, false);
    assert.match(String(result.error), /Unknown tool/);
  });
});
