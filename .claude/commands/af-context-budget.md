# AlphaFoundry Context Budget

ECC-inspired context hygiene command tailored to AlphaFoundry.

Use before long implementation sessions, after broad research, or when context gets noisy.

Process:
1. Identify the current task/slice.
2. Summarize only durable context needed for the next step:
   - current branch/repo status
   - task goal
   - decisions locked
   - allowed files
   - boundary constraints
   - failing/passing tests
   - next command
3. Recommend what can be dropped from context.
4. If compaction is needed, provide a compact `/compact` instruction such as:
   `Keep only AlphaFoundry task goal, decisions, allowed files, current failing tests, no-finance boundary, Pi-substrate boundary, and next verification commands.`

Rules:
- Do not read the entire repo.
- Do not edit files.
- Prefer fresh sessions for implementation after planning.
