import { describe, expect, it } from "vitest";
import { callFinanceEngine } from "../src/tools/pythonBridge.js";

describe("python finance bridge", () => {
  it("responds to ping", async () => {
    const response = await callFinanceEngine<{ engine: string; status: string }>({ method: "ping" });
    expect(response.ok).toBe(true);
    expect(response.data?.status).toBe("ready");
  });

  it("rejects invalid symbols without exposing internals", async () => {
    await expect(callFinanceEngine({ method: "run_research_workflow", params: { symbol: "../../SECRET" } })).rejects.toThrow(/Finance engine rejected request/);
  });

  it("runs deterministic research workflows", async () => {
    const first = await callFinanceEngine({ method: "run_research_workflow", params: { symbol: "SPY" } });
    const second = await callFinanceEngine({ method: "run_research_workflow", params: { symbol: "SPY" } });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.data).toEqual(second.data);
  });
});
