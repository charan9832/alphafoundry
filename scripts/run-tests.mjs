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
process.exit(result.status ?? 0);
