import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../src/tools/registry.js";
import { localBacktestTool } from "../src/tools/finance.js";

describe("tool registry and finance tools", () => {
  it("runs deterministic backtest tool with provenance and disabled live trading", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "af-tools-"));
    const registry = new ToolRegistry();
    registry.register(localBacktestTool());
    const result = await registry.call("run_local_backtest", { symbol: "spy" }, { workspace });
    assert.equal(result.ok, true);
    assert.equal(result.metadata.provenance?.provider, "local-python-deterministic-engine");
    assert.equal((result.data as { assumptions: { liveTrading: boolean } }).assumptions.liveTrading, false);
  });

  it("returns structured error for unknown tools", async () => {
    const registry = new ToolRegistry();
    const result = await registry.call("missing", {}, { workspace: "/tmp" });
    assert.equal(result.ok, false);
    assert.match(String(result.error), /Unknown tool/);
  });
});
