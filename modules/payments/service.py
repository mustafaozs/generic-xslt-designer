"""Payments: charges an invoice. Depends on billing only through its contract."""
from modules.billing.core import Invoice


class PaymentService:
    def charge(self, invoice: Invoice) -> dict:
        return {"invoice": invoice.id, "amount": invoice.total(), "status": "charged"}
