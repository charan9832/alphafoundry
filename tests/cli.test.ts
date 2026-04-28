import { access, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
    const onboard = await capture(() => main(["onboard", "--config", config, "--workspace", join(dir, "workspace"), "--provider", "local", "--model", "local-agent", "--non-interactive"]));
    assert.equal(onboard.code, 0);
    const chat = await capture(() => main(["chat", "--config", config, "--json", "hey"]));
    assert.equal(chat.code, 0);
    assert.match(chat.output, /"source": "llm"/);
  });

  it("supports natural command fallback like alphafoundry check the repo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
    const config = join(dir, "config.json");
    const workspace = join(dir, "workspace");
    const onboard = await capture(() => main(["onboard", "--config", config, "--workspace", workspace, "--provider", "local", "--model", "local-agent", "--non-interactive"]));
    assert.equal(onboard.code, 0);
    const result = await capture(() => main(["check", "the", "repo", "--config", config]));
    assert.equal(result.code, 0);
    assert.match(result.output, /Run:/);
    assert.match(result.output, /Tool steps:/);
    assert.match(result.output, /readiness/);
  });

  it("returns an error for missing string flag values", async () => {
    const result = await capture(() => main(["doctor", "--config"]));
    assert.equal(result.code, 2);
    assert.match(result.error, /Missing value/);
  });

  it("package bin points at the built CLI entry", async () => {
    const packageJson = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile("package.json", "utf8")));
    assert.equal(packageJson.bin.alphafoundry, "./dist/src/cli.js");
    await access(join(process.cwd(), "dist", "src", "cli.js"));
    const help = spawnSync(process.execPath, [join(process.cwd(), "dist", "src", "cli.js"), "help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /AlphaFoundry/);
  });

  it("package allowlist excludes Hermes state and test files", async () => {
    const packageJson = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile("package.json", "utf8")));
    assert.deepEqual(packageJson.files, ["dist/src/**", "README.md", "AGENTS.md", "docs/**"]);
  });
});
