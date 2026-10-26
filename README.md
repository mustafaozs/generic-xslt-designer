# Contract-Bounded Agentic Development

A development kit and a discipline for building software with AI coding agents
on codebases that outgrow any single context window.

**Thesis.** Agents and developers degrade as code grows for the same reason:
they are asked to change something inside a context larger than they can hold.
The fix is not a bigger window or better retrieval. The fix is a structure in
which *nobody ever needs to read the whole thing*, because the whole lives in
a registry of contracts, not in anyone's head.

## Principles (each one is a CI gate, not advice)

1. **Modules are bounded by contracts, not by code.** Every module has a schema in `contracts/` and a card in `modules/<name>/CLAUDE.md`. Others see only those. — `pos lint`
2. **The map is deterministic.** The dependency graph comes from tree-sitter, never from an LLM. — `pos index`
3. **Impact before implementation.** The reverse-dependency closure is computed before a line is written; a large blast radius or a contract change stops the agent. — `pos impact`
4. **Memory is derived and hash-pinned.** A card is a promise that it is true; the promise is the module's content hash. A stale card fails the build. — `pos card check`
5. **"What changed" is a ledger, not a git log.** One 8-line entry per merge; agents read the last ten at session start. — `pos ledger check`
6. **Retrieval is a ladder.** Symbol map → graph → cards → contracts → source → partial call graph. The agent stops at the first rung that is enough and logs where it stopped. — `pos metrics`
7. **Mechanical work is scripts, judgement is agents, irreversible decisions are humans.** Autonomy is earned per module from ledger metrics, never granted up front.
8. **Anything left to human will is treated as absent.** If it is not checked by CI it does not exist.

## Layout

```
CLAUDE.md            stable instructions (≤60 lines, gate)   STATE.md   current state (highest authority)
modules/<name>/      code + CLAUDE.md card + tests           contracts/ one schema per module
docs/adr/            decisions, never deleted                docs/ledger/YYYY-MM.md  one entry per merge
docs/quality.md      A–D grade per module                    .project-os/index.db    the graph (generated)
.claude/skills/      impact · card · ledger · adr · gate     .claude/agents/  ba · pr-writer · reviewer
.github/workflows/gates.yml   the gates, run on every PR
```

## Quick start

```bash
pip install -e .
pos index && pos map                 # the 2k-token map that lives in the fixed prefix
pos impact Invoice                   # who breaks if Invoice changes, which tests to run
pos card new billing                 # prefilled card from the index; fill Amaç + Invariantlar
pos gate --base origin/main          # everything CI will check
```

Use it as a template: copy the kit, move your code under `modules/`, write one contract per module, run `pos card new` for each. `pos lint` tells you what is missing.

## Status

Phase 0 — skeleton. Evidence (token/task, tests/PR, where the agent stopped on the ladder) is collected from day one in `.project-os/metrics.jsonl`; the method will be published together with numbers from the pilot, not before.

Design document and evidence base: see `docs/adr/0001` and the design doc linked in the repo wiki.

## Deliberately not included

Vector DB on day 0, LLM-built knowledge graphs, global function-level graph, multi-agent orchestration, 30-tool setup scripts, one giant AGENTS.md, agent frameworks. Each has a measured reason in the design doc; each has a condition under which it gets reconsidered.
