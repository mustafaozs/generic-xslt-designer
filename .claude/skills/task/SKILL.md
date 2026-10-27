---
name: task
description: Run one GitHub issue end to end with fresh-context subagents sized to the work (impact→dev→pr-writer→reviewer), then the gates. Use as `/task <issue number>` at the start of a clean session. Triggers - "run task", "do issue", "/task".
allowed-tools: Bash Read Agent
---

Rule: one issue per session. If this session already ran a task, tell the user to `/clear` first and stop.

1. `gh issue view <N> --json title,body` — the issue is the brief. If STATE.md marks it a CONTROL task, skip step 2 and run the dev agent with "control condition: do not use pos impact/map/query; read freely; run the full suite".
2. Spawn the **impact** agent (cheap) with the issue. If it returns `STOP`, post the report on the issue and ask the human; do not continue.
3. Spawn the **dev** agent with issue + impact report. Default model sonnet; use opus only if the impact report says `contracts: changed` and a human has approved.
4. Spawn the **pr-writer** agent (cheap): cards, ledger entry, ADR if a decision was made, STATE.md.
5. Spawn the **reviewer** agent (read-only) on the diff; if it returns REQUEST CHANGES, send its findings back to a new dev agent once; a second REQUEST CHANGES stops and asks the human.
6. Run `/gate`. Record metrics: `pos metrics log --issue "#<N>" --condition <cbad|control> --model <dev model> --stopped-at <rung dev reported> --tests-ran <n> --tests-full <n>`; token totals are filled by the human from `/cost` after this session, before merge.
7. Push the branch, open the PR with `Closes #<N>`, the impact report and the test command. Report in ≤10 lines: what changed, rung, tests, what the reviewer flagged, what needs the human.

Never merge. Never amend or force-push. Never add `Co-Authored-By` or any trailer to commits or PR bodies. Never run a second issue in this session.
