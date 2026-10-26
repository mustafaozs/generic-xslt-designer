---
name: gate
description: Run every CI gate locally before pushing and record the task's research metrics - index, lint, card check, ledger check, metrics record, impact-selected tests. Triggers - "am I done", "run the gates", "ready to push", "definition of done".
allowed-tools: Bash Read
---

1. `pos gate --base origin/main` runs index → lint → card check → ledger check → metrics check and prints GATE PASS/FAIL.
2. Record this task's metrics record (protocol in docs/research/protocol.md §3). One call, all numbers you know:
   `pos metrics log --issue <#N> --condition cbad --model <model id> --tokens-in <N> --tokens-out <N> --tokens-discovery <input tokens before your first edit> --stopped-at <1-6> --tests-selected <n> --tests-ran <n> --tests-full <n> --base origin/main`
   Token numbers come from your session usage; `stopped-at` is the deepest retrieval rung you used (1 map, 2 graph/impact, 3 cards, 4 contracts, 5 source, 6 partial call graph). Be honest: the query log is cross-checked against it.
   If this task is one of the control tasks (STATE.md says so) use `--condition control`.
3. Run only the tests `pos impact --diff --base origin/main` lists.
4. All green → push; PR description must contain `Closes #N`, the impact report, the ledger entry link and the test command.
   Anything red → fix it with the matching skill (/card, /ledger, /adr). Do not push red; CI runs the same gates and blocks the merge.
