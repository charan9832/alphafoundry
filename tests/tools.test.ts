import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../src/tools/registry.js";
import { mockBacktestTool } from "../src/tools/finance.js";

describe("tool registry and finance tools", () => {
  it("runs deterministic backtest tool with provenance and disabled live trading", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "af-tools-"));
    const registry = new ToolRegistry();
    registry.register(mockBacktestTool());
    const result = await registry.call("run_mock_backtest", { symbol: "spy" }, { workspace });
    expect(result.ok).toBe(true);
    expect(result.metadata.provenance?.provider).toBe("mock-deterministic-engine");
    expect((result.data as { assumptions: { liveTrading: boolean } }).assumptions.liveTrading).toBe(false);
  });

  it("returns structured error for unknown tools", async () => {
    const registry = new ToolRegistry();
    const result = await registry.call("missing", {}, { workspace: "/tmp" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });
});
