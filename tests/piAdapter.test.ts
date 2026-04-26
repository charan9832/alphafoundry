import { describe, expect, it } from "vitest";
import { extractText } from "../src/agent/adapters.js";

describe("Pi adapter helpers", () => {
  it("extracts text from pi-ai assistant content blocks", () => {
    const text = extractText({ content: [{ type: "text", text: "hello" }, { type: "toolCall", name: "readiness" }] });
    expect(text).toBe("hello");
  });
});
