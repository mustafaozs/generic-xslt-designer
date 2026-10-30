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
        want, have = module_hash(root, m), card_hash_in(p.read_text(encoding="utf-8"))
        if have != want:
            ok = False
            msgs.append(f"STALE card: {m} (card {have or 'none'} ≠ code {want}) → review card, then `pos card update {m}`")
        else:
            msgs.append(f"ok card: {m}")
    return ok, msgs


def card_update(root: Path, module: str) -> str:
    p = card_path(root, module)
    text = p.read_text(encoding="utf-8")
    h = module_hash(root, module)
    if card_hash_in(text):
        text = re.sub(r"^hash:.*$", f"hash: {h}", text, flags=re.M)
    else:
        text = text.rstrip() + f"\n\nhash: {h}\n"
    p.write_text(text, encoding="utf-8")
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
    tpl = (root / ".project-os" / "templates" / "CARD.md").read_text(encoding="utf-8")
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
    p.write_text(text, encoding="utf-8")
    return p


# ---------- ledger ----------

def ledger_file(root: Path, d: date | None = None) -> Path:
    d = d or date.today()
    p = root / "docs" / "ledger" / f"{d:%Y-%m}.md"
    if not p.is_file():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"# Ledger {d:%Y-%m}\n\nNewest first. One entry per merge.\n", encoding="utf-8")
    return p


def ledger_tail(root: Path, n: int = 10) -> str:
    files = sorted((root / "docs" / "ledger").glob("*.md"), reverse=True)
    entries = []
    for f in files:
        parts = re.split(r"^(?=## )", f.read_text(encoding="utf-8"), flags=re.M)
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
    text = "\n".join(p.read_text(encoding="utf-8") for p in (root / "docs" / "ledger").glob("*.md"))

    def recorded(s: str) -> bool:
        # either referenced by sha, or the commit itself adds/changes a ledger entry (self-recording)
        if s[:7] in text:
            return True
        touched = git(root, "show", "--name-only", "--format=", s)
        return "docs/ledger/" in touched

    # One entry per merge: if any commit in base..HEAD writes the ledger, that entry covers the whole
    # branch. Follow-up commits (metrics, token fill-in, review fixes) need no sha bookkeeping.
    if base and any("docs/ledger/" in git(root, "show", "--name-only", "--format=", s) for s in shas):
        return True, [f"ok ledger: {len(shas)} commit(s) covered by this branch's ledger entry"]
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
    tpl = (root / ".project-os" / "templates" / "LEDGER.md").read_text(encoding="utf-8")
    entry = (tpl.replace("{date}", f"{date.today():%Y-%m-%d}").replace("{issue}", issue).replace("{title}", title)
             .replace("{sha}", sha).replace("{modules}", ", ".join(modules))
             .replace("unchanged | changed (breaking|compatible)", contracts)
             .replace("{ADR ids or none}", adr)
             .replace("+{added} ~{changed} ran:{count}", f"ran:{tests_ran}")
             .replace("{in}", str(tokens_in)).replace("{out}", str(tokens_out))
             .replace("{remaining debt or none}", debt))
    p = ledger_file(root)
    text = p.read_text(encoding="utf-8")
    head, _, rest = text.partition("\n## ")
    new = head.rstrip() + "\n\n" + entry.strip() + "\n" + ("\n## " + rest if rest else "")
    p.write_text(new, encoding="utf-8")
    return entry


# ---------- lint ----------

def lint(root: Path) -> tuple[bool, list[str]]:
    msgs, ok = [], True
    rc = root / "CLAUDE.md"
    if rc.is_file():
        n = len(rc.read_text(encoding="utf-8").splitlines())
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
            words = len(card_path(root, m).read_text(encoding="utf-8").split())
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
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"t": int(time.time()), "kind": kind, "arg": arg, "size": result_size}) + "\n")


def metrics_log(root: Path, **fields) -> dict:
    """One record per task. Adds diff size and the rungs actually queried (from queries.log)."""
    rec = {"t": int(time.time()), "date": f"{date.today():%Y-%m-%d}"}
    rec.update({k: v for k, v in fields.items() if v is not None})
    kv = root / ".project-os" / "kit-version"
    if kv.exists():  # protocol v1.6: block-2 records carry the kit tag they ran on
        rec["kit_version"] = kv.read_text(encoding="utf-8").strip()
    stat = git(root, "diff", "--shortstat", "HEAD~1") if not fields.get("base") else git(root, "diff", "--shortstat", f"{fields['base']}...HEAD")
    m = re.findall(r"(\d+) (?:insertion|deletion)", stat)
    explicit_diff = fields.get("diff_lines") is not None
    if not explicit_diff:
        rec["diff_lines"] = sum(int(x) for x in m)
    rec["rungs_queried"] = _rungs_since_last_record(root)
    p = root / ".project-os" / "metrics.jsonl"
    recs = _records(root)
    issue = str(rec.get("issue"))
    existing = next((r for r in recs if str(r.get("issue")) == issue), None)
    if existing is not None:
        # upsert: keep earlier non-null fields, overwrite with newly supplied ones
        # keep the original diff size and query rungs: they describe the task's branch at first log time,
        # a later token-only update may run from another branch
        # diff_lines is re-measured only when the caller says against what: --base or an explicit --diff-lines
        protected = ("t", "date", "rungs_queried") + (() if (explicit_diff or fields.get("base")) else ("diff_lines",))
        update = {k: v for k, v in rec.items() if v is not None and k not in protected}
        merged = {**existing, **update}
        merged["updated_t"] = rec["t"]
        recs = [merged if str(r.get("issue")) == issue else r for r in recs]
        p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in recs), encoding="utf-8")
        return merged
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec


_RUNG = {"map": 1, "query": 2, "impact": 2, "card": 3, "contract": 4, "read": 5}


def _rungs_since_last_record(root: Path) -> list[int]:
    """Which retrieval rungs queries.log shows since the previous metrics record (cross-check for self-reported stopped_at)."""
    mp = root / ".project-os" / "metrics.jsonl"
    since = 0
    if mp.is_file():
        lines = [l for l in mp.read_text(encoding="utf-8").splitlines() if l.strip()]
        if lines:
            since = json.loads(lines[-1]).get("t", 0)
    qp = root / ".project-os" / "queries.log"
    rungs = set()
    if qp.is_file():
        for l in qp.read_text(encoding="utf-8").splitlines():
            try:
                q = json.loads(l)
            except ValueError:
                continue
            if q.get("t", 0) >= since and q.get("kind") in _RUNG:
                rungs.add(_RUNG[q["kind"]])
    return sorted(rungs)


def _records(root: Path) -> list[dict]:
    p = root / ".project-os" / "metrics.jsonl"
    if not p.is_file():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def metrics_check(root: Path, issue: str | None) -> tuple[bool, list[str]]:
    """Gate: the task being merged must have a metrics record."""
    recs = _records(root)
    if issue is None:
        return (bool(recs), [f"{len(recs)} metrics record(s)" if recs else "MISSING metrics: no records at all → `pos metrics log --issue <#>`"])
    hit = [r for r in recs if str(r.get("issue")) == str(issue)]
    if not hit:
        return False, [f"MISSING metrics record for issue {issue} → `pos metrics log --issue {issue} ...` (protocol §1)"]
    return True, [f"ok metrics: issue {issue} recorded ({hit[-1].get('condition', '?')}, stopped_at={hit[-1].get('stopped_at', '?')})"]


def _median(xs):
    xs = sorted(x for x in xs if isinstance(x, (int, float)))
    if not xs:
        return None
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def metrics_report(root: Path, as_json: bool = False) -> str:
    """Per-hypothesis numbers from docs/research/hypotheses.md. Descriptive only; verdicts are written by a human into evidence/."""
    recs = _records(root)
    cbad = [r for r in recs if r.get("condition") == "cbad"]  # setup and unlabelled records are excluded from both arms
    ctrl = [r for r in recs if r.get("condition") == "control"]

    def share(rs, pred):
        return (sum(1 for r in rs if pred(r)) / len(rs)) if rs else None

    def disc_share(r):
        ti, td = r.get("tokens_in") or 0, r.get("tokens_discovery")
        return (td / ti) if ti and td is not None else None

    rep = {
        "n_total": len(recs), "n_cbad": len(cbad), "n_control": len(ctrl),
        "H1_share_stopped_at_le4": share(cbad, lambda r: isinstance(r.get("stopped_at"), int) and r["stopped_at"] <= 4),
        "H1_selfreport_vs_log_disagreements": sum(1 for r in cbad if isinstance(r.get("stopped_at"), int) and r.get("rungs_queried") and max(r["rungs_queried"]) > r["stopped_at"]),
        "H2_median_tokens_in_cbad": _median(r.get("tokens_in") for r in cbad),
        "H2_median_tokens_in_control": _median(r.get("tokens_in") for r in ctrl),
        "H2_median_discovery_share_cbad": _median(x for x in (disc_share(r) for r in cbad) if x is not None),
        "H2_median_discovery_share_control": _median(x for x in (disc_share(r) for r in ctrl) if x is not None),
        "H2_median_tokens_per_100_lines_cbad": _median((r["tokens_in"] / max(r.get("diff_lines", 0), 1) * 100) for r in cbad if r.get("tokens_in")),
        "H3_impact_misses_total": sum(r.get("impact_misses", 0) or 0 for r in cbad),
        "H3_tests_ran_vs_full_median_ratio": _median((r["tests_ran"] / r["tests_full"]) for r in cbad if r.get("tests_full")),
        "H4_card_fail_first_push_rate": share(cbad, lambda r: r.get("card_fail_first_push") is True),
        "H7_review_returns_per_10": (sum(r.get("review_returns", 0) or 0 for r in cbad) / len(cbad) * 10) if cbad else None,
        "H8_share_hit_rung5": share(cbad, lambda r: 5 in (r.get("rungs_queried") or []) or r.get("stopped_at") == 5),
        "H9_median_gate_seconds": _median(r.get("gate_seconds") for r in cbad),
        "H9_median_cache_share": _median((r["cache_read"] / (r["cache_read"] + r["tokens_in"])) for r in cbad if r.get("cache_read") and r.get("tokens_in")),
        "models": sorted({r.get("model", "?") for r in recs}),
    }
    if as_json:
        return json.dumps(rep, ensure_ascii=False, indent=1)
    lines = [f"tasks: {rep['n_total']} (cbad {rep['n_cbad']}, control {rep['n_control']})  models: {', '.join(rep['models'])}"]
    for k, v in rep.items():
        if k.startswith("H"):
            lines.append(f"{k}: {v if v is None or isinstance(v, int) else round(v, 3)}")
    return "\n".join(lines)


def policy_due(root: Path, every: int = 10) -> tuple[bool, str]:
    """Mechanical count for the /policy-review reminder: pilot tasks (control or cbad, not setup) recorded
    after the newest evidence/*-policy-review.md (by its YYYY-MM-DD prefix)."""
    reviews = sorted((root / "docs" / "research" / "evidence").glob("*-policy-review.md"))
    since = reviews[-1].name[:10] if reviews else ""
    n = sum(1 for r in _records(root) if r.get("condition") in ("control", "cbad") and str(r.get("date", "")) > since)
    return n >= every, f"{n} task(s) since last policy review{(' (' + since + ')') if since else ''}; due at {every}"


def run_extra_gates(root: Path) -> bool:
    """Project-specific checks that CI runs and `pos gate` must run too, so a local PASS means CI PASS
    (2026-10-29 incident, #16: local gate green, CI red on typecheck and privacy guard).
    One shell command per line in .project-os/gate-extra.txt; blank lines and # comments ignored."""
    import subprocess
    f = root / ".project-os" / "gate-extra.txt"
    if not f.exists():
        return True
    ok = True
    for line in f.read_text(encoding="utf-8").splitlines():
        cmd = line.strip()
        if not cmd or cmd.startswith("#"):
            continue
        r = subprocess.run(cmd, shell=True, cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(f"--- extra: {cmd}")
        if r.returncode != 0:
            print("\n".join((r.stdout + r.stderr).strip().splitlines()[-15:]))
            print(f"FAIL extra: {cmd} (exit {r.returncode})"); ok = False
        else:
            print("ok")
    return ok


def ledger_conflicts(root: Path, issue: str) -> list[str]:
    """`conflict:` items in the ledger entries of one issue (ADR-0006). auto_resolved is the number that end in
    "followed <higher source>"; "stopped, asked" ones are human asks. Counted by code, never by the model."""
    out = []
    for p in sorted((root / "docs" / "ledger").glob("*.md")):
        entry_issue = None
        for line in p.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^## \S+ · (#\d+|none|chore) ·", line)
            if m:
                entry_issue = m.group(1); continue
            if entry_issue == issue:
                out += [c.strip() for c in re.findall(r"conflict:[^;]*", line)]
    return out

