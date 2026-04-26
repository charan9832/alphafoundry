import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AppConfig } from "../src/types.js";
import { respondToMessage } from "../src/agent/runtime.js";

describe("full research workflow", () => {
  it("runs from natural language and writes backtest/report artifacts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "af-workflow-"));
    const config: AppConfig = {
      version: 1,
      workspace,
      llm: { provider: "local", model: "local-finance-agent" },
      safety: { liveTradingEnabled: false, disclaimerAccepted: true },
    };
    const response = await respondToMessage(config, "build and test a simple SPY trend strategy", async () => config);
    assert.equal(response.source, "tool");
    assert.equal(response.metadata?.tool, "run_research_workflow");
    assert.match(response.response, /reportPath/);
    assert.match(response.response, /Research and paper validation only/);

    const artifact = join(workspace, "artifacts", "SPY", "backtests", "moving-average-trend-baseline.json");
    const report = join(workspace, "reports", "SPY", "moving-average-trend-baseline.md");
    assert.match(await readFile(artifact, "utf8"), /"liveTrading": false/);
    assert.match(await readFile(report, "utf8"), /# SPY moving-average-trend-baseline Research Report/);
  });
});
