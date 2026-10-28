---
name: policy-review
description: Periodic review of who decides what (agent rule vs human). Run every 10 merged tasks or at the end of a phase, never inside a task. Reads the ledger conflict lines and metrics, compares with the evidence in docs/research/2026-10-28-decision-allocation.md, and proposes changes as an ADR draft for a human. Triggers - "policy review", "who should decide", "too many questions", "/policy-review".
allowed-tools: Bash Read
---

This is an offline review, not a runtime judge: it runs rarely, so its cost stays small, and it changes the rules only through an ADR a human approves.

1. Collect: `grep -n "conflict:" docs/ledger/*.md`; `pos metrics report --json`; for each task since the last review: `human_asks`, `auto_resolved`, `review_returns`, escaped defects.
2. Audit each `conflict:` line: was following the higher source right? Mark correct / wrong / unclear with one sentence of evidence. Wrong ones that reached `main` are listed individually.
3. Cost table: per task, token cost and `human_asks × 3 min` (rate from `project-os.toml` `[policy] human_rate_per_hour`, default 40).
4. Compare with the evidence file: where would a different allocation lower expected cost (`p_wrong × cost_wrong` vs `cost_ask`)? Typical moves: a conflict class that is often wrong → back to "ask"; a question class that is always answered the same way → turn into a rule.
5. Output: `docs/research/evidence/<date>-policy-review.md` with the tables, and if a change is proposed, an ADR draft (`docs/adr/NNNN-…`, status: proposed). Never edit AGENTS.md or the precedence rule directly.
