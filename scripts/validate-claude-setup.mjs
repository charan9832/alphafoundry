#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const claudeDir = join(root, ".claude");
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(root, path)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) entries.push(...walk(path));
    else entries.push(path);
  }
  return entries;
}

if (!existsSync(claudeDir)) {
  fail(".claude directory is missing");
} else {
  const requiredDirs = ["agents", "commands", "rules", "checklists"];
  for (const dir of requiredDirs) {
    if (!existsSync(join(claudeDir, dir))) fail(`.claude/${dir} is missing`);
  }

  const requiredFiles = [
    ".claude/settings.json",
    ".claude/rules/no-finance-boundary.md",
    ".claude/rules/pi-substrate-boundary.md",
    ".claude/rules/quality-gate.md",
    ".claude/commands/af-quality-gate.md",
    ".claude/commands/af-boundary-check.md",
    ".claude/checklists/before-coding.md",
    ".claude/checklists/before-commit.md",
    ".claude/agents/test-runner.md",
    ".claude/agents/security-boundary-reviewer.md",
    ".claude/agents/release-verifier.md",
  ];
  for (const file of requiredFiles) {
    if (!existsSync(join(root, file))) fail(`${file} is missing`);
  }

  const settingsPath = join(claudeDir, "settings.json");
  const settings = existsSync(settingsPath) ? readJson(settingsPath) : null;
  if (settings) {
    const allow = settings.permissions?.allow ?? [];
    const deny = settings.permissions?.deny ?? [];
    for (const needed of ["Read", "Write", "Edit", "MultiEdit", "Glob", "Grep", "Bash(*)"]) {
      if (!allow.includes(needed)) fail(`.claude/settings.json permissions.allow missing ${needed}`);
    }
    for (const needed of ["Read(.env)", "Read(.env.*)", "Bash(rm -rf *)", "Bash(npm publish*)", "Bash(printenv*)"]) {
      if (!deny.includes(needed)) fail(`.claude/settings.json permissions.deny missing ${needed}`);
    }
  }

  const files = walk(claudeDir).filter((path) => path.endsWith(".md") || path.endsWith(".json"));
  const combined = files.map((path) => `${relative(root, path)}\n${readFileSync(path, "utf8")}`).join("\n---\n").toLowerCase();

  const bannedRufloRuntime = [
    ["npx", "claude-flow"].join(" "),
    ["npx", "ruflo"].join(" "),
    ["mcp__", "claude-flow"].join(""),
    ["mcp__", "ruv-swarm"].join(""),
    ["mcp__", "flow-nexus"].join(""),
    ["ruflo", "core"].join("-"),
    ["ruflo", "swarm"].join("-"),
    ["neural", "trader"].join("-"),
  ];
  for (const token of bannedRufloRuntime) {
    if (combined.includes(token)) fail(`.claude setup contains banned external Ruflo/Claude Flow runtime token: ${token}`);
  }

  const financeBoundary = readFileSync(join(claudeDir, "rules", "no-finance-boundary.md"), "utf8").toLowerCase();
  for (const token of ["do not add", "finance tools", "trading tools", "broker", "market-data", "opt-in"]) {
    if (!financeBoundary.includes(token)) fail(`no-finance boundary missing phrase: ${token}`);
  }

  const packageFiles = new Set([
    "scripts/run-tests.mjs",
    "scripts/smoke-installed.mjs",
  ]);
  const packageJson = readJson(join(root, "package.json"));
  if (packageJson) {
    for (const file of packageFiles) {
      if (!packageJson.files?.includes(file)) fail(`package.json files should include ${file}`);
    }
    if (packageJson.files?.includes(".claude")) fail("package.json should not publish internal .claude automation assets by default");
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: ".claude", policy: "local-no-ruflo-runtime-no-finance" }, null, 2));
