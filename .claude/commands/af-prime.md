# AlphaFoundry Prime

Prime a fresh Claude Code session for AlphaFoundry work. Do not edit files.

Input: `$ARGUMENTS` may include a task, issue, plan path, or slice name.

Process:
1. Read `AGENTS.md`, `CLAUDE.md`, `package.json`, and relevant docs.
2. Check `git status --short --branch` and recent commits.
3. Identify whether the task is in current allowed scope.
4. If the task touches Pi/tool policy, read `docs/CLI_AGENT_CONTROL_PLANE.md` and relevant tests/source.
5. Summarize:
   - repo state and branch/ahead status
   - current task interpretation
   - allowed files
   - no-finance/no-native-tool-execution boundary risks
   - tests to add/run
   - recommended next command

Rules:
- Read-only only.
- Do not load the entire repo blindly.
- Do not read secrets.
