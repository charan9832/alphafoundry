#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = join(root, '.hermes', 'finish');
mkdirSync(logDir, { recursive: true });
const logPath = join(logDir, `${runId}-ruflo-claude-finish.log`);
const summaryPath = join(logDir, `${runId}-summary.json`);

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  process.stdout.write(line);
  appendFileSync(logPath, line);
}

function run(cmd, args, options = {}) {
  log(`$ ${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
    timeout: options.timeout ?? 600_000,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  if (result.stdout) appendFileSync(logPath, result.stdout);
  if (result.stderr) appendFileSync(logPath, result.stderr);
  log(`exit=${result.status ?? 'signal:' + result.signal}`);
  return result;
}

function statusShort() {
  return run('git', ['status', '--short'], { timeout: 60_000 }).stdout.trim();
}

function headShort(ref = 'HEAD') {
  return run('git', ['rev-parse', '--short', ref], { timeout: 60_000 }).stdout.trim();
}

function verify() {
  const checks = [
    ['npm', ['test'], 600_000],
    ['npm', ['run', 'check'], 900_000],
    ['git', ['diff', '--check'], 120_000],
  ];
  for (const [cmd, args, timeout] of checks) {
    if (run(cmd, args, { timeout }).status !== 0) return false;
  }
  return true;
}

function commitIfChanged(message) {
  const status = statusShort();
  if (!status) return { committed: false, reason: 'no_changes' };
  const candidates = ['src', 'test', 'docs', 'README.md', 'CHANGELOG.md', 'AGENTS.md', 'package.json', 'package-lock.json', 'scripts']
    .filter((path) => existsSync(join(root, path)));
  const add = run('git', ['add', ...candidates], { timeout: 120_000 });
  if (add.status !== 0) return { committed: false, reason: 'git_add_failed' };
  const staged = run('git', ['diff', '--cached', '--stat'], { timeout: 120_000 }).stdout.trim();
  if (!staged) return { committed: false, reason: 'nothing_staged' };
  const commit = run('git', ['commit', '-m', message], { timeout: 120_000 });
  return { committed: commit.status === 0, reason: commit.status === 0 ? 'committed' : 'commit_failed', staged };
}

const common = `
You are Claude Code upgraded with Ruflo user-scope plugins. Ruflo is only your Claude Code enhancement layer; do NOT add Ruflo branding, dependencies, hooks, MCP, or plugin files to AlphaFoundry.

AlphaFoundry is the project to finish. It is a standalone terminal AI product using Pi Agent as runtime adapter.
Hard boundaries:
- no finance, trading, broker, exchange, market-data, backtest, portfolio, order, or account features
- no native shell/file executor yet
- no MCP execution yet
- no YOLO/bypass mode
- no secrets or .env reads
- keep product identity AlphaFoundry-first

Work style:
- use TDD where practical
- make the smallest correct change
- run targeted tests and npm test/npm run check/git diff --check before final response
- final response must include PASS/WARN/FAIL, files changed, commands run, blockers
`;

const tasks = [
  {
    id: 'release-static-audit',
    commit: 'test: add release static audit gate',
    prompt: `${common}
Bounded slice: add a deterministic release/static-audit gate for AlphaFoundry, if not already present.
Goal: make "finish" more concrete by checking no real secrets, no Ruflo/Claude Flow references inside AlphaFoundry source/docs, no stale finance feature enablement, and required release/package files exist.
Allowed files: scripts/**, test/**, package.json, docs/RELEASE.md, CHANGELOG.md.
Forbidden: runtime feature work beyond tests/scripts/docs. Do not change dependencies.
Expected: wire the audit into npm test or npm run check only if low-risk and fast.`,
  },
  {
    id: 'doctor-release-readiness',
    commit: 'feat: add release readiness doctor checks',
    prompt: `${common}
Bounded slice: improve AlphaFoundry release readiness diagnostics.
Goal: make af doctor or a nearby deterministic helper report release-relevant readiness already covered by local files: package metadata, package-lock presence, test/check scripts, release docs, and clean git status when available.
Allowed files: src/doctor.js, src/cli.js, test/cli-product.test.js, docs/RELEASE.md, README.md, CHANGELOG.md.
Forbidden: network CI calls, npm publish, GitHub API writes, dependency changes.`,
  },
  {
    id: 'tool-pack-cli-surface',
    commit: 'feat: expose generic tool-pack status',
    prompt: `${common}
Bounded slice: expose the existing generic empty tool-pack boundary through an honest CLI/info surface.
Goal: users can inspect that optional tool packs are disabled by default and that domain packs are gated, without enabling or executing any pack.
Allowed files: src/cli.js, src/runtime/tool-packs.js, test/cli-product.test.js, test/tool-packs.test.js, README.md, docs/CLI_AGENT_CONTROL_PLANE.md, CHANGELOG.md.
Forbidden: enabling packs by default, adding any actual finance/domain pack, MCP execution, native tools.`,
  },
  {
    id: 'final-doc-consistency',
    commit: 'docs: align AlphaFoundry completion status',
    prompt: `${common}
Bounded slice: final docs consistency pass.
Goal: update README/ROADMAP/CLI_AGENT_CONTROL_PLANE/CHANGELOG only if they are stale after implemented slices. Keep language honest: foundation/generic product is stronger, not production trading/finance ready.
Allowed files: README.md, docs/ROADMAP.md, docs/CLI_AGENT_CONTROL_PLANE.md, docs/RELEASE.md, CHANGELOG.md.
Forbidden: code changes unless needed to fix docs tests.`,
  },
];

const summary = {
  runId,
  logPath,
  summaryPath,
  startedAt: new Date().toISOString(),
  initialHead: headShort(),
  results: [],
};
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

log(`AlphaFoundry Ruflo/Claude finish loop started runId=${runId}`);
if (statusShort()) {
  log('Worktree dirty before start; stopping.');
  summary.status = 'blocked_dirty_start';
  summary.finalStatus = statusShort();
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  process.exit(1);
}
if (!verify()) {
  log('Baseline verification failed; stopping.');
  summary.status = 'baseline_failed';
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  process.exit(1);
}
summary.baselineVerified = true;
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

for (const task of tasks) {
  log(`=== TASK ${task.id} START ===`);
  if (statusShort()) {
    summary.results.push({ id: task.id, status: 'blocked_dirty_before_task', statusShort: statusShort() });
    break;
  }

  const claude = run('claude-azure-task', [task.prompt, root], {
    timeout: 3_600_000,
    env: {
      CLAUDE_CODE_MAX_TURNS: '30',
      CLAUDE_CODE_MAX_BUDGET_USD: '4.00',
    },
  });

  const afterStatus = statusShort();
  const result = { id: task.id, claudeExit: claude.status, changed: Boolean(afterStatus), statusAfterClaude: afterStatus };
  if (claude.status !== 0) {
    result.status = afterStatus ? 'claude_failed_dirty_left_for_review' : 'claude_failed_no_changes';
    summary.results.push(result);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    if (afterStatus) break;
    continue;
  }
  if (!afterStatus) {
    result.status = 'no_changes';
    summary.results.push(result);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    continue;
  }

  result.verified = verify();
  if (!result.verified) {
    result.status = 'verification_failed_dirty_left_for_review';
    summary.results.push(result);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    break;
  }
  result.commit = commitIfChanged(task.commit);
  result.status = result.commit.committed ? 'committed' : `not_committed_${result.commit.reason}`;
  result.afterHead = headShort();
  summary.results.push(result);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  log(`=== TASK ${task.id} END status=${result.status} ===`);
}

summary.finalVerified = verify();
summary.finalStatus = statusShort();
summary.finalHead = headShort();
summary.completedAt = new Date().toISOString();
summary.status = summary.finalVerified && !summary.finalStatus ? 'pass_clean' : 'warn_needs_review';
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
log(`AlphaFoundry Ruflo/Claude finish loop completed status=${summary.status} summary=${summaryPath}`);
