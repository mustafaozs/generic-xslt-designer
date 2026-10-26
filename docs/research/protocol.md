# Measurement protocol (v1, pre-registered 2026-10-27)

## 1. Unit of analysis
One **task** = one GitHub issue closed by one merged PR. Every task produces exactly one
record in `.project-os/metrics.jsonl` (written by `pos metrics log`, called by the /gate
skill before push) and one ledger entry. Tasks without a metrics record do not count — the
CI gate `pos metrics check` refuses a PR whose issue has no record.

## 2. Control condition
Tasks #1–#5 of the pilot are performed with the kit **present but unused**: the agent is told
not to run `pos impact/map/query`, reads code freely, and the full test suite runs. Everything
else (model, repo, author) is identical. These five records carry `condition: control`;
all later records carry `condition: cbad`.

## 3. What is recorded per task (schema of a metrics record)
| field | type | how collected |
| --- | --- | --- |
| issue | string | from `--issue` |
| condition | control \| cbad | from `--condition` |
| model | string | from `--model` (e.g. claude-opus-4-7) |
| tokens_in, tokens_out | int | from the agent session's usage report, pasted by /gate |
| tokens_discovery | int | input tokens consumed before the first file edit (agent reports; cross-checked with queries.log timestamps) |
| stopped_at | 1–6 | deepest retrieval rung the agent used (self-report) |
| rungs_queried | list | derived from queries.log between task start/end markers |
| tests_selected, tests_ran, tests_full | int | from `pos impact --json` and CI |
| impact_misses | int | nightly: failures in full suite not in selected set, attributed to this PR |
| card_fail_first_push, ledger_fail_first_push | bool | CI records gate result of the first push |
| review_returns | int | times the PR went back to dev |
| diff_lines | int | `git diff --shortstat base...HEAD` |
| gate_seconds | float | CI timing |
| started_at, merged_at | iso | issue opened / PR merged |

## 4. Analysis
- Report medians and IQR, not means (token distributions are skewed).
- Compare `cbad` vs `control` for H2 with a Mann-Whitney U test when n ≥ 20 in cbad; before that, descriptive only.
- Every hypothesis is evaluated **once** at its pre-registered n; the evaluation is written to
  `docs/research/evidence/<date>-<id>.md` with the raw query used (`pos metrics report --json`).
- Negative results are published with the same prominence as positive ones.

## 5. Reporting
Phase 1 ends with `docs/research/evidence/phase1-report.md`: table of H1–H4, H7–H9 with n,
value, threshold, verdict; plus the "where it resisted" list from the ledger `debt` fields.
No claim appears in README or any publication without an entry in this folder.
