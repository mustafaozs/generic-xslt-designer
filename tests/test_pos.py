"""End-to-end tests for the pos kit on the bundled example modules."""
import shutil
import subprocess
from pathlib import Path

import pytest

from pos import gates, graph
from pos.indexer import index
from pos.repo import module_hash

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture()
def repo(tmp_path):
    """Copy of the repo (without .git/.project-os) so tests never touch the real index."""
    dst = tmp_path / "repo"
    shutil.copytree(ROOT, dst, ignore=shutil.ignore_patterns(".git", ".project-os", "*.egg-info", "__pycache__", "node_modules"))
    shutil.copytree(ROOT / ".project-os" / "templates", dst / ".project-os" / "templates")
    subprocess.run(["git", "init", "-q"], cwd=dst, check=True)
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"], cwd=dst, check=True)
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init"], cwd=dst, check=True)
    index(dst)
    return dst


def test_index_counts(repo):
    stats = index(repo)
    assert stats["files"] >= 10 and stats["symbols"] > 20 and stats["edges"] > 10


def test_symbols_python_and_ts(repo):
    names = {r["name"] for r in graph.query(repo, "SELECT name FROM symbols")}
    assert {"Invoice", "Invoice.total", "create_invoice", "PaymentService", "chargeInvoice", "formatMoney", "Charge"} <= names
    private = graph.query(repo, "SELECT exported FROM symbols WHERE name='_internal_helper'")
    assert private and private[0]["exported"] == 0


def test_import_resolution(repo):
    edges = {(r["src"], r["dst"]) for r in graph.query(repo, "SELECT src, dst FROM edges")}
    assert ("modules/payments/service.py", "modules/billing/core.py") in edges
    assert ("modules/webui/src/api.ts", "modules/webui/src/format.ts") in edges
    assert ("modules/webui/src/api.ts", "ext:axios") in edges


def test_impact_symbol_reverse_closure(repo):
    rep = graph.impact(repo, ["Invoice"])
    assert rep["modules"] == ["billing", "payments"]
    assert "modules/payments/service.py" in rep["affected"]
    assert "modules/payments/tests/test_service.py" in rep["tests"]
    assert rep["blast"] == "MEDIUM"


def test_impact_contract_is_large_and_finds_consumers(repo):
    rep = graph.impact(repo, ["contracts/billing.openapi.yaml"])
    assert rep["blast"] == "LARGE" and "payments" in rep["modules"] and "billing" in rep["modules"]


def test_card_gate_detects_stale(repo):
    ok, _ = gates.card_check(repo)
    assert ok
    core = repo / "modules" / "billing" / "core.py"
    core.write_text(core.read_text() + "\n\ndef extra():\n    return 1\n")
    ok, msgs = gates.card_check(repo)
    assert not ok and any("STALE card: billing" in m for m in msgs)
    gates.card_update(repo, "billing")
    assert gates.card_check(repo)[0]
    assert gates.card_hash_in((repo / "modules/billing/CLAUDE.md").read_text()) == module_hash(repo, "billing")


def test_card_new_prefills_surface(repo):
    (repo / "modules/billing/CLAUDE.md").unlink()
    p = gates.card_new(repo, "billing")
    t = p.read_text()
    assert "create_invoice" in t and "Ona bağımlı: payments" in t and gates.card_hash_in(t)


def test_lint_requires_card_contract_tests(repo):
    assert gates.lint(repo)[0]
    (repo / "contracts" / "payments.openapi.yaml").unlink()
    ok, msgs = gates.lint(repo)
    assert not ok and any("payments: no contract" in m for m in msgs)


def test_lint_root_claude_size(repo):
    (repo / "CLAUDE.md").write_text("\n".join(f"rule {i}" for i in range(80)))
    ok, msgs = gates.lint(repo)
    assert not ok and any("root CLAUDE.md has 80 lines" in m for m in msgs)


def _commit(repo, msg):
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"], cwd=repo, check=True)
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", msg], cwd=repo, check=True)


def test_ledger_gate(repo):
    assert gates.ledger_check(repo)[0]  # init commit added the ledger file itself → self-recording
    (repo / "modules/billing/core.py").write_text((repo / "modules/billing/core.py").read_text() + "\n# change\n")
    _commit(repo, "code change without ledger")
    ok, msgs = gates.ledger_check(repo)
    assert not ok and "MISSING ledger entry" in msgs[0]
    entry = gates.ledger_add(repo, "#1", "change", tests_ran=2)
    assert "commit:" in entry and "modules: billing" in entry
    _commit(repo, "add ledger entry")
    assert gates.ledger_check(repo)[0]
    assert gates.ledger_check(repo, base="HEAD~2")[0]  # PR range: code commit is referenced by the entry's "after <sha>"
    assert gates.ledger_tail(repo, 1).startswith("## ")


def test_metrics_roundtrip(repo):
    gates.metrics_log(repo, issue="#1", tokens_in=1000, tokens_out=200, tests_ran=2, stopped_at="3")
    rep = gates.metrics_report(repo)
    assert "tasks: 1" in rep and "3=1" in rep
