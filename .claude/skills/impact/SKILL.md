---
name: impact
description: Run impact analysis before changing code. Use whenever a task names a symbol, file, module or contract to change, or before writing any code in this repo. Triggers - "what breaks if", "impact", "blast radius", "which tests", starting any implementation task.
allowed-tools: Bash Read
---

1. Run `pos index` (cheap, incremental), then `pos impact <target...>` or `pos impact --diff`.
2. Paste the report verbatim into the issue (or PR description) as a comment.
3. Read the result:
   - `blast: SMALL/MEDIUM` → continue; read only the cards of the listed modules.
   - `blast: LARGE` or `contracts: CHANGED` → STOP. Write what you would change and why, and ask a human to approve before implementing.
4. The "tests to run" line is your test set for the PR. Do not run the full suite.
5. Record where you stopped in the retrieval ladder when done: `pos metrics log --issue <#> --stopped-at <1-6>`.
