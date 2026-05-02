import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildConfiguredPiArgs, resolvePiProcessEnv, resolveRunTimeoutMs, runPi } from "../src/pi-backend.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

test("buildConfiguredPiArgs injects configured provider/model for prompt runs only", () => {
  const args = buildConfiguredPiArgs(["-p", "hello"], { provider: "openai", model: "gpt-4o-mini" });
  assert.ok(args.includes("--provider"));
  assert.ok(args.includes("openai"));
  assert.ok(args.includes("--model"));
  assert.ok(args.includes("gpt-4o-mini"));

  const passthrough = buildConfiguredPiArgs(["--version"], { provider: "openai", model: "gpt-4o-mini" });
  assert.equal(passthrough.includes("--provider"), false);
  assert.equal(passthrough.includes("--model"), false);
});

test("buildConfiguredPiArgs preserves CLI provider/model overrides", () => {
  const args = buildConfiguredPiArgs(
    ["--provider", "anthropic", "--model=claude-test", "-p", "hello"],
    { provider: "openai", model: "gpt-4o-mini" },
  );
  assert.equal(args.filter((arg) => arg === "--provider").length, 1);
  assert.ok(args.includes("anthropic"));
  assert.ok(args.includes("--model=claude-test"));
  assert.equal(args.includes("openai"), false);
  assert.equal(args.includes("gpt-4o-mini"), false);
});

test("resolvePiProcessEnv adds resolved runtime env and preserves Pi config dir mapping", () => {
  const env = resolvePiProcessEnv(
    { env: { OPENAI_API_KEY: "test-value" } },
    { ALPHAFOUNDRY_CONFIG_DIR: "/tmp/af", PATH: "/bin" },
  );
  assert.equal(env.PI_CONFIG_DIR, "/tmp/af");
  assert.equal(env.OPENAI_API_KEY, "test-value");
  assert.equal(env.PATH, "/bin");
});

test("legacy Pi backend caps retained output", async () => {
  const result = await runPi(["--version"], { maxOutputBytes: 2 });
  assert.equal(result.ok, true);
  assert.ok(result.output.length <= 2);
  assert.ok(result.cappedBytes > 0);
});

test("resolveRunTimeoutMs parses explicit and environment timeout values", () => {
  assert.equal(resolveRunTimeoutMs({ timeoutMs: 50 }), 50);
  assert.equal(resolveRunTimeoutMs({ timeoutMs: "25" }), 25);
  assert.equal(resolveRunTimeoutMs({ processEnv: { ALPHAFOUNDRY_RUN_TIMEOUT_MS: "75" } }), 75);
  assert.equal(resolveRunTimeoutMs({ timeoutMs: 0 }), 0);
  assert.equal(resolveRunTimeoutMs({ timeoutMs: false }), 0);
  assert.equal(resolveRunTimeoutMs({ timeoutMs: "invalid" }), 0);
});

test("legacy Pi backend times out and terminates slow child processes", async () => {
  const result = await runPi([], {
    processEnv: { ...process.env, ALPHAFOUNDRY_PI_CLI_PATH: join(fixtureDir, "fixtures", "fixture-pi-sleep.mjs") },
    timeoutMs: 25,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 124);
  assert.equal(result.timedOut, true);
  assert.match(result.error, /timed out after 25 ms/);
});
