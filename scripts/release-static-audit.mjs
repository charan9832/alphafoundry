#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  const out = [];
  for (const name of readdirSync(path).sort()) {
    const child = join(path, name);
    const childStat = statSync(child);
    if (childStat.isDirectory()) out.push(...walk(child));
    else out.push(child);
  }
  return out;
}

const requiredFiles = [
  "README.md",
  "CHANGELOG.md",
  "docs/RELEASE.md",
  "docs/ROADMAP.md",
  "docs/CLI_AGENT_CONTROL_PLANE.md",
  "package.json",
  "package-lock.json",
  "AGENTS.md",
  "LICENSE",
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) fail(`required release file missing: ${file}`);
}

const scanTargets = ["src", "scripts", "docs", "README.md", "CHANGELOG.md", "AGENTS.md", "package.json"];
const files = scanTargets.flatMap((target) => walk(join(root, target)))
  .filter((path) => !relative(root, path).startsWith("test/"))
  .filter((path) => !relative(root, path).startsWith(".hermes/"))
  .filter((path) => /\.(js|mjs|json|md|yml|yaml)$/.test(path));

const secretPattern = new RegExp("(sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9_]{20,})");
const externalRuntimeTerms = [["ru", "flo"].join(""), ["claude", "flow"].join("-")];
const financeImplementationTerms = [
  ["broker", "Adapter"].join(""),
  ["execute", "Order"].join(""),
  ["place", "Order"].join(""),
  ["market", "Data"].join(""),
  ["trading", "Strategy"].join(""),
  ["backtest", "Engine"].join(""),
  ["portfolio", "Optimizer"].join(""),
];

for (const path of files) {
  const rel = relative(root, path);
  const text = readFileSync(path, "utf8");
  const isPolicyScript = rel === "scripts/release-static-audit.mjs" || rel === "scripts/validate-claude-setup.mjs";
  if (secretPattern.test(text)) fail(`secret-like token found outside test fixtures: ${rel}`);
  if (!isPolicyScript && externalRuntimeTerms.some((term) => text.toLowerCase().includes(term))) fail(`external Claude upgrade/runtime reference found in AlphaFoundry files: ${rel}`);
  if (!isPolicyScript && /\.(js|mjs|json)$/.test(path) && financeImplementationTerms.some((term) => text.includes(term))) {
    fail(`finance/trading implementation-looking symbol found: ${rel}`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const script of ["test", "check", "pack:dry-run", "smoke:installed", "claude:validate"]) {
  if (!packageJson.scripts?.[script]) fail(`package.json missing script: ${script}`);
}
if (packageJson.files?.includes(".claude")) fail("package.json should not publish internal .claude automation assets");
if (!packageJson.files?.includes("docs")) fail("package.json files should include docs");

const result = {
  ok: failures.length === 0,
  scannedFiles: files.map((path) => relative(root, path)).length,
  failures,
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
