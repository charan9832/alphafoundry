import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { respondToMessage } from "../src/agent/runtime.js";
import type { AppConfig } from "../src/types.js";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("agent-first starting point", () => {
  it("does not run finance workflows from natural language in the default runtime", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "af-agent-first-"));
    const config: AppConfig = {
      version: 1,
      workspace,
      llm: { provider: "local", model: "local-agent" },
      safety: { liveTradingEnabled: false, disclaimerAccepted: true },
    };
    const response = await respondToMessage(config, "build and test a simple SPY trend strategy", async () => config);
    assert.equal(response.source, "llm");
    assert.equal(response.metadata?.tool, undefined);
    assert.match(response.response, /general AI agent/);
  });
});
