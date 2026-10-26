"""SQLite schema. One file, rebuilt incrementally; never edited by hand."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS files(
  path TEXT PRIMARY KEY, hash TEXT NOT NULL, lang TEXT NOT NULL,
  module TEXT, is_test INTEGER NOT NULL DEFAULT 0, lines INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS symbols(
  name TEXT NOT NULL, kind TEXT NOT NULL, file TEXT NOT NULL, line INTEGER NOT NULL,
  signature TEXT, exported INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS symbols_file ON symbols(file);
CREATE TABLE IF NOT EXISTS edges(
  src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL, raw TEXT,
  UNIQUE(src, dst, kind));
CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
"""


def connect(path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def forget_file(con: sqlite3.Connection, path: str) -> None:
    con.execute("DELETE FROM symbols WHERE file=?", (path,))
    con.execute("DELETE FROM edges WHERE src=?", (path,))
    con.execute("DELETE FROM files WHERE path=?", (path,))
