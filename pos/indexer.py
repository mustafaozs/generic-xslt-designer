"""Tree-sitter indexer: files, symbols, file-level import edges. Deterministic, incremental."""
from __future__ import annotations

from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_python as tspy
import tree_sitter_typescript as tsts

from . import db as dbm
from .repo import (SOURCE_EXT, db_path, file_hash, is_test_path, iter_source_files, module_of, rel)

_LANGS = {
    "python": Language(tspy.language()),
    "typescript": Language(tsts.language_typescript()),
    "tsx": Language(tsts.language_tsx()),
}
_PARSERS = {k: Parser(v) for k, v in _LANGS.items()}


def _text(src: bytes, node) -> str:
    return src[node.start_byte:node.end_byte].decode("utf8", "replace")


def _sig(src: bytes, node) -> str:
    first = _text(src, node).splitlines()[0] if node else ""
    return first.strip()[:120]


# ---------- symbol extraction ----------

def _py_symbols(src: bytes, tree):
    out = []

    def definition(node):
        if node.type == "decorated_definition":
            node = node.child_by_field_name("definition")
        if node is None or node.type not in ("function_definition", "class_definition"):
            return
        name = _text(src, node.child_by_field_name("name"))
        kind = "function" if node.type == "function_definition" else "class"
        out.append((name, kind, node.start_point[0] + 1, _sig(src, node), not name.startswith("_")))
        if kind == "class":
            body = node.child_by_field_name("body")
            for ch in body.children if body else []:
                if ch.type == "decorated_definition":
                    ch = ch.child_by_field_name("definition")
                if ch is not None and ch.type == "function_definition":
                    m = _text(src, ch.child_by_field_name("name"))
                    out.append((f"{name}.{m}", "method", ch.start_point[0] + 1, _sig(src, ch), not m.startswith("_")))

    for node in tree.root_node.children:
        definition(node)
    return out


_TS_DECLS = {"function_declaration": "function", "class_declaration": "class",
             "interface_declaration": "interface", "type_alias_declaration": "type",
             "enum_declaration": "enum", "abstract_class_declaration": "class"}


def _ts_symbols(src: bytes, tree):
    out = []

    def decl(node, exported):
        t = node.type
        if t in _TS_DECLS:
            n = node.child_by_field_name("name")
            if n is not None:
                out.append((_text(src, n), _TS_DECLS[t], node.start_point[0] + 1, _sig(src, node), exported))
        elif t == "lexical_declaration":
            for d in node.children:
                if d.type == "variable_declarator":
                    n = d.child_by_field_name("name")
                    v = d.child_by_field_name("value")
                    kind = "function" if v is not None and v.type in ("arrow_function", "function_expression") else "const"
                    if n is not None:
                        out.append((_text(src, n), kind, node.start_point[0] + 1, _sig(src, node), exported))

    for node in tree.root_node.children:
        if node.type == "export_statement":
            for ch in node.children:
                decl(ch, True)
        else:
            decl(node, False)
    return out


# ---------- import extraction + resolution ----------

def _py_imports(src: bytes, tree):
    """Yield (module_string, is_relative_level)"""
    for node in tree.root_node.children:
        if node.type == "import_statement":
            for ch in node.children:
                if ch.type == "dotted_name":
                    yield _text(src, ch), 0
                elif ch.type == "aliased_import":
                    n = ch.child_by_field_name("name")
                    if n is not None:
                        yield _text(src, n), 0
        elif node.type == "import_from_statement":
            mod = node.child_by_field_name("module_name")
            if mod is None:
                continue
            raw = _text(src, mod)
            level = len(raw) - len(raw.lstrip("."))
            yield raw.lstrip("."), level


def _resolve_py(root: Path, file_rel: str, mod: str, level: int) -> str:
    if level:
        base = Path(file_rel).parent
        for _ in range(level - 1):
            base = base.parent
        parts = [p for p in mod.split(".") if p]
        cand = base.joinpath(*parts) if parts else base
    else:
        cand = Path(*mod.split("."))
    for c in (cand.with_suffix(".py"), cand / "__init__.py"):
        if (root / c).is_file():
            return c.as_posix()
    # drop trailing segment (from pkg.mod import name) handled above; try parent
    parent = cand.parent
    if parent != Path("."):
        for c in (parent.with_suffix(".py"), parent / "__init__.py"):
            if (root / c).is_file():
                return c.as_posix()
    return f"ext:{mod.split('.')[0] or 'relative'}"


def _ts_imports(src: bytes, tree):
    for node in tree.root_node.children:
        if node.type in ("import_statement", "export_statement"):
            s = node.child_by_field_name("source")
            if s is not None:
                yield _text(src, s).strip("'\"`")


def _resolve_ts(root: Path, file_rel: str, spec: str) -> str:
    if not spec.startswith("."):
        return f"ext:{spec.split('/')[0]}"
    base = (Path(file_rel).parent / spec)
    cands = [base.with_suffix(s) for s in (".ts", ".tsx", ".js")] + [base / "index.ts", base / "index.tsx"]
    if base.suffix in (".ts", ".tsx", ".js"):
        cands.insert(0, base)
    for c in cands:
        try:
            cr = (root / c).resolve().relative_to(root.resolve())
        except ValueError:
            continue
        if (root / cr).is_file():
            return cr.as_posix()
    return f"ext:{spec}"


# ---------- main entry ----------

def index(root: Path, verbose: bool = False) -> dict:
    con = dbm.connect(db_path(root))
    known = {r["path"]: r["hash"] for r in con.execute("SELECT path, hash FROM files")}
    seen, updated = set(), 0
    for p in iter_source_files(root):
        r = rel(root, p)
        seen.add(r)
        h = file_hash(p)
        if known.get(r) == h:
            continue
        lang = SOURCE_EXT[p.suffix]
        src = p.read_bytes()
        tree = _PARSERS[lang].parse(src)
        dbm.forget_file(con, r)
        con.execute("INSERT INTO files VALUES(?,?,?,?,?,?)",
                    (r, h, lang, module_of(r), int(is_test_path(r)), src.count(b"\n") + 1))
        syms = _py_symbols(src, tree) if lang == "python" else _ts_symbols(src, tree)
        con.executemany("INSERT INTO symbols VALUES(?,?,?,?,?,?)",
                        [(n, k, r, ln, sg, int(ex)) for n, k, ln, sg, ex in syms])
        if lang == "python":
            edges = [(r, _resolve_py(root, r, m, lvl), "import", m) for m, lvl in _py_imports(src, tree)]
        else:
            edges = [(r, _resolve_ts(root, r, s), "import", s) for s in _ts_imports(src, tree)]
        con.executemany("INSERT OR IGNORE INTO edges VALUES(?,?,?,?)", edges)
        updated += 1
        if verbose:
            print(f"  indexed {r} ({len(syms)} symbols, {len(edges)} imports)")
    for gone in set(known) - seen:
        dbm.forget_file(con, gone)
    con.commit()
    stats = {
        "files": con.execute("SELECT COUNT(*) FROM files").fetchone()[0],
        "symbols": con.execute("SELECT COUNT(*) FROM symbols").fetchone()[0],
        "edges": con.execute("SELECT COUNT(*) FROM edges").fetchone()[0],
        "updated": updated,
        "removed": len(set(known) - seen),
    }
    con.close()
    return stats
