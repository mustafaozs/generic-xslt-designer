# ADR-0006: Conflict tag on every disagreement, and invalid contract references stop the agent

Date: 2026-10-30 · Status: accepted (owner, 2026-10-30; implemented in kit tag cbad-phase1-v2)

## Context
The first policy review (`docs/research/evidence/2026-10-30-policy-review.md`) found one disagreement that the ADR-0004 ledger grep did not see. In #12 the contract (rank 1) named `profile.watermark`, a field that does not exist; the dev agent implemented `derived.watermark` from the catalog and template, did not stop, and wrote the note on the debt line without the `conflict:` prefix. The contract still carries the stale text on `main`, and `auto_resolved` is 0 in every task record, so the rate of automatic resolutions cannot be measured.

## Decision
1. Any disagreement between two sources, whether resolved by rank, found at review, or resolved silently, is written on the ledger `debt` line as `conflict: <lower source> said X, <higher source> says Y — followed Y` (or `— stopped, asked`).
2. A higher source that points at something that does not exist (field, file, symbol) counts as "the higher source is silent": the agent stops and asks. It does not pick the lower source.
3. `pos metrics` derives `auto_resolved` from the task's ledger `conflict:` lines.

## Consequences
- The grep in `/policy-review` sees every conflict, so audits cover silent ones.
- One more ask in the rare stale-contract case, about 2 EUR at the configured rate, against a defect that otherwise stays open on `main`.
- Point 2 is already in the dev, reviewer and task-skill files (kit sync 2026-10-28); this ADR would put it in AGENTS.md. That edit needs human approval and is not made by the review.
- Evidence is n=1; revisit at the next review.
