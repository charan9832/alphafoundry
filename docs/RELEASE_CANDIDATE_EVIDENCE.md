# AlphaFoundry Release-Candidate Evidence

This file records the reproducible evidence gathered before treating the current AlphaFoundry build as release-candidate quality. It complements the release runbook in [`docs/RELEASE.md`](RELEASE.md).

## Verified commit

- Commit: `5dacebeb8936c1423d202ea19f985a0ada7cd4f6`
- Branch: `main`
- GitHub repository: <https://github.com/charan9832/alphafoundry>

## TUI smoke evidence

The interactive Ink TUI was launched through a real pseudo-terminal instead of a non-TTY pipe:

```sh
script -q -c 'timeout 6s node src/cli.js' /tmp/alphafoundry-tui-smoke.raw
```

Observed markers in the cleaned capture:

- `ALPHAFOUNDRY`
- `terminal workspace for agentic software work`
- `Start a workspace run / run input`
- `/help` command guidance
- durable session identifier beginning with `ses_`
- session records / pre-run tool approval / diff display / evidence labels

The text demo in [`docs/media/tui-demo.txt`](media/tui-demo.txt) remains a static README artifact; the PTY smoke above is the reproducible manual check for the actual Ink entrypoint.

## Real runtime dogfood

A real provider-backed prompt was executed through AlphaFoundry's own runtime runner, with isolated session storage:

```sh
export ALPHAFOUNDRY_HOME=/tmp/alphafoundry-dogfood-home
export ALPHAFOUNDRY_RUN_TIMEOUT_MS=90000
node --input-type=module - <<'NODE'
import { runPrompt } from './src/runtime/runner.js';
const result = await runPrompt({
  prompt: 'Reply in one sentence: AlphaFoundry dogfood runtime check passed.',
  cwd: process.cwd(),
  title: 'dogfood runtime check',
  maxOutputBytes: 20000,
  env: process.env,
});
console.log(JSON.stringify({
  ok: result.result?.ok,
  status: result.result?.status,
  session: result.session?.id,
  runId: result.runId,
  output: result.result?.output,
  eventCount: result.events?.length,
}, null, 2));
NODE
```

Observed result:

```json
{
  "ok": true,
  "status": 0,
  "session": "ses_a1b2de38d86e4fee8e94",
  "runId": "run_4f53fae7d89e4e7e9ef4",
  "output": "AlphaFoundry dogfood runtime check passed.\n",
  "eventCount": 4
}
```

Durable session checks:

- `af sessions list --json`: one successful `pi` adapter session with `eventCount: 4`
- `af sessions show <id> --json`: events were `run_start`, `user`, `assistant`, `run_end`
- `af sessions replay <id> --json`: `status: success`, `eventTotal: 4`, `errorCount: 0`
- `af sessions eval <id> --json`: `overall: PASS`

## Local gates

The local product gate passed:

```sh
npm run check
```

Covered by `npm run check`:

- `npm test` — 198 tests passed
- CLI help check
- CLI version check
- `npm pack --dry-run --json`
- installed tarball smoke test

## GitHub CI gate

GitHub Actions completed successfully for commit `5dacebeb8936c1423d202ea19f985a0ada7cd4f6`:

- Run: <https://github.com/charan9832/alphafoundry/actions/runs/25288048738>
- Matrix: Ubuntu, macOS, and Windows
- Node versions: 20.x, 22.x, and 24.x
- Conclusion: success for all jobs

## Remaining release decision

This evidence makes the current build code/CI/dogfood green. Publishing to npm or creating a GitHub release should still follow [`docs/RELEASE.md`](RELEASE.md): version/changelog decision, `npm audit --omit=dev --audit-level=moderate`, `npm publish --dry-run`, and final tag/release creation from a clean tree.
