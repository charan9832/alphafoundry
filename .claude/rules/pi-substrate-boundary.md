# Pi Substrate Boundary

Use Pi Agent as the execution substrate. AlphaFoundry should govern and productize; it should not duplicate Pi capabilities.

Pi built-in tools known from research:
- read
- bash
- edit
- write
- grep
- find
- ls

AlphaFoundry tool profiles should compile to Pi flags:
- default -> no tool flag; use Pi defaults
- none -> `--no-tools`
- read-only -> `--tools read,grep,find,ls`
- code-edit -> `--tools read,grep,find,ls,edit,write`
- shell -> `--tools read,grep,find,ls,bash`
- extension-only -> `--no-builtin-tools`
- explicit list -> `--tools <comma-list>` after validation

Rules:
- Validate explicit allowlists against Pi built-ins.
- Unknown tools fail closed.
- Do not implement native read/write/edit/bash handlers in AlphaFoundry in this slice.
- Do not execute tools in policy-mapping tests; test pure mapping and integration into Pi invocation.
- Keep Pi model/session/tool details out of public AlphaFoundry UX unless in diagnostics/troubleshooting.
