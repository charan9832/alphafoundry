import { access, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import http from "node:http";
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

async function withServer(handler: http.RequestListener, fn: (url: string) => Promise<void>): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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

  it("non-interactive onboarding can autodetect and persist a local SearXNG endpoint", async () => {
    await withServer((req, res) => {
      if (req.url?.startsWith("/search")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ results: [] }));
        return;
      }
      res.writeHead(404).end();
    }, async (url) => {
      const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
      const config = join(dir, "config.json");
      const result = await capture(() => main([
        "onboard",
        "--config", config,
        "--workspace", join(dir, "workspace"),
        "--provider", "local",
        "--model", "local-agent",
        "--search-autodetect",
        "--search-probe", `${url}/search`,
        "--non-interactive",
      ]));
      assert.equal(result.code, 0);
      assert.match(result.output, /Search: searxng/);
      const saved = JSON.parse(await readFile(config, "utf8"));
      assert.equal(saved.search.provider, "searxng");
      assert.equal(saved.search.endpoint, `${url}/search`);
      assert.equal(saved.search.autoDetected, true);
    });
  });

  it("interactive onboarding asks for LLM provider and search setup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "af-cli-"));
    const config = join(dir, "config.json");
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/cli.ts", "onboard", "--config", config],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        input: [
          "openrouter",
          "openrouter/free",
          "OPENROUTER_API_KEY",
          "",
          join(dir, "workspace"),
          "none",
        ].join("\n") + "\n",
      }
    );
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /Choose LLM provider/);
    assert.match(child.stdout, /Configure web search/);
    const saved = JSON.parse(await readFile(config, "utf8"));
    assert.equal(saved.llm.provider, "openrouter");
    assert.equal(saved.llm.model, "openrouter/free");
    assert.equal(saved.llm.apiKeyEnv, "OPENROUTER_API_KEY");
    assert.equal(saved.search.provider, "none");
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
