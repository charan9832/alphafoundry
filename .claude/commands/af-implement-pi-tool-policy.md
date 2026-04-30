# Implement AlphaFoundry Pi Tool Policy Mapper

Use this for the current generic foundation slice: mapping AlphaFoundry tool profiles to Pi Agent flags.

Allowed files:
- `src/runtime/pi-tool-policy.js`
- `test/pi-tool-policy.test.js`
- `src/pi-backend.js`
- `src/runtime/runner.js`
- `src/cli.js`
- `docs/CLI_AGENT_CONTROL_PLANE.md`
- `CHANGELOG.md`

Required behavior:
- `default` -> no tool flag
- `none` -> `--no-tools`
- `read-only` -> `--tools read,grep,find,ls`
- `code-edit` -> `--tools read,grep,find,ls,edit,write`
- `shell` -> `--tools read,grep,find,ls,bash`
- `extension-only` -> `--no-builtin-tools`
- explicit allowlist -> `--tools <comma-list>` after validation
- valid Pi built-ins: `read,bash,edit,write,grep,find,ls`
- invalid/unknown tool names fail closed

Required TDD:
1. Add tests first in `test/pi-tool-policy.test.js`.
2. Run the targeted test and confirm failure.
3. Implement minimal mapper.
4. Integrate into CLI/runner/Pi backend only as needed.
5. Run targeted test, then `npm test`, `npm run check`, and `git diff --check`.

Prohibited:
- finance tools/docs/examples/tests/config
- native AlphaFoundry file/shell/tool handlers
- MCP execution
- subagent orchestration
- YOLO/bypass mode
- broad refactors outside allowed files

Final response must include changed files, tests run/results, and any deviations.
