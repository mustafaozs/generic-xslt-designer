"""Mechanical gates: cards, ledger, lint, metrics. Each returns (ok, messages)."""
from __future__ import annotations

import json
import re
import time
from datetime import date
from pathlib import Path

from . import db as dbm
from .repo import (CONTRACTS_DIR, MODULES_DIR, changed_files, db_path, git, list_modules, module_hash, module_of)

ROOT_CLAUDE_MAX_LINES = 60
CARD_MAX_WORDS = 300


# ---------- cards ----------

def card_path(root: Path, module: str) -> Path:
    return root / MODULES_DIR / module / "CLAUDE.md"


def card_hash_in(text: str) -> str | None:
    m = re.search(r"^hash:\s*([0-9a-f]{8,})\s*$", text, re.M)
    return m.group(1) if m else None


def card_check(root: Path, modules: list[str] | None = None) -> tuple[bool, list[str]]:
    msgs, ok = [], True
    for m in modules or list_modules(root):
        p = card_path(root, m)
        if not p.is_file():
            ok = False
            msgs.append(f"MISSING card: {p.relative_to(root)}  → `pos card new {m}`")
            continue
        want, have = module_hash(root, m), card_hash_in(p.read_text())
        if have != want:
            ok = False
            msgs.append(f"STALE card: {m} (card {have or 'none'} ≠ code {want}) → review card, then `pos card update {m}`")
        else:
            msgs.append(f"ok card: {m}")
    return ok, msgs


def card_update(root: Path, module: str) -> str:
    p = card_path(root, module)
    text = p.read_text()
    h = module_hash(root, module)
    if card_hash_in(text):
        text = re.sub(r"^hash:.*$", f"hash: {h}", text, flags=re.M)
    else:
        text = text.rstrip() + f"\n\nhash: {h}\n"
    p.write_text(text)
    return h


def card_new(root: Path, module: str) -> Path:
    """Prefill a card from the index: public symbols, deps, dependents, tests."""
    con = dbm.connect(db_path(root))
    syms = con.execute("""SELECT s.name, s.signature FROM symbols s JOIN files f ON f.path=s.file
                          WHERE f.module=? AND f.is_test=0 AND s.exported=1 AND s.kind!='method' ORDER BY s.name""", (module,)).fetchall()
    deps = con.execute("""SELECT DISTINCT b.module FROM edges e JOIN files a ON a.path=e.src JOIN files b ON b.path=e.dst
                          WHERE a.module=? AND b.module IS NOT NULL AND b.module!=?""", (module, module)).fetchall()
    rdeps = con.execute("""SELECT DISTINCT a.module FROM edges e JOIN files a ON a.path=e.src JOIN files b ON b.path=e.dst
                           WHERE b.module=? AND a.module IS NOT NULL AND a.module!=?""", (module, module)).fetchall()
    tests = con.execute("SELECT path FROM files WHERE module=? AND is_test=1", (module,)).fetchall()
    con.close()
    tpl = (root / ".project-os" / "templates" / "CARD.md").read_text()
    surface = "\n".join(f"- `{s['signature']}`" for s in syms) or "- (none exported yet)"
    text = (tpl.replace("{module}", module)
            .replace("{one sentence}", "TODO: one sentence")
            .replace("- {signature}", surface)
            .replace("Bağımlı olduğu: {modules}", "Bağımlı olduğu: " + (", ".join(d["module"] for d in deps) or "-"))
            .replace("Ona bağımlı: {modules}", "Ona bağımlı: " + (", ".join(d["module"] for d in rdeps) or "-"))
            .replace("- {rule}", "- TODO")
            .replace("{path}", ", ".join(t["path"] for t in tests) or "TODO")
            .replace("- {ledger link}", "- (none yet)")
            .replace("{hash}", module_hash(root, module)))
    p = card_path(root, module)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    return p


# ---------- ledger ----------

def ledger_file(root: Path, d: date | None = None) -> Path:
    d = d or date.today()
    p = root / "docs" / "ledger" / f"{d:%Y-%m}.md"
    if not p.is_file():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"# Ledger {d:%Y-%m}\n\nNewest first. One entry per merge.\n")
    return p


def ledger_tail(root: Path, n: int = 10) -> str:
    files = sorted((root / "docs" / "ledger").glob("*.md"), reverse=True)
    entries = []
    for f in files:
        parts = re.split(r"^(?=## )", f.read_text(), flags=re.M)
        entries += [p.strip() for p in parts if p.startswith("## ")]
        if len(entries) >= n:
            break
    return "\n\n".join(entries[:n]) or "(ledger empty)"


def ledger_check(root: Path, base: str | None = None) -> tuple[bool, list[str]]:
    """HEAD (or every non-merge commit in base..HEAD) must be referenced by a ledger entry."""
    shas = git(root, "rev-list", "--no-merges", f"{base}..HEAD").split() if base else [git(root, "rev-parse", "HEAD")]
    shas = [s for s in shas if s]
    if not shas:
        return True, ["no commits to check"]
    text = "\n".join(p.read_text() for p in (root / "docs" / "ledger").glob("*.md"))

    def recorded(s: str) -> bool:
        # either referenced by sha, or the commit itself adds/changes a ledger entry (self-recording)
        if s[:7] in text:
            return True
        touched = git(root, "show", "--name-only", "--format=", s)
        return "docs/ledger/" in touched

    missing = [s[:7] for s in shas if not recorded(s)]
    if missing:
        return False, [f"MISSING ledger entry for commit(s): {', '.join(missing)} → `pos ledger add --issue <#>`"]
    return True, [f"ok ledger: {len(shas)} commit(s) recorded"]


def ledger_add(root: Path, issue: str, title: str, base: str | None = None,
               tokens_in: int = 0, tokens_out: int = 0, tests_ran: int = 0, debt: str = "none",
               adr: str = "none", contracts: str | None = None) -> str:
    # The entry ships inside the commit it describes, so it cannot know that sha; the commit that
    # touches docs/ledger/ is self-recording for `ledger check`. We record the parent for traceability.
    sha = "(this commit) after " + (git(root, "rev-parse", "--short", "HEAD") or "root")
    files = changed_files(root, base) or changed_files(root, "HEAD~1")  # clean tree → describe the last commit
    modules = sorted({m for m in (module_of(f) for f in files) if m}) or ["-"]
    if contracts is None:
        contracts = "changed (review!)" if any(f.startswith(f"{CONTRACTS_DIR}/") for f in files) else "unchanged"
    tpl = (root / ".project-os" / "templates" / "LEDGER.md").read_text()
    entry = (tpl.replace("{date}", f"{date.today():%Y-%m-%d}").replace("{issue}", issue).replace("{title}", title)
             .replace("{sha}", sha).replace("{modules}", ", ".join(modules))
             .replace("unchanged | changed (breaking|compatible)", contracts)
             .replace("{ADR ids or none}", adr)
             .replace("+{added} ~{changed} ran:{count}", f"ran:{tests_ran}")
             .replace("{in}", str(tokens_in)).replace("{out}", str(tokens_out))
             .replace("{remaining debt or none}", debt))
    p = ledger_file(root)
    text = p.read_text()
    head, _, rest = text.partition("\n## ")
    new = head.rstrip() + "\n\n" + entry.strip() + "\n" + ("\n## " + rest if rest else "")
    p.write_text(new)
    return entry


# ---------- lint ----------

def lint(root: Path) -> tuple[bool, list[str]]:
    msgs, ok = [], True
    rc = root / "CLAUDE.md"
    if rc.is_file():
        n = len(rc.read_text().splitlines())
        if n > ROOT_CLAUDE_MAX_LINES:
            ok = False
            msgs.append(f"root CLAUDE.md has {n} lines (> {ROOT_CLAUDE_MAX_LINES}): move detail into module cards")
    else:
        ok = False
        msgs.append("missing root CLAUDE.md")
    mods = list_modules(root)
    if not mods:
        msgs.append("warning: no modules under modules/")
    con = dbm.connect(db_path(root))
    for m in mods:
        if not card_path(root, m).is_file():
            ok = False
            msgs.append(f"{m}: no card (modules/{m}/CLAUDE.md)")
        else:
            words = len(card_path(root, m).read_text().split())
            if words > CARD_MAX_WORDS:
                ok = False
                msgs.append(f"{m}: card has {words} words (> {CARD_MAX_WORDS}); move detail to a skill or docs")
        if not list((root / CONTRACTS_DIR).glob(f"{m}.*")):
            ok = False
            msgs.append(f"{m}: no contract (contracts/{m}.<openapi|proto|json|md>)")
        has_tests = con.execute("SELECT 1 FROM files WHERE module=? AND is_test=1 LIMIT 1", (m,)).fetchone()
        if not has_tests:
            ok = False
            msgs.append(f"{m}: no tests indexed")
    # cross-module imports into a module's non-public file are allowed only if that module has a contract (checked above)
    rows = con.execute("""SELECT a.module am, b.module bm, COUNT(*) n FROM edges e JOIN files a ON a.path=e.src JOIN files b ON b.path=e.dst
                          WHERE a.module IS NOT NULL AND b.module IS NOT NULL AND a.module!=b.module GROUP BY am, bm""").fetchall()
    for r in rows:
        msgs.append(f"info: {r['am']} → {r['bm']} ({r['n']} import edges) — ensure contracts/{r['bm']}.* covers what is used")
    con.close()
    if ok:
        msgs.insert(0, "ok lint")
    return ok, msgs


# ---------- metrics / query log ----------

def log_query(root: Path, kind: str, arg: str, result_size: int) -> None:
    p = root / ".project-os" / "queries.log"
    with p.open("a") as f:
        f.write(json.dumps({"t": int(time.time()), "kind": kind, "arg": arg, "size": result_size}) + "\n")


def metrics_log(root: Path, **fields) -> dict:
    rec = {"t": int(time.time()), "date": f"{date.today():%Y-%m-%d}", **fields}
    p = root / ".project-os" / "metrics.jsonl"
    with p.open("a") as f:
        f.write(json.dumps(rec) + "\n")
    return rec


def metrics_report(root: Path) -> str:
    p = root / ".project-os" / "metrics.jsonl"
    if not p.is_file():
        return "no metrics yet"
    recs = [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    n = len(recs)
    tin = sum(r.get("tokens_in", 0) for r in recs)
    tout = sum(r.get("tokens_out", 0) for r in recs)
    tests = sum(r.get("tests_ran", 0) for r in recs)
    levels = {}
    for r in recs:
        levels[r.get("stopped_at", "?")] = levels.get(r.get("stopped_at", "?"), 0) + 1
    lines = [f"tasks: {n}", f"tokens in/out total: {tin}/{tout}  per task: {tin // max(n,1)}/{tout // max(n,1)}",
             f"tests ran per task: {tests / max(n,1):.1f}", "retrieval level where the agent stopped: " +
             ", ".join(f"{k}={v}" for k, v in sorted(levels.items()))]
    return "\n".join(lines)
