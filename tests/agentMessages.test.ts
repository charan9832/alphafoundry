import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { userMessage, type AFModelRequest, type AFModelResponse } from "../src/agent/messages.js";

describe("AlphaFoundry internal agent message model", () => {
  it("creates product-owned messages independent of Pi SDK shapes", () => {
    const message = userMessage("hello", { source: "test" });
    assert.equal(message.role, "user");
    assert.equal(message.content, "hello");
    assert.equal(message.metadata?.source, "test");
    assert.match(message.timestamp, /T/);
  });

  it("represents model requests and responses without leaking provider-specific types", () => {
    const request: AFModelRequest = {
      systemPrompt: "You are AlphaFoundry",
      messages: [userMessage("check readiness")],
      tools: [{ name: "readiness", description: "check readiness", schema: {} }],
      observations: [],
    };
    const response: AFModelResponse = {
      text: "I will check readiness.",
      toolCalls: [{ id: "call-1", name: "readiness", input: {} }],
      provider: "local",
      model: "local-agent",
    };
    assert.equal(request.tools[0]?.name, "readiness");
    assert.equal(response.toolCalls[0]?.name, "readiness");
  });
});
