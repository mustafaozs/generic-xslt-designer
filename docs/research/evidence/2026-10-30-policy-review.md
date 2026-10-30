# Policy review 2026-10-30

Run by the user on request, at 9 of 10 tasks (`pos policy-due`: "9 task(s) since last policy review"). First review: no earlier `*-policy-review.md`, so the window is every pilot task (control + cbad): #4 #10 #11 #12 #13 #14 #15 #16 #17. Setup tasks (#1 #3 #5) are excluded.

## Limits of this review
- The evidence file named by the skill and `project-os.toml`, `docs/research/2026-10-28-decision-allocation.md`, does not exist in the working tree or in git history. Step 4 is therefore compared against the rationale in ADR-0004 only. No `p_wrong` prior is available; none is invented here.
- n is tiny (2 tagged conflicts, 1 untagged). Nothing below is statistically supported; the proposals are limited to gaps shown by a concrete case.
- `metrics.jsonl` has no USD field. Tokens are reported raw; only human time is priced.

## 1. Conflict audit
`grep -n "conflict:" docs/ledger/*.md` returned two lines, plus one conflict the grep misses (row 3).

| # | Ledger | Sources | Resolution | Verdict | Evidence |
|---|---|---|---|---|---|
| 1 | #16, debt line | xslt-codegen card (rank 5) "Yalnız …" vs code and efatura-fixture test "Yalnız: " | followed code, card corrected in the same PR | correct | AGENTS.md card-vs-code clause: code covered by passing tests wins. ADR-0005 later set the same `Yalnız: ` format. |
| 2 | #13, debt line | issue AC1/AC2/AC4 (rank 6) vs source | dev STOP, human reduced scope (AC4 → #28, tryEquivalent → #27) | correct | The higher source was silent on scope, so "stop and ask" applied. Follow-ups #27 and #28 exist. |
| 3 | #12, debt (2), no `conflict:` tag | contract `profile.watermark` (rank 1) vs catalog, default template and code `derived.watermark` | dev implemented the lower source, no stop, no human ask | **wrong (process); reached main** | `contracts/gib-rules.md:19` still says `profile.watermark`; `modules/gib-rules/src/index.ts:144-145` checks `derived.watermark`. Metrics `deviation` for #12 says "dev resolved a conflict silently". |

Wrong ones on `main`, individually:
- **#12 REQ-EARSIV-NOTE.** The outcome (`derived.watermark`) is probably what the owner wants, since catalog, template and issue agree. The process was wrong: the contract wins over code, and a contract referencing a field that does not exist is the "higher source silent or invalid" branch, which means stop. Open since 2026-10-28. STATE.md lists it as an open question needing a human contract decision. Not fixed here (a contract change needs human approval).
- A corrective control already exists: kit sync "STOP-conflict rule in dev, reviewer and task skill" (ledger 2026-10-28) landed right after #12, and #13 then stopped correctly. That rule is in the agent files and the task skill, not in AGENTS.md.

The pre-ADR-0004 conflict (#12 kickoff: issue said CONTROL, `conditions.json` said cbad) was the origin of ADR-0004 and is not in the ledger grep.

## 2. Data quality
- `auto_resolved` is 0 in every task record. #16 (row 1) was an automatic resolution and #12 (row 3) a silent one. The metric undercounts, so the share of automatic resolutions cannot be computed from it.
- `review_returns` for #10 #11 #12 #13 #15 were added retroactively (ledger 2026-10-30), not measured live.
- #16 tokens exclude close-out work (re-review, CI fixes); #4 totals are inflated by the fable orchestrator ($11.74 of $12.54 per ledger); #17 includes 84.8k in / 14.1k out of unexplained fable usage.
- `pos metrics report` shows H7_review_returns_per_10 = 10.0 against a threshold of ≤ 2; the protocol evaluates it only after PR 20, so no verdict here. Returns are concentrated in #16 (1) and #17 (3).

## 3. Cost table
Human cost = `human_asks × 3 min` at 40 EUR/h (`project-os.toml` `human_rate_per_hour`) = 2 EUR per ask.

| Task | Cond. | tokens in | tokens out | cache_read | human_asks | auto_resolved | review_returns | Human cost (EUR) |
|---|---|---|---|---|---|---|---|---|
| #4 | control | 385,600 | 110,600 | 8,221,100 | 1 | 0 | 0 | 2 |
| #10 | control | 4,500 | 18,900 | 1,440,700 | 0 | 0 | 0 | 0 |
| #11 | control | 4,369 | 21,900 | 1,582,900 | 0 | 0 | 0 | 0 |
| #15 | control | 11,700 | 27,000 | 1,638,800 | 0 | 0 | 0 | 0 |
| #14 | control | 6,500 | 19,300 | 1,185,900 | 0 | 0 | 0 | 0 |
| #12 | cbad | 10,000 | 34,800 | 2,600,400 | 0 | 0 | 0 | 0 |
| #13 | cbad | 9,900 | 40,400 | 2,825,600 | 1 | 0 | 0 | 2 |
| #16 | cbad | 13,800 | 51,200 | 2,801,200 | 0 | 0 | 1 | 0 |
| #17 | cbad | 136,700 | 150,500 | 11,534,400 | 5 | 0 | 3 | 10 |
| **Total** | | 583,069 | 474,600 | 33,831,000 | 7 | 0 | 4 | **14** |

#17's five asks (per its deviation note): contract approval, stage-2/ledger, catalog property, card-fix permission, metrics-update permission. Contract approval is mandated by AGENTS.md and stays. The ledger and STATE do not show whether the last two were policy questions or harness permission prompts, so they cannot be classed as rule candidates from this data alone.

## 4. Allocation comparison
Without the evidence file, compare only the shape of cost: an ask costs 2 EUR; a wrong silent resolution leaves a stale contract open until a human notices.

| Class | Observed | Reading |
|---|---|---|
| card (5) vs code with passing tests | n=1, correct | keep automatic |
| issue (6) vs source feasibility | n=1, asked, scope decided by human | keep as ask; a scope cut is not decidable by rank |
| contract (1) references something that does not exist | n=1, resolved silently, still open on main | the kit now stops (STOP-conflict sync), but AGENTS.md does not say so and the ledger tag was missing |
| contract approval | 1 of #17's 5 asks | keep (mandated) |

At 2 EUR per ask, the one silent resolution in #12 (a contract defect open since 2026-10-28) outweighs any number of avoided asks in the observed data. No evidence supports moving a class from "ask" to "rule" yet.

## 5. Proposals
One ADR draft, `docs/adr/0006-conflict-tag-and-invalid-contract-reference.md` (status: proposed; numbering skips the existing 0003 gap):
1. The literal `conflict:` tag is required on the ledger debt line for any disagreement between sources, including silent ones found at review.
2. A contract that references a field or file that does not exist counts as "higher source silent or invalid": stop and ask, as the dev/reviewer/task files already do.
3. `auto_resolved` is derived from the ledger `conflict:` lines at metrics time, so the rate is computable.

Not proposed: moving any class to "ask" or to "rule" on current evidence.

## Follow-ups (not done here)
- Decide the #12 contract wording: `profile.watermark` vs `derived.watermark` (contract change, human approval).
- Fix the dangling reference to `docs/research/2026-10-28-decision-allocation.md` in `.claude/skills/policy-review/SKILL.md` and `project-os.toml`, or add the file (kit sync).
- Re-run this review at the next 10-task mark with `auto_resolved` populated.
