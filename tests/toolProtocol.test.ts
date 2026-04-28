import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeToolCalls } from "../src/agent/toolProtocol.js";
import { ToolRegistry } from "../src/tools/registry.js";
import type { ToolDefinition } from "../src/tools/types.js";

function sampleTool(): ToolDefinition<{ value: string }, { echoed: string }> {
  return {
    name: "echo",
    description: "Echo a value",
    category: "system",
    schema: { type: "object", required: ["value"], properties: { value: { type: "string" } }, additionalProperties: false },
    async execute(input) {
      return { ok: true, data: { echoed: input.value }, metadata: { tool: "echo", timestamp: "now" } };
    },
  };
}

describe("Pi-style tool protocol", () => {
  it("executes multiple tool calls preserving call IDs and order", async () => {
    const registry = new ToolRegistry();
    registry.register(sampleTool());
    const results = await executeToolCalls(registry, [
      { id: "call-1", name: "echo", arguments: { value: "a" } },
      { id: "call-2", name: "echo", arguments: { value: "b" } },
    ], { workspace: "/tmp" });
    assert.deepEqual(results.map((r) => r.id), ["call-1", "call-2"]);
    assert.equal(results[0]?.observation.ok, true);
    assert.deepEqual(results[1]?.observation.data, { echoed: "b" });
  });

  it("returns structured failures for unknown tools and malformed args", async () => {
    const registry = new ToolRegistry();
    registry.register(sampleTool());
    const results = await executeToolCalls(registry, [
      { id: "bad-tool", name: "missing", arguments: {} },
      { id: "bad-args", name: "echo", arguments: {} },
    ], { workspace: "/tmp" });
    assert.equal(results[0]?.observation.ok, false);
    assert.match(results[0]?.observation.error ?? "", /Unknown tool/);
    assert.equal(results[1]?.observation.ok, false);
    assert.match(results[1]?.observation.error ?? "", /Missing required tool argument/);
  });
});
