import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { callFinanceEngine } from "../src/tools/pythonBridge.js";

describe("python finance bridge", () => {
  it("responds to ping", async () => {
    const response = await callFinanceEngine<{ engine: string; status: string }>({ method: "ping" });
    assert.equal(response.ok, true);
    assert.equal(response.data?.status, "ready");
  });

  it("rejects invalid symbols without exposing internals", async () => {
    await assert.rejects(() => callFinanceEngine({ method: "run_research_workflow", params: { symbol: "../../SECRET" } }), /Finance engine rejected request/);
  });

  it("runs deterministic research workflows", async () => {
    const first = await callFinanceEngine({ method: "run_research_workflow", params: { symbol: "SPY" } });
    const second = await callFinanceEngine({ method: "run_research_workflow", params: { symbol: "SPY" } });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.deepEqual(first.data, second.data);
  });
});
