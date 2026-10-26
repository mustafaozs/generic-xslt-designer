---
name: adr
description: Record an architecture decision (ADR) in docs/adr when a design choice is made, an option is rejected, or a contract changes in a breaking way. Triggers - "why did we", "record this decision", "ADR", choosing between approaches.
allowed-tools: Bash Read Write
---

1. Next number: `ls docs/adr | tail -1`. File: `docs/adr/NNNN-<kebab-title>.md` from `.project-os/templates/ADR.md`.
2. Fill Bağlam (the problem, 2–3 sentences), Karar (one paragraph), Reddedilen seçenekler (each with one line why not), Sonuçlar.
3. Status starts as `proposed`; a human flips it to `accepted` in review. Never delete an ADR; supersede it.
4. Reference it from the ledger entry (`--adr ADR-NNNN`) and, if it changes a module's invariants, from that module's card.
