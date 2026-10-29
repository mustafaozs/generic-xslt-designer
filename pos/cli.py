"""`pos` command line. Every command is deterministic; none calls an LLM."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import gates, graph
from .indexer import index
from .repo import changed_files, find_root


def _print(ok: bool, msgs: list[str]) -> int:
    for m in msgs:
        print(m)
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    for s in (sys.stdout, sys.stderr):  # Windows consoles (cp1254) crash on → and Turkish letters
        try:
            s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    ap = argparse.ArgumentParser(prog="pos", description="project-os: contract-bounded agentic development kit")
    ap.add_argument("--root", type=Path, default=None, help="repo root (auto-detected)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pd = sub.add_parser("policy-due", help="is a /policy-review due? (counts control+cbad tasks, never setup)"); pd.add_argument("--every", type=int, default=10)
    sub.add_parser("index", help="(re)build the graph for changed files").add_argument("-v", action="store_true")
    sub.add_parser("map", help="symbol map summary (goes in the fixed prefix)")
    q = sub.add_parser("query", help="run SQL against .project-os/index.db"); q.add_argument("sql")
    im = sub.add_parser("impact", help="reverse-dependency closure for targets or the current diff")
    im.add_argument("targets", nargs="*", help="file path | module | symbol"); im.add_argument("--diff", action="store_true")
    im.add_argument("--base", default=None, help="git base ref for --diff (default: working tree vs HEAD)")
    im.add_argument("--json", action="store_true")

    c = sub.add_parser("card", help="module cards").add_subparsers(dest="sub", required=True)
    cc = c.add_parser("check"); cc.add_argument("modules", nargs="*")
    c.add_parser("update").add_argument("module")
    c.add_parser("new").add_argument("module")

    l = sub.add_parser("ledger", help="change ledger").add_subparsers(dest="sub", required=True)
    l.add_parser("tail").add_argument("n", nargs="?", type=int, default=10)
    lc = l.add_parser("check"); lc.add_argument("--base", default=None)
    la = l.add_parser("add"); la.add_argument("--issue", required=True); la.add_argument("--title", required=True)
    la.add_argument("--base", default=None); la.add_argument("--tokens-in", type=int, default=0)
    la.add_argument("--tokens-out", type=int, default=0); la.add_argument("--tests-ran", type=int, default=0)
    la.add_argument("--debt", default="none"); la.add_argument("--adr", default="none")

    sub.add_parser("lint", help="structural rules: cards, contracts, tests, sizes")
    g = sub.add_parser("gate", help="run every CI gate: index, lint, card check, ledger check"); g.add_argument("--base", default=None)

    m = sub.add_parser("metrics", help="task metrics").add_subparsers(dest="sub", required=True)
    ml = m.add_parser("log", help="one record per task (protocol §3)"); ml.add_argument("--issue", required=True)
    ml.add_argument("--condition", choices=["cbad", "control", "setup"], required=True); ml.add_argument("--model", default=None)
    ml.add_argument("--tokens-in", type=int, default=None); ml.add_argument("--tokens-out", type=int, default=None)
    ml.add_argument("--tokens-discovery", type=int, default=None, help="input tokens before first edit")
    ml.add_argument("--cache-read", type=int, default=None, help="prompt-cache read tokens (H9 prefix caching)")
    ml.add_argument("--stopped-at", type=int, default=None, help="deepest retrieval rung used (1-6)")
    ml.add_argument("--tests-selected", type=int, default=None); ml.add_argument("--tests-ran", type=int, default=None)
    ml.add_argument("--tests-full", type=int, default=None); ml.add_argument("--impact-misses", type=int, default=None)
    ml.add_argument("--card-fail-first-push", action="store_true", default=None); ml.add_argument("--ledger-fail-first-push", action="store_true", default=None)
    ml.add_argument("--review-returns", type=int, default=None); ml.add_argument("--gate-seconds", type=float, default=None)
    ml.add_argument("--human-asks", type=int, default=None); ml.add_argument("--auto-resolved", type=int, default=None)
    ml.add_argument("--diff-lines", type=int, default=None, help="override: insertions+deletions of the merged PR (git diff --shortstat M^1...M^2)")
    ml.add_argument("--deviation", default=None, help="protocol deviation, recorded verbatim (never edit metrics.jsonl by hand)")
    ml.add_argument("--base", default=None)
    mc = m.add_parser("check", help="gate: the issue must have a metrics record"); mc.add_argument("--issue", default=None)
    mr = m.add_parser("report"); mr.add_argument("--json", action="store_true")

    a = ap.parse_args(argv)
    root = find_root(a.root)

    if a.cmd == "policy-due":
        due, msg = gates.policy_due(root, a.every); print(("DUE: " if due else "not due: ") + msg); return 0
    if a.cmd == "index":
        s = index(root, verbose=a.v); print(json.dumps(s)); return 0
    if a.cmd == "map":
        out = graph.symbol_map(root); gates.log_query(root, "map", "", len(out)); print(out); return 0
    if a.cmd == "query":
        rows = graph.query(root, a.sql); gates.log_query(root, "query", a.sql, len(rows))
        for r in rows: print(json.dumps(r, ensure_ascii=False))
        return 0
    if a.cmd == "impact":
        targets = list(a.targets)
        if a.diff or not targets:
            targets += changed_files(root, a.base)
        if not targets:
            print("nothing to analyze (no targets, no diff)"); return 0
        rep = graph.impact(root, targets); gates.log_query(root, "impact", " ".join(targets), len(rep["affected"]))
        print(json.dumps(rep, ensure_ascii=False) if a.json else graph.format_impact(rep))
        return 2 if rep["blast"] == "LARGE" else 0
    if a.cmd == "card":
        if a.sub == "check": return _print(*gates.card_check(root, a.modules or None))
        if a.sub == "update": print(f"card {a.module} pinned to {gates.card_update(root, a.module)}"); return 0
        if a.sub == "new": print(f"wrote {gates.card_new(root, a.module)} — fill Amaç and Invariantlar, then commit"); return 0
    if a.cmd == "ledger":
        if a.sub == "tail": print(gates.ledger_tail(root, a.n)); return 0
        if a.sub == "check": return _print(*gates.ledger_check(root, a.base))
        if a.sub == "add":
            print(gates.ledger_add(root, a.issue, a.title, a.base, a.tokens_in, a.tokens_out, a.tests_ran, a.debt, a.adr)); return 0
    if a.cmd == "lint":
        return _print(*gates.lint(root))
    if a.cmd == "gate":
        if a.base is None:  # on a branch, a HEAD-only ledger check is the wrong question (2026-10-29 incident)
            from .repo import git as _git
            branch = _git(root, "rev-parse", "--abbrev-ref", "HEAD")
            if branch not in ("main", "master", "HEAD", "") and _git(root, "rev-parse", "--verify", "-q", "origin/main"):
                a.base = "origin/main"; print("base: origin/main (branch default)")
        index(root); ok = True
        for name, (o, msgs) in (("lint", gates.lint(root)), ("cards", gates.card_check(root)), ("ledger", gates.ledger_check(root, a.base)), ("metrics", gates.metrics_check(root, None))):
            print(f"--- {name}"); _print(o, msgs); ok = ok and o
        print("GATE PASS" if ok else "GATE FAIL"); return 0 if ok else 1
    if a.cmd == "metrics":
        if a.sub == "log":
            print(json.dumps(gates.metrics_log(root, issue=a.issue, condition=a.condition, model=a.model, tokens_in=a.tokens_in,
                tokens_out=a.tokens_out, tokens_discovery=a.tokens_discovery, cache_read=a.cache_read, stopped_at=a.stopped_at, tests_selected=a.tests_selected,
                tests_ran=a.tests_ran, tests_full=a.tests_full, impact_misses=a.impact_misses, card_fail_first_push=a.card_fail_first_push,
                ledger_fail_first_push=a.ledger_fail_first_push, review_returns=a.review_returns, gate_seconds=a.gate_seconds, base=a.base, deviation=a.deviation, diff_lines=a.diff_lines, human_asks=a.human_asks, auto_resolved=a.auto_resolved), ensure_ascii=False)); return 0
        if a.sub == "check": return _print(*gates.metrics_check(root, a.issue))
        if a.sub == "report": print(gates.metrics_report(root, a.json)); return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
