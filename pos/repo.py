"""Repo layout conventions and git helpers. Everything else builds on these."""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

SOURCE_EXT = {".py": "python", ".ts": "typescript", ".tsx": "tsx"}
SKIP_DIRS = {".git", "node_modules", ".project-os", ".venv", "venv", "__pycache__", "dist", "build", ".claude"}
MODULES_DIR = "modules"
CONTRACTS_DIR = "contracts"


def find_root(start: Path | None = None) -> Path:
    p = (start or Path.cwd()).resolve()
    for cand in [p, *p.parents]:
        if (cand / ".project-os").is_dir() or (cand / ".git").is_dir():
            return cand
    return p


def db_path(root: Path) -> Path:
    """index.db lives in .project-os/ unless POS_DB_DIR points elsewhere (network mounts, read-only checkouts)."""
    import os
    override = os.environ.get("POS_DB_DIR")
    d = Path(override).expanduser() / root.name if override else root / ".project-os"
    d.mkdir(parents=True, exist_ok=True)
    return d / "index.db"


def _tracked_set(root: Path) -> set[str] | None:
    """Paths git tracks (plus untracked-but-not-ignored). None when not a git repo."""
    out = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z")
    if not out and not (root / ".git").exists():
        return None
    return {s for s in out.split("\0") if s}


def iter_source_files(root: Path, tracked: set[str] | None = None):
    """Source files the kit may hash or index: never generated/ignored files (their presence
    differs between a dev machine and CI, which would make card hashes environment-dependent)."""
    if tracked is None:
        tracked = _tracked_set(root)
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix not in SOURCE_EXT:
            continue
        r = p.relative_to(root).as_posix()
        if any(part in SKIP_DIRS for part in p.relative_to(root).parts):
            continue
        if tracked is not None and r not in tracked:
            continue
        yield p


def rel(root: Path, p: Path) -> str:
    return p.resolve().relative_to(root.resolve()).as_posix()


def module_of(relpath: str) -> str | None:
    parts = relpath.split("/")
    if len(parts) >= 3 and parts[0] == MODULES_DIR:
        return parts[1]
    return None


def is_test_path(relpath: str) -> bool:
    """A test is named like one; helpers under tests/ are not tests (they are support code)."""
    name = Path(relpath).name
    return name.startswith("test_") or name.endswith("_test.py") or name.endswith(".test.ts") \
        or name.endswith(".spec.ts") or name.endswith(".test.tsx") or name.endswith(".spec.tsx") \
        or name.endswith("_test.go") or name.endswith("Test.java") or name.endswith("Tests.cs")


def _norm(b: bytes) -> bytes:
    """Line-ending independent: a CRLF checkout must hash like an LF one."""
    return b.replace(b"\r\n", b"\n")


def file_hash(p: Path) -> str:
    return hashlib.sha256(_norm(p.read_bytes())).hexdigest()[:16]


def module_hash(root: Path, module: str) -> str:
    """Hash of a module's non-test source, order-independent. This is what cards pin."""
    h = hashlib.sha256()
    base = root / MODULES_DIR / module
    tracked = _tracked_set(root)
    for p in sorted(_module_files(root, base, tracked), key=lambda x: x.as_posix()):
        r = rel(root, p)
        if is_test_path(r):
            continue
        h.update(r.encode())
        h.update(_norm(p.read_bytes()))
    return h.hexdigest()[:16]


def _module_files(root: Path, base: Path, tracked: set[str] | None):
    for p in base.rglob("*"):
        if not p.is_file() or p.suffix not in SOURCE_EXT:
            continue
        r = p.relative_to(root).as_posix()
        if any(part in SKIP_DIRS for part in p.relative_to(root).parts):
            continue
        if tracked is not None and r not in tracked:
            continue
        yield p


def list_modules(root: Path) -> list[str]:
    base = root / MODULES_DIR
    if not base.is_dir():
        return []
    return sorted(p.name for p in base.iterdir()
                  if p.is_dir() and not p.name.startswith((".", "_")) and p.name not in SKIP_DIRS
                  and any(True for _ in _module_files(root, p, _tracked_set(root))))


def git(root: Path, *args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=root, text=True, encoding="utf-8", errors="replace", stderr=subprocess.DEVNULL).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def changed_files(root: Path, base: str | None = None) -> list[str]:
    """Files changed vs base (default: working tree + staged vs HEAD)."""
    if base:
        out = git(root, "diff", "--name-only", f"{base}...HEAD")
    else:
        out = "\n".join([git(root, "diff", "--name-only", "HEAD"), git(root, "ls-files", "--others", "--exclude-standard")])
    return sorted({l for l in out.splitlines() if l.strip()})
