"""Graph queries: symbol map, reverse closure, impact report."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from . import db as dbm
from .repo import CONTRACTS_DIR, db_path, list_modules, module_of


def _con(root: Path) -> sqlite3.Connection:
    return dbm.connect(db_path(root))


def resolve_targets(con: sqlite3.Connection, target: str) -> list[str]:
    """A target is a file path, a module name, or a symbol name. Returns file paths."""
    rows = con.execute("SELECT path FROM files WHERE path=? OR path LIKE ?", (target, f"%/{target}")).fetchall()
    if rows:
        return [r["path"] for r in rows]
    rows = con.execute("SELECT path FROM files WHERE module=?", (target,)).fetchall()
    if rows:
        return [r["path"] for r in rows]
    rows = con.execute("SELECT DISTINCT file FROM symbols WHERE name=? OR name LIKE ?", (target, f"%.{target}")).fetchall()
    return [r["file"] for r in rows]


def reverse_closure(con: sqlite3.Connection, files: list[str], max_depth: int = 20) -> dict[str, int]:
    """Files that (transitively) import any of `files`. Returns {path: depth}."""
    depth = {f: 0 for f in files}
    frontier = list(files)
    for d in range(1, max_depth + 1):
        if not frontier:
            break
        q = ",".join("?" * len(frontier))
        rows = con.execute(f"SELECT DISTINCT src FROM edges WHERE dst IN ({q})", frontier).fetchall()
        nxt = [r["src"] for r in rows if r["src"] not in depth]
        for f in nxt:
            depth[f] = d
        frontier = nxt
    return depth


def impact(root: Path, targets: list[str], large_modules: int = 5) -> dict:
    con = _con(root)
    target_files: list[str] = []
    unresolved: list[str] = []
    for t in targets:
        fs = resolve_targets(con, t)
        if fs:
            target_files += fs
        elif t.startswith(f"{CONTRACTS_DIR}/") or t.endswith((".md", ".yaml", ".yml", ".json")):
            target_files.append(t)  # non-source file, still counts (contracts!)
        else:
            unresolved.append(t)
    target_files = sorted(set(target_files))
    closure = reverse_closure(con, [f for f in target_files])
    affected = sorted(closure, key=lambda f: (closure[f], f))
    tests = [f for f in affected if con.execute("SELECT is_test FROM files WHERE path=?", (f,)).fetchone() and
             con.execute("SELECT is_test FROM files WHERE path=?", (f,)).fetchone()[0]]
    modules = sorted({m for m in (module_of(f) for f in affected) if m})
    contracts = [f for f in target_files if f.startswith(f"{CONTRACTS_DIR}/")]
    # a module whose contract file is touched: every consumer module is affected
    for c in contracts:
        name = Path(c).name.split(".")[0]
        modules.append(name) if name in list_modules(root) else None
        for m in list_modules(root):
            if m != name and _module_imports_module(con, m, name):
                modules.append(m)
    modules = sorted(set(modules))
    blast = "LARGE" if len(modules) >= large_modules or contracts else ("MEDIUM" if len(modules) >= 2 else "SMALL")
    con.close()
    return {"targets": target_files, "unresolved": unresolved, "affected": affected, "depth": closure,
            "modules": modules, "tests": tests, "contracts": contracts, "blast": blast}


def _module_imports_module(con, src_mod: str, dst_mod: str) -> bool:
    row = con.execute("""SELECT 1 FROM edges e JOIN files a ON a.path=e.src JOIN files b ON b.path=e.dst
                         WHERE a.module=? AND b.module=? LIMIT 1""", (src_mod, dst_mod)).fetchone()
    return row is not None


def format_impact(rep: dict) -> str:
    out = ["## Impact report", f"blast: **{rep['blast']}**  ·  modules: {len(rep['modules'])}  ·  files: {len(rep['affected'])}  ·  tests: {len(rep['tests'])}",
           f"contracts: {'CHANGED ' + ', '.join(rep['contracts']) if rep['contracts'] else 'unchanged'}", ""]
    if rep["unresolved"]:
        out.append(f"unresolved targets: {', '.join(rep['unresolved'])}\n")
    out.append("targets: " + ", ".join(rep["targets"]))
    out.append("modules: " + (", ".join(rep["modules"]) or "-"))
    out.append("")
    out.append("| file | depth |")
    out.append("| --- | --- |")
    for f in rep["affected"]:
        out.append(f"| {f} | {rep['depth'][f]} |")
    out.append("")
    out.append("tests to run: " + (" ".join(rep["tests"]) or "none mapped"))
    if rep["blast"] == "LARGE":
        out.append("\n**STOP**: large blast radius or contract change — human approval required before implementing.")
    return "\n".join(out)


def symbol_map(root: Path, per_module: int = 12) -> str:
    """The ~2k-token repo map that lives in the fixed prefix."""
    con = _con(root)
    out = ["## Symbol map"]
    mods = con.execute("SELECT module, COUNT(*) n, SUM(lines) l FROM files WHERE module IS NOT NULL GROUP BY module ORDER BY module").fetchall()
    for m in mods:
        out.append(f"\n### {m['module']}  ({m['n']} files, {m['l']} lines)")
        syms = con.execute("""SELECT s.name, s.kind, s.file, s.line FROM symbols s JOIN files f ON f.path=s.file
                              WHERE f.module=? AND f.is_test=0 AND s.exported=1 AND s.kind!='method'
                              ORDER BY s.kind, s.name LIMIT ?""", (m["module"], per_module)).fetchall()
        for s in syms:
            out.append(f"- {s['kind']} `{s['name']}` {s['file']}:{s['line']}")
        deps = con.execute("""SELECT DISTINCT b.module FROM edges e JOIN files a ON a.path=e.src JOIN files b ON b.path=e.dst
                              WHERE a.module=? AND b.module IS NOT NULL AND b.module!=?""", (m["module"], m["module"])).fetchall()
        ext = con.execute("""SELECT DISTINCT e.dst FROM edges e JOIN files a ON a.path=e.src
                             WHERE a.module=? AND e.dst LIKE 'ext:%'""", (m["module"],)).fetchall()
        if deps:
            out.append("- depends on: " + ", ".join(d["module"] for d in deps))
        if ext:
            out.append("- external: " + ", ".join(e["dst"][4:] for e in ext))
    other = con.execute("SELECT COUNT(*) FROM files WHERE module IS NULL").fetchone()[0]
    if other:
        out.append(f"\n({other} files outside modules/: tooling, scripts)")
    con.close()
    return "\n".join(out)


def query(root: Path, sql: str) -> list[dict]:
    con = _con(root)
    rows = [dict(r) for r in con.execute(sql).fetchall()]
    con.close()
    return rows
