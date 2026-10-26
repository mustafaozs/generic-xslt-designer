"""Kit gates must stay green on this repo (the kit's own unit tests live in the kit repo)."""
from pathlib import Path
from pos import gates, graph
from pos.indexer import index

ROOT = Path(__file__).resolve().parents[1]


def test_index_and_lint():
    assert index(ROOT)["files"] > 0
    ok, msgs = gates.lint(ROOT)
    assert ok, msgs


def test_cards_pinned():
    ok, msgs = gates.card_check(ROOT)
    assert ok, msgs


def test_contract_change_is_large():
    rep = graph.impact(ROOT, ["contracts/template-model.schema.json"])
    assert rep["blast"] == "LARGE" and "template-model" in rep["modules"]


def test_symbol_impact_maps_to_tests():
    rep = graph.impact(ROOT, ["loadCatalog"])
    assert "modules/ubl-catalog/tests/catalog.test.ts" in rep["tests"]
