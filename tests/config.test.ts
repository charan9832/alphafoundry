import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { applyLlmConfig, createDefaultConfig, saveConfig } from "../src/config.js";

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
    expect(raw).toContain("OPENROUTER_API_KEY");
    expect(raw).not.toContain("sk-");
  });

  it("rejects raw secret-like values in apiKeyEnv", () => {
    const config = createDefaultConfig();
    expect(() => applyLlmConfig(config, { provider: "openrouter", model: "x", apiKeyEnv: "sk_testSecretValue12345" })).toThrow(/environment variable name/);
  });

  it("allows environment variable names that contain provider words but no raw secret syntax", () => {
    const config = createDefaultConfig();
    const updated = applyLlmConfig(config, { provider: "openrouter", model: "x", apiKeyEnv: "PROJECT_SK_TEST_KEY" });
    expect(updated.llm?.apiKeyEnv).toBe("PROJECT_SK_TEST_KEY");
  });
});
