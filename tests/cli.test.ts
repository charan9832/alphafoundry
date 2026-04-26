import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";

async function capture(fn: () => Promise<number>) {
  const logs: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((msg?: unknown) => logs.push(String(msg)));
  try {
    const code = await fn();
    return { code, output: logs.join("\n") };
  } finally {
    spy.mockRestore();
  }
}

describe("cli", () => {
  it("launch shows onboarding when config missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
    const result = await capture(() => main(["launch", "--config", join(dir, "missing.json")]));
    expect(result.code).toBe(0);
    expect(result.output).toContain("First run setup");
  });

  it("onboards mock provider and chats", async () => {
    const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
    const config = join(dir, "config.json");
    const onboard = await capture(() => main(["onboard", "--config", config, "--workspace", join(dir, "workspace"), "--provider", "mock", "--model", "mock-finance-agent", "--non-interactive"]));
    expect(onboard.code).toBe(0);
    const chat = await capture(() => main(["chat", "--config", config, "--json", "hey"]));
    expect(chat.code).toBe(0);
    expect(chat.output).toContain('"source": "llm"');
  });

  it("returns an error for missing string flag values", async () => {
    const result = await capture(() => main(["doctor", "--config"]));
    expect(result.code).toBe(2);
  });
});
