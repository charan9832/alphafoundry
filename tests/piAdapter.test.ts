import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractText } from "../src/agent/adapters.js";

describe("Pi adapter helpers", () => {
  it("extracts text from pi-ai assistant content blocks", () => {
    const text = extractText({ content: [{ type: "text", text: "hello" }, { type: "toolCall", name: "readiness" }] });
    assert.equal(text, "hello");
  });
});
