---
name: ledger
description: Write the change-ledger entry for the current task before opening or finishing a PR. Triggers - "ledger", "write the changelog entry", finishing a task, `pos ledger check` failing.
allowed-tools: Bash Read Edit
---

1. Make sure your commit exists (`git log -1`). The entry references its sha.
2. `pos ledger add --issue <#N> --title "<short title>" --tests-ran <n> [--adr ADR-000X] [--debt "..."] [--tokens-in N --tokens-out N]`
   It fills date, sha, touched modules and the contract flag from the diff.
3. Open the new entry at the top of `docs/ledger/<YYYY-MM>.md` and correct anything the script could not know: contracts `breaking` vs `compatible`, real debt left behind.
4. Amend or add a commit so the ledger entry is in the PR. `pos ledger check --base origin/main` must pass.

An entry is 8 lines. If you need more, the task was too big for one PR.
