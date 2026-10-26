# ADR-0001: Modules are bounded by contracts, not by code

Tarih: 2026-10-26
Durum: accepted
Modüller: all

## Bağlam
Agents and developers degrade as the codebase grows because they are asked to
change code inside a context larger than they can hold. Retrieval alone does not
fix this; the whole must never need to be read.

## Karar
Every module exposes a contract (schema in `contracts/`) and a card
(`modules/<name>/CLAUDE.md`). Other modules, agents and other projects see only
the contract and the card. `pos lint` rejects modules without either.

## Reddedilen seçenekler
- Embedding the whole repo and retrieving chunks: weak for code, degrades with size.
- LLM-extracted knowledge graphs: non-deterministic, stale edges; graph comes from tree-sitter.

## Sonuçlar
- Impact analysis is a graph query, available before any code is written.
- Cross-project interop is a contract-package diff, not a code read.
