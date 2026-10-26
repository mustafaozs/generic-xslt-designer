from modules.billing.core import create_invoice
from modules.payments.service import PaymentService


def test_charge():
    inv = create_invoice("i1", [("a", 10)])
    assert PaymentService().charge(inv)["amount"] == 10
