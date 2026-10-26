---
name: gate
description: Run every CI gate locally before pushing - index, lint, card check, ledger check, impact-selected tests. Triggers - "am I done", "run the gates", "ready to push", "definition of done".
allowed-tools: Bash Read
---

`pos gate --base origin/main` runs index → lint → card check → ledger check and prints GATE PASS/FAIL.
Then run only the tests `pos impact --diff --base origin/main` lists.

All green → push and open the PR with the impact report, the ledger entry and the test command in the description.
Anything red → fix it with the matching skill (/card, /ledger, /adr). Do not push red; CI runs the same command and will block the merge.
