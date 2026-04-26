import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/types.js";
import { respondToMessage } from "../src/agent/runtime.js";

describe("full research workflow", () => {
  it("runs from natural language and writes backtest/report artifacts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "af-workflow-"));
    const config: AppConfig = {
      version: 1,
      workspace,
      llm: { provider: "mock", model: "mock-finance-agent" },
      safety: { liveTradingEnabled: false, disclaimerAccepted: true },
    };
    const response = await respondToMessage(config, "build and test a simple SPY trend strategy", async () => config);
    expect(response.source).toBe("tool");
    expect(response.metadata?.tool).toBe("run_research_workflow");
    expect(response.response).toContain("reportPath");
    expect(response.response).toContain("Research and paper validation only");

    const artifact = join(workspace, "artifacts", "SPY", "backtests", "moving-average-trend-baseline.json");
    const report = join(workspace, "reports", "SPY", "moving-average-trend-baseline.md");
    expect(await readFile(artifact, "utf8")).toContain('"liveTrading": false');
    expect(await readFile(report, "utf8")).toContain("# SPY moving-average-trend-baseline Research Report");
  });
});
