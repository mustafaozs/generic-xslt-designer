# Hypothesis register

Every claim in the design doc that could be false is listed here with the metric that would
falsify it, where the number comes from, and the threshold decided *before* data is collected.
Status moves only through evidence recorded in `docs/research/evidence/`. Thresholds are not
revised after seeing data; if one must change, it is recorded as a new hypothesis version.

Legend — Status: `proposed` → `measuring` → `supported` | `refuted` | `inconclusive`.
Source: `metrics` = `.project-os/metrics.jsonl` (per task), `queries` = `.project-os/queries.log`,
`ci` = gates workflow artefacts, `ledger` = `docs/ledger/`, `manual` = recorded by a human in evidence/.

| id | Claim (design doc §) | Metric | Source | Threshold (pre-registered) | Baseline | Status |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Agents stop at the card/contract rung for most tasks (§Erişim: "çoğu iş 3. basamakta biter") | share of tasks with `stopped_at ≤ 4` | metrics | ≥ 60 % over ≥ 20 tasks | none (new method) | measuring |
| H2 | Map + graph cut discovery cost (§Kanıt: RIG −53.9 % time) | input tokens per task, split `prefix` vs `discovery` vs `implementation` | metrics (`tokens_in`, `tokens_discovery`) | discovery share ≤ 30 % of input tokens, median over ≥ 20 tasks | measured in first 5 tasks *without* `pos` (control, see protocol) | measuring |
| H3 | Impact-selected tests catch what the full suite catches (§Doğrulama) | regressions found by nightly full suite that PR-selected tests missed | ci (`impact_misses`) | 0 misses in ≥ 30 PRs; 1 miss ⇒ inconclusive, 2 ⇒ refuted | — | measuring |
| H4 | Stale cards are rare once hash-gated (§İlke 3) | `card check` failures per PR at first push | ci | failure rate falls below 20 % by PR 20 (learning curve allowed) | — | measuring |
| H5 | Contract changes are caught before deploy in a consumer (§Projeler arası) | breaking contract changes detected by `pos diff`/impact vs. reaching deploy | ci + manual | 100 % of breaking changes flagged before merge in Phase 3 | — | proposed (Phase 3) |
| H6 | Ledger answers "what changed" cheaper than reading code (§Değişim defteri) | tokens spent to answer a "what changed since X" question with ledger vs. with git log + files | manual A/B, 5 questions | ledger ≤ 50 % of control tokens | control measured same day | proposed (Phase 2) |
| H7 | Gates reduce agent-caused rework (§İş akışı) | PRs returned to dev after review per 10 PRs | ledger (`debt`/review field) + ci | ≤ 2 per 10 PRs after PR 20 | first 10 PRs | measuring |
| H8 | Embedding is not needed at this scale (§Dışarıda bırakılanlar) | share of queries that fell to rung 5 (source) because symbol/graph gave nothing | queries | if > 25 % of tasks hit rung 5 for *semantic* reasons ⇒ add embedding (Phase 2 decision) | — | measuring |
| H9 | Kit overhead is small (§Maliyet) | wall time of `pos gate` in CI; token cost of PR-writer agent per PR | ci, metrics | gate ≤ 60 s; PR-writer ≤ 10 % of task tokens | — | measuring |

## Threats to validity (declared up front)
- **Single investigator, single team.** Results generalise only with Phase 3 (second project, ideally a second person).
- **No true control group.** Control = first 5 tasks of the pilot done in the same repo with `pos` disabled (protocol §2). Learning effects favour later tasks; reported as a limitation.
- **Model drift.** Record model id per task (`model` field); compare only within the same model.
- **Self-report.** `stopped_at` is reported by the agent itself; cross-check against `queries.log` (which rungs were actually queried) — disagreement is itself logged.
- **Task size confound.** Record `diff_lines`; normalise token metrics per 100 changed lines where sensible.
