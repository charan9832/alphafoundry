#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testDir = join(process.cwd(), "test");
const files = readdirSync(testDir)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => join("test", name));

if (files.length === 0) {
  console.error("No test files found in test/*.test.js");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if ((result.status ?? 0) !== 0) {
  process.exit(result.status ?? 1);
}

const releaseAudit = spawnSync(process.execPath, ["scripts/release-static-audit.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
if (releaseAudit.error) {
  console.error(releaseAudit.error.message);
  process.exit(1);
}
if ((releaseAudit.status ?? 0) !== 0) {
  process.exit(releaseAudit.status ?? 1);
}

const claudeSetup = spawnSync(process.execPath, ["scripts/validate-claude-setup.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
if (claudeSetup.error) {
  console.error(claudeSetup.error.message);
  process.exit(1);
}
process.exit(claudeSetup.status ?? 0);
