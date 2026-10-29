---
name: task
description: Run one GitHub issue end to end with fresh-context subagents sized to the work (impact→dev→pr-writer→reviewer), then the gates. Use as `/task <issue number>` at the start of a clean session. Triggers - "run task", "do issue", "/task".
allowed-tools: Bash Read Agent
---

The human types only `/task <N>`. Everything below is decided here, not in the prompt.

Rule: one issue per session. If this session already ran a task, tell the user to `/clear` first and stop.

## 0. Plan: who does what, under which condition
- Brief: `env -u GITHUB_TOKEN gh issue view <N> --json title,body`. The issue is the brief.
- Condition: read `.project-os/conditions.json` (`{"#14": "control", ...}`). Listed → that value. Not listed → `cbad`. Not present → `cbad`. Say the condition in your first line. If the issue text claims a different condition, `conditions.json` wins (AGENTS.md, "When sources disagree"): strip that text from every brief, continue, and note the conflict on the ledger `debt` line. Do not ask.
- Roles are fixed. The orchestrator (you) never edits code, tests or fixtures; it only spawns agents, runs git/gh/pos bookkeeping and reports.

| step | agent | control | cbad |
|---|---|---|---|
| impact | impact (cheap) | skipped | runs; `STOP` → ask the human |
| code + tests | dev | brief starts with `CONDITION: CONTROL` | brief includes impact report |
| cards, ledger, STATE | pr-writer (cheap) | same | same |
| review | reviewer | brief starts with `CONDITION: CONTROL` | normal |

`CONDITION: CONTROL` means for every agent: no `pos impact`, `pos map`, `pos query`; read code freely; run the full suite.

## 1. Run
1. impact (cbad only). On `STOP`, post the report on the issue and stop.
2. dev with the brief (and the impact report in cbad). Model sonnet; opus only if a human approved a contract change.
   If the dev report contains `STOP: conflict`, post the conflict list on the issue, ask the human, count it in `--human-asks`, and continue only with the human's answer. Count every `auto-resolved` item in `--auto-resolved` and copy it to the ledger debt as a `conflict:` line.
3. pr-writer.
4. reviewer on the diff. REQUEST CHANGES → one new dev agent with the findings; a second REQUEST CHANGES stops and asks the human.
5. `/gate`.

## 2. Record (never edit `.project-os/metrics.jsonl` by hand)
`pos metrics log --issue "#<N>" --condition <condition> --model <dev model tier name as in project-os.toml, e.g. sonnet — not the full model id> --stopped-at <rung dev reported: 4 contracts, 5 source…> --tests-selected <impact-selected count, cbad> --tests-ran <tests the dev ran> --tests-full <full suite size> --base origin/main --human-asks <times you or an agent asked the human> --auto-resolved <conflicts settled by precedence> --deviation "<none | what departed from the protocol>"`
- `deviation` is only for departures from the protocol (condition leak, skipped step, model change). Design or template findings go to the ledger `debt` line.
- `--base origin/main` is required: without it `diff_lines` measures only the last commit.
- Leave token fields empty. The human pastes `/cost` to the research advisor, who returns one `pos metrics log … --tokens-in … --tokens-out … --cache-read …` command summed over all models.

## 3. Ship
Push the branch, open the PR with `Closes #<N>`, the impact report (cbad) or "control: no impact report", and the test command. Report in ≤10 lines: what changed, condition, rung, tests, reviewer findings, what needs the human.

## 4. Policy review reminder
Run `pos policy-due --every <policy_review_every from project-os.toml, default 10>`. Do not count by hand. If it prints `DUE:`, end the report with: "Policy review due: run `/policy-review` in a fresh session."

## Never
Merge. Amend or force-push. Add `Co-Authored-By`, session links or "Generated with" to commits or PR bodies. Run a second issue in this session. Write a test that compares output with a fresh render of itself — golden tests compare with committed expected files.
