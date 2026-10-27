#!/usr/bin/env python3
"""Attribution guard: commits and PR bodies carry the owner's name only.

A rule in AGENTS.md was not enough (observed 2026-10-27: every agent commit in the
pilot carried a model trailer despite the rule and includeCoAuthoredBy=false), so
this is a gate, not a guideline.

Usage:
  attribution_guard.py <base-ref>          check commit messages in <base-ref>..HEAD
  attribution_guard.py --strip <msgfile>   remove offending lines in place (commit-msg hook)
Env PR_BODY, if set, is checked too.
"""
import os, re, subprocess, sys

PATTERNS = [
    r"^\s*co-authored-by:.*(claude|anthropic|openai|gpt|copilot|gemini|cursor|noreply@anthropic)",
    r"^\s*claude-session:",
    r"generated with \[?claude code",
    r"claude\.ai/code/session_",
]
RX = [re.compile(p, re.I | re.M) for p in PATTERNS]

def bad_lines(text):
    return [l for l in text.splitlines() if any(r.search(l) for r in RX)]

def strip(path):
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    kept = [l for l in lines if not any(r.search(l) for r in RX)]
    while kept and not kept[-1].strip():
        kept.pop()
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(kept) + "\n")

def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--strip":
        strip(sys.argv[2]); return 0
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    out = subprocess.run(["git", "log", "--format=%H%x00%B%x01", f"{base}..HEAD"],
                         capture_output=True, text=True, encoding="utf-8").stdout
    fails = []
    for rec in out.split("\x01"):
        if "\x00" not in rec: continue
        sha, msg = rec.strip().split("\x00", 1)
        for l in bad_lines(msg):
            fails.append(f"commit {sha[:7]}: {l.strip()}")
    for l in bad_lines(os.environ.get("PR_BODY", "")):
        fails.append(f"PR body: {l.strip()}")
    if fails:
        print("attribution guard: FAIL — owner-only authorship (AGENTS.md)")
        for f in fails: print("  " + f)
        print("fix: git rebase -i / amend to drop the lines, or squash-merge with a clean message")
        return 1
    print("attribution guard: ok"); return 0

if __name__ == "__main__":
    sys.exit(main())
