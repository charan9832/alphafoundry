import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { main } from "../src/cli.js";

async function capture(fn: () => Promise<number>) {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (msg?: unknown) => { logs.push(String(msg)); };
  console.error = (msg?: unknown) => { errors.push(String(msg)); };
  try {
    const code = await fn();
    return { code, output: logs.join("\n"), error: errors.join("\n") };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

describe("cli", () => {
  it("launch shows onboarding when config missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
    const result = await capture(() => main(["launch", "--config", join(dir, "missing.json")]));
    assert.equal(result.code, 0);
    assert.match(result.output, /First run setup/);
  });

  it("onboards local provider and chats", async () => {
    const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
    const config = join(dir, "config.json");
    const onboard = await capture(() => main(["onboard", "--config", config, "--workspace", join(dir, "workspace"), "--provider", "local", "--model", "local-finance-agent", "--non-interactive"]));
    assert.equal(onboard.code, 0);
    const chat = await capture(() => main(["chat", "--config", config, "--json", "hey"]));
    assert.equal(chat.code, 0);
    assert.match(chat.output, /"source": "llm"/);
  });

  it("returns an error for missing string flag values", async () => {
    const result = await capture(() => main(["doctor", "--config"]));
    assert.equal(result.code, 2);
    assert.match(result.error, /Missing value/);
  });
});
