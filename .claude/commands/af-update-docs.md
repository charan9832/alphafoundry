# AlphaFoundry Update Docs

ECC-inspired documentation update workflow tailored to AlphaFoundry.

Use after source changes that affect CLI behavior, config, sessions, policy, packaging, or user-facing terminology.

Potential docs to inspect/update:
- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/CLI_AGENT_CONTROL_PLANE.md`
- other relevant files under `docs/`

Process:
1. Inspect the code diff and tests.
2. Identify user-facing behavior changes.
3. Update only docs directly affected by the change.
4. Preserve product identity: AlphaFoundry is the product; Pi is internal substrate/adapter.
5. Preserve no-finance boundary; do not add finance examples.
6. Prefer concise docs and accurate commands.
7. Run `git diff --check`.

Output:
- docs changed
- behavior documented
- commands/examples verified or intentionally not run

Do not invent roadmap commitments.
