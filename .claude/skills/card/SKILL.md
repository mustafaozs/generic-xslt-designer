---
name: card
description: Create or refresh a module card (modules/<name>/CLAUDE.md) after the module's public surface or invariants changed, or when `pos card check` reports STALE or MISSING. Triggers - "update the card", "stale card", "new module".
allowed-tools: Bash Read Edit Write
---

A card is ≤300 words and always has the same headings: Amaç, Public yüzey, Bağımlı olduğu, Ona bağımlı, Invariantlar, Testler, Son değişiklikler, hash.

New module: `pos index && pos card new <module>` prefills surface/deps/tests from the index; you fill Amaç (one sentence) and Invariantlar (2–4 rules that must never be violated). Then commit.

Stale card: `pos card check` tells you which. Open the card, compare "Public yüzey" with `pos query "SELECT name, signature FROM symbols WHERE file LIKE 'modules/<module>/%' AND exported=1"`, fix what changed (surface, deps, invariants), add a line under "Son değişiklikler" pointing to the ledger entry, then `pos card update <module>` to pin the hash. Never run `card update` without reviewing the content first — the hash is a promise that the card is true.
