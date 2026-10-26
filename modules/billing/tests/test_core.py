from modules.billing.core import create_invoice


def test_total():
    inv = create_invoice("i1", [("a", 10), ("b", 5)])
    assert inv.total() == 15
