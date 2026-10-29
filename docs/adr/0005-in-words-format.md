# ADR-0005: Amount-in-words format (Yalnız) for TRY and foreign currencies

Date: 2026-10-29 · Status: accepted (items marked *default* are proposed defaults, open to the owner's veto)
Decided by: repository owner (product decision, 2026-10-29)

## Context
`in-words-tr` prints the payable amount in words. Three questions were open: the prefix (`Yalnız:` vs `Yalnız` vs `YALNIZ`), the zero amount (#16 pinned "Sıfır TL"), and foreign currencies (#13 moved them to #28).

## Decision
1. Prefix: `Yalnız: ` (mixed case, colon, one space). Owner decision.
2. Zero amount: `0,00` renders `Yalnız: Sıfır TL Sıfır Kr`. Owner decision.
   - *default:* this applies to the zero amount only; other whole amounts keep their current form (e.g. `100,00` → `Yüz TL`). Changing that needs a new decision.
3. Foreign currencies use the ISO code as the currency word. Owner decision for EUR and GBP: `EUR`, `GBP`.
   - *default:* the same rule for USD (`USD`) and any other code, so one rule covers every currency; this replaces the earlier draft "ABD DOLARI … SENT" in #13/#28.
   - *default:* minor unit word: `Cent` for EUR and USD, `Pence` for GBP; any other currency prints the minor part as `<n>/100` (e.g. `Yalnız: Bin İki Yüz CHF 50/100`).
   - *default:* zero minor part for a foreign currency follows rule 2 by analogy only at amount 0 (`Sıfır EUR Sıfır Cent`).
4. TRY keeps `TL` / `Kr`.

## Consequences
- #16's test that pins `Sıfır TL` must change to `Sıfır TL Sıfır Kr` (done in #28 together with the currency work, since both touch `in-words-tr` and require an intentional, reviewed regeneration of every golden).
- #28 acceptance criteria use this ADR instead of "YALNIZ: … ABD DOLARI … SENT".
- Rank: an accepted ADR outranks STATE, cards and issues (AGENTS.md); the *default* items stay open until the owner confirms or changes them.
