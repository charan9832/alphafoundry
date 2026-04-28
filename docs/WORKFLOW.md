# Development Workflow

## Mission intake

Before implementation, restate:

- product outcome
- acceptance criteria
- non-goals
- safety risks
- tests/checks

## Research gate

Any new feature must trace to `docs/PRODUCT_SPEC.md`, `docs/research/RESEARCH_SUMMARY.md`, or an approved spec update.

## Implementation workflow

1. Inspect current docs/source/tests.
2. Write or update tests first for changed behavior.
3. Implement narrowly.
4. Run specific tests, then `npm run check`.
5. Review against product intent and safety rules.
6. Commit only explicit changed files.
7. Report files changed, test output, artifacts, and known gaps.

## Agent roles

Use specialist roles for larger work:

- Orchestrator: mission, dependencies, final verification.
- Product Spec Agent: ensures work matches product direction.
- Pi Runtime Agent: maintains adapter/runtime boundary.
- Future Domain Tool Agent: designs opt-in tool packs without hardcoding them into core.
- Safety Agent: live-trading refusal, secrets, approvals.
- QA Agent: tests, CLI smoke, regression coverage.
- Report Agent: artifacts, docs, user-facing summaries.

## Done definition

Work is not done unless:

- tests pass
- safety gates remain active
- no secrets are persisted
- product docs are updated if behavior changed
- CLI smoke path works
