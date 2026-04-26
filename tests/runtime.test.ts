import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/types.js";
import { respondToMessage } from "../src/agent/runtime.js";

async function mockConfig(): Promise<AppConfig> {
  const workspace = await mkdtemp(join(tmpdir(), "af-runtime-"));
  return {
    version: 1,
    workspace,
    llm: { provider: "mock", model: "mock-finance-agent" },
    safety: { liveTradingEnabled: false, disclaimerAccepted: true },
  };
}

describe("agent runtime", () => {
  it("answers casual chat through the LLM adapter path", async () => {
    const config = await mockConfig();
    const response = await respondToMessage(config, "hey", async () => config);
    expect(response.source).toBe("llm");
    expect(response.response).toContain("ready");
  });

  it("calls readiness tool from natural language", async () => {
    const config = await mockConfig();
    const response = await respondToMessage(config, "show system readiness", async () => config);
    expect(response.source).toBe("tool");
    expect(response.metadata?.tool).toBe("readiness");
  });

  it("refuses broker/order requests", async () => {
    const config = await mockConfig();
    const response = await respondToMessage(config, "connect my broker and place an order", async () => config);
    expect(response.source).toBe("safety");
    expect(response.response).toContain("disabled");
  });
});
