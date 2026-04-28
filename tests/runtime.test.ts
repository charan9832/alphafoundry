import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AppConfig } from "../src/types.js";
import { respondToMessage } from "../src/agent/runtime.js";

async function localConfig(): Promise<AppConfig> {
  const workspace = await mkdtemp(join(tmpdir(), "af-runtime-"));
  return {
    version: 1,
    workspace,
    llm: { provider: "local", model: "local-agent" },
    safety: { liveTradingEnabled: false, disclaimerAccepted: true },
  };
}

describe("agent runtime", () => {
  it("answers casual chat through the local adapter path", async () => {
    const config = await localConfig();
    const response = await respondToMessage(config, "hey", async () => config);
    assert.equal(response.source, "llm");
    assert.match(response.response, /ready/);
    assert.doesNotMatch(response.response, /strateg|backtest|trading|finance/i);
  });

  it("does not route strategy prompts to predefined finance tools in the agent-first starting point", async () => {
    const config = await localConfig();
    const response = await respondToMessage(config, "build a strategy and backtest SPY", async () => config);
    assert.equal(response.source, "llm");
    assert.notEqual(response.metadata?.tool, "run_research_workflow");
    assert.doesNotMatch(response.response, /run_research_workflow|backtest|predefined strategy/i);
  });

  it("calls readiness tool from natural language", async () => {
    const config = await localConfig();
    const response = await respondToMessage(config, "show system readiness", async () => config);
    assert.equal(response.source, "tool");
    assert.equal(response.metadata?.tool, "readiness");
  });

  it("refuses broker/order requests", async () => {
    const config = await localConfig();
    const response = await respondToMessage(config, "connect my broker and place an order", async () => config);
    assert.equal(response.source, "safety");
    assert.match(response.response, /disabled/);
  });
});
