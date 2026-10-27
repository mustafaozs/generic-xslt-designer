"""CI guard: no personal data in tracked files. Fails on real-looking e-mails, phone numbers,
11-digit TCKN / 10-digit VKN outside allow-listed placeholders, and absolute user paths.
Usage: python scripts/privacy_guard.py [--all | <files...>]   (default: files changed vs origin/main)"""
import re, subprocess, sys
from pathlib import Path

ALLOW_EMAIL = re.compile(r"@(example\.com|users\.noreply\.github\.com|anthropic\.com|[a-z.]*\.gov\.tr)$|^noreply@", re.I)
ALLOW_IDS = {"1111111111", "11111111111", "0000000000", "00000000000", "1234567890", "12345678901", "1111111125"}
PATTERNS = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "phone": re.compile(r"(?<!\d)(?:\+90|0)?5\d{9}(?!\d)"),
    "tckn/vkn": re.compile(r"(?<![\d.])\d{10,11}(?![\d.])"),
    "user-path": re.compile(r"(?:[A-Za-z]:\\Users\\[^\\\s]+|/Users/[^/\s]+|/home/[^/\s]+)"),
}
SKIP = (".pdf", ".png", ".jpg", ".woff2", ".db", ".jsonl", ".log")
SKIP_FILES = {"scripts/privacy_guard.py", ".gitattributes"}

def files():
    if "--all" in sys.argv:
        out = subprocess.run(["git", "ls-files"], capture_output=True, text=True, encoding="utf-8").stdout
    elif len(sys.argv) > 1:
        return sys.argv[1:]
    else:
        base = "origin/main"
        out = subprocess.run(["git", "diff", "--name-only", f"{base}...HEAD"], capture_output=True, text=True, encoding="utf-8").stdout
    return [f for f in out.split() if not f.endswith(SKIP) and f not in SKIP_FILES]

viol = []
for f in files():
    p = Path(f)
    if not p.is_file():
        continue
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        continue
    for i, line in enumerate(text.splitlines(), 1):
        for kind, rx in PATTERNS.items():
            for m in rx.finditer(line):
                v = m.group(0)
                if kind == "email" and ALLOW_EMAIL.search(v):
                    continue
                if kind == "tckn/vkn":
                    low_entropy = v in ALLOW_IDS or v.startswith("0") or len(set(v)) <= 2 or v.endswith("000000")
                    schema_file = f.endswith((".xslt", ".xsl", ".sch")) or "/UBL-TR_" in f or "Schematron" in f
                    if low_entropy or schema_file or "sha" in line.lower() or "hash" in line.lower() or '"t":' in line or "arxiv" in line.lower():
                        continue
                if kind == "phone" and v.lstrip("+90").lstrip("0") in {"000000000", "5000000000"}:
                    continue
                viol.append(f"{f}:{i}: {kind}: {v}")
for v in viol:
    print("::error::" + v)
print("privacy guard:", "ok" if not viol else f"FAIL ({len(viol)})")
sys.exit(1 if viol else 0)
