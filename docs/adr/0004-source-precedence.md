# ADR-0004: Precedence of sources when they disagree

Date: 2026-10-28 · Status: accepted

## Context
On the first cbad task (#12) the issue body, written by the ba agent before the condition draw, said "CONTROL task"; `.project-os/conditions.json`, written after the frozen draw, said `cbad`. The orchestrator correctly stopped and asked. Asking was safe but costs a human round-trip for a conflict whose answer was already fixed by an earlier, higher-authority decision. As the project grows, stale lower sources (issues, prompts, STATE) will disagree with higher ones routinely.

## Decision
A fixed rank of sources, written in AGENTS.md: contracts > conditions/protocol > ADRs > STATE > cards > issue > prompt. Across ranks the higher source wins automatically, the lower text is removed from agent briefs, and the conflict is logged on the ledger `debt` line. Same-rank conflicts, silence of the higher source, and irreversible actions (contract change, force-push, merge, deletion) still stop for a human.

## Consequences
- Fewer interruptions; every resolution is still visible in the ledger.
- A wrong high-rank source now propagates silently, so high-rank files are the ones that change only through review (contracts need human approval; conditions and protocol are guarded by `research_guard.py`).
- The ba agent no longer writes conditions into issues, which removes the most common source of this conflict at the root.
