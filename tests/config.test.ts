import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyLlmConfig, applySearchConfig, createDefaultConfig, saveConfig } from "../src/config.js";

async function tempConfigPath() {
  const dir = await mkdtemp(join(tmpdir(), "af-config-"));
  return { dir, path: join(dir, "config.json") };
}

describe("config", () => {
  it("stores API key environment variable names, not raw secrets", async () => {
    const { dir, path } = await tempConfigPath();
    const config = applyLlmConfig(createDefaultConfig(join(dir, "workspace")), {
      provider: "openrouter",
      model: "openrouter/free",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
    await saveConfig(config, path);
    const raw = await readFile(path, "utf8");
    assert.match(raw, /OPENROUTER_API_KEY/);
    assert.doesNotMatch(raw, /sk-/);
  });

  it("rejects raw secret-like values in apiKeyEnv", () => {
    const config = createDefaultConfig();
    assert.throws(() => applyLlmConfig(config, { provider: "openrouter", model: "x", apiKeyEnv: "sk_testSecretValue12345" }), /environment variable name/);
  });

  it("allows environment variable names that contain provider words but no raw secret syntax", () => {
    const config = createDefaultConfig();
    const updated = applyLlmConfig(config, { provider: "openrouter", model: "x", apiKeyEnv: "PROJECT_SK_TEST_KEY" });
    assert.equal(updated.llm?.apiKeyEnv, "PROJECT_SK_TEST_KEY");
  });

  it("stores web search endpoint and API key env var name without raw secrets", async () => {
    const { dir, path } = await tempConfigPath();
    const config = applySearchConfig(createDefaultConfig(join(dir, "workspace")), {
      provider: "searxng",
      endpoint: "http://127.0.0.1:8080/search",
      apiKeyEnv: "SEARXNG_API_KEY",
      autoDetected: true,
    });
    await saveConfig(config, path);
    const raw = await readFile(path, "utf8");
    assert.match(raw, /searxng/);
    assert.match(raw, /127\.0\.0\.1:8080/);
    assert.match(raw, /SEARXNG_API_KEY/);
    assert.doesNotMatch(raw, /sk-/);
  });

  it("rejects raw secret-like values in search apiKeyEnv", () => {
    const config = createDefaultConfig();
    assert.throws(() => applySearchConfig(config, { provider: "firecrawl", endpoint: "http://127.0.0.1:3002", apiKeyEnv: "sk_test_123456789abcdef" }), /environment variable name/);
  });
});
