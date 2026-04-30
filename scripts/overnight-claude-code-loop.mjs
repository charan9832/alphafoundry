#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = join(root, '.hermes', 'overnight');
mkdirSync(logDir, { recursive: true });
const logPath = join(logDir, `${runId}-claude-code-loop.log`);
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
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}) },
    timeout: options.timeout ?? 600_000,
  });
  if (result.stdout) appendFileSync(logPath, result.stdout);
  if (result.stderr) appendFileSync(logPath, result.stderr);
  log(`exit=${result.status ?? 'signal:' + result.signal}`);
  return result;
}

function statusShort() {
  return run('git', ['status', '--short'], { timeout: 60_000 }).stdout.trim();
}

function currentHead() {
  return run('git', ['rev-parse', '--short', 'HEAD'], { timeout: 60_000 }).stdout.trim();
}

function verify() {
  const checks = [
    ['npm', ['test'], 600_000],
    ['npm', ['run', 'check'], 900_000],
    ['git', ['diff', '--check'], 120_000],
  ];
  for (const [cmd, args, timeout] of checks) {
    const r = run(cmd, args, { timeout });
    if (r.status !== 0) return false;
  }
  return true;
}

function commitIfChanged(message) {
  const before = statusShort();
  if (!before) {
    log('No changes to commit.');
    return { committed: false, reason: 'no_changes' };
  }
  const add = run('git', ['add', 'src', 'test', 'tests', 'docs', 'README.md', 'AGENTS.md', 'package.json', 'scripts'], { timeout: 120_000 });
  if (add.status !== 0) return { committed: false, reason: 'git_add_failed' };
  const staged = run('git', ['diff', '--cached', '--stat'], { timeout: 120_000 }).stdout.trim();
  if (!staged) return { committed: false, reason: 'nothing_staged' };
  const commit = run('git', ['commit', '-m', message], { timeout: 120_000 });
  return { committed: commit.status === 0, reason: commit.status === 0 ? 'committed' : 'commit_failed', staged };
}

const tasks = [
  {
    id: 'runtime-tool-policy-mapper',
    commit: 'feat: add runtime tool policy mapper',
    prompt: `AlphaFoundry implementation task: add the next generic CLI-agent foundation slice, a Pi/runtime tool-policy mapper if it is not already complete.

Constraints:
- Use TDD. Inspect current src/runtime permissions and tests first.
- Add or update tests before implementation where practical.
- Keep AlphaFoundry product identity. Pi is a runtime adapter/substrate only.
- Do NOT add finance functionality, broker/order/trading/backtest tools, MCP execution, native shell/file execution, or YOLO/bypass mode.
- Implement a small generic policy mapping layer that can map runtime/tool intents to existing PermissionPolicy decisions and serializable audit-friendly results.
- Prefer files under src/runtime/** and test/**. Update docs only if needed.
- Run npm test and npm run check before final response.
- Final response must list files changed, tests run, PASS/WARN/FAIL, and remaining blockers.`
  },
  {
    id: 'evidence-verifier-model',
    commit: 'feat: add run evidence verification model',
    prompt: `AlphaFoundry implementation task: add a small generic evidence/verifier model for AlphaFoundry runs.

Constraints:
- Use TDD. Add tests first or alongside implementation.
- Build generic PASS/WARN/FAIL verifier/evidence primitives for run summaries/artifacts. Keep it runtime-neutral.
- Integrate lightly with existing runtime events/session store only if low-risk and well-tested.
- Do NOT add finance functionality or trading/backtest/broker/account/order concepts.
- Do NOT add MCP execution or native tool execution.
- Keep changes small and reviewable.
- Run npm test and npm run check before final response.
- Final response must list files changed, tests run, PASS/WARN/FAIL, and remaining blockers.`
  },
  {
    id: 'tui-runtime-truthfulness',
    commit: 'fix: make TUI runtime status reflect real events',
    prompt: `AlphaFoundry implementation task: improve TUI truthfulness around runtime state.

Constraints:
- Use TDD. Inspect src/tui/state.js, src/tui/prompt-flow.js, src/tui/runtime.js, and relevant tests.
- Remove or qualify any synthetic/overclaiming agentic steps unless they are backed by actual runtime events.
- TUI should expose intent, running state, terminal state, errors, stats, sessions, and evidence from real runtime data where available.
- Do NOT add finance functionality.
- Keep UI changes minimal and tested.
- Run npm test and npm run check before final response.
- Final response must list files changed, tests run, PASS/WARN/FAIL, and remaining blockers.`
  },
  {
    id: 'docs-control-plane-refresh',
    commit: 'docs: refresh control plane roadmap after runtime hardening',
    prompt: `AlphaFoundry implementation task: refresh docs for the current generic CLI-agent control-plane direction after inspecting the code.

Constraints:
- Inspect README, docs/CLI_AGENT_CONTROL_PLANE.md, docs/ROADMAP.md, AGENTS.md, and recent commits.
- Document what is implemented now, what remains, and the no-finance-yet boundary.
- Do NOT overclaim production readiness.
- Do NOT add finance implementation docs beyond the gated research/council/read-only future boundary.
- Run npm test and npm run check before final response.
- Final response must list files changed, tests run, PASS/WARN/FAIL, and remaining blockers.`
  }
];

const summary = { runId, startedAt: new Date().toISOString(), logPath, results: [], initialHead: currentHead() };
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

log(`AlphaFoundry overnight Claude Code loop started. runId=${runId}`);
log(`Initial HEAD=${summary.initialHead}`);

const baseline = verify();
summary.baselineVerified = baseline;
if (!baseline) {
  log('Baseline verification failed. Stopping before edits.');
  summary.completedAt = new Date().toISOString();
  summary.status = 'baseline_failed';
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  process.exit(1);
}

for (const task of tasks) {
  log(`=== TASK ${task.id} START ===`);
  const beforeHead = currentHead();
  const beforeStatus = statusShort();
  if (beforeStatus) {
    log(`Worktree dirty before task ${task.id}; attempting verification/commit boundary first. Status:\n${beforeStatus}`);
    if (!verify()) {
      summary.results.push({ id: task.id, status: 'blocked_dirty_failed_verify', beforeStatus });
      break;
    }
    commitIfChanged(`chore: checkpoint before ${task.id}`);
  }

  const claude = run('claude-azure-task', [task.prompt, root], {
    timeout: 2_700_000,
    env: {
      CLAUDE_CODE_MAX_TURNS: process.env.CLAUDE_CODE_MAX_TURNS ?? '20',
      CLAUDE_CODE_MAX_BUDGET_USD: process.env.CLAUDE_CODE_MAX_BUDGET_USD ?? '2.50',
    },
  });
  const afterClaudeStatus = statusShort();
  const taskResult = { id: task.id, beforeHead, claudeExit: claude.status, changed: Boolean(afterClaudeStatus), statusAfterClaude: afterClaudeStatus };

  if (claude.status !== 0) {
    log(`Claude task ${task.id} failed/nonzero. Continuing only if no dirty changes.`);
    taskResult.status = afterClaudeStatus ? 'claude_failed_dirty_left_for_review' : 'claude_failed_no_changes';
    summary.results.push(taskResult);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    if (afterClaudeStatus) break;
    continue;
  }

  if (!afterClaudeStatus) {
    log(`Task ${task.id}: no file changes.`);
    taskResult.status = 'no_changes';
    summary.results.push(taskResult);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    continue;
  }

  const verified = verify();
  taskResult.verified = verified;
  if (!verified) {
    log(`Task ${task.id}: verification failed; leaving changes for review and stopping.`);
    taskResult.status = 'verification_failed_dirty_left_for_review';
    summary.results.push(taskResult);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    break;
  }

  const commit = commitIfChanged(task.commit);
  taskResult.commit = commit;
  taskResult.afterHead = currentHead();
  taskResult.status = commit.committed ? 'committed' : `not_committed_${commit.reason}`;
  summary.results.push(taskResult);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  log(`=== TASK ${task.id} END status=${taskResult.status} ===`);
}

summary.finalVerified = verify();
summary.finalStatus = statusShort();
summary.finalHead = currentHead();
summary.completedAt = new Date().toISOString();
summary.status = summary.finalVerified && !summary.finalStatus ? 'pass_clean' : 'warn_needs_review';
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
log(`AlphaFoundry overnight Claude Code loop completed status=${summary.status} summary=${summaryPath}`);
