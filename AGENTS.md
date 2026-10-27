# project-os — agent instructions (portable; CLAUDE.md imports this)

Contract-bounded agentic development. You never read the whole repo; you read
STATE.md, the last ledger entries, the symbol map, then the module cards you need.

## Start of every session
1. Read `STATE.md` (current goal, locked decisions, stop condition).
2. Run `pos ledger tail 10` (what changed recently).
3. Run `pos map` (symbol map summary, ~2k tokens). Do NOT open source files yet.

## Before changing code
- `pos impact <symbol|path>` first. Paste its output into the issue/PR.
- If it reports `blast: LARGE` or `contracts: CHANGED`, stop and ask a human.
- Read only the cards (`modules/<name>/CLAUDE.md`) of affected modules, then
  `contracts/` schemas. Open source files only when a card is not enough.

## Commands
- `pos index`            rebuild graph for changed files
- `pos query "<sql>"`    query .project-os/index.db
- `pos impact <target>`  reverse-dependency closure, affected tests
- `pos card check`       fail if any module card is stale
- `pos ledger check`     fail if HEAD lacks a ledger entry
- `pos lint`             orphan modules, missing contracts, oversized CLAUDE.md
- `pos metrics log`      record tokens/tests for this task

## Rules
- Every module has a card, a contract and tests. No exceptions; `pos lint` enforces it.
- Changing a file in `contracts/` requires human approval in the PR.
- Never edit `index.db` by hand. Never "fix" a quarantined test.
- When done: update the card if the module's public surface changed,
  write the ledger entry, update STATE.md. These are CI gates, not suggestions.

## Style
- Small PRs tied to one issue. Tests first when the task has acceptance criteria.
- Prefer running single tests over the full suite.
