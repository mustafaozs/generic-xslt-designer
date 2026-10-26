"""Billing: invoices and totals. Public surface = contracts/billing.openapi.yaml."""
from dataclasses import dataclass, field


@dataclass
class Invoice:
    id: str
    lines: list[tuple[str, int]] = field(default_factory=list)

    def total(self) -> int:
        return sum(amount for _, amount in self.lines)


def create_invoice(invoice_id: str, lines: list[tuple[str, int]]) -> Invoice:
    return Invoice(invoice_id, list(lines))


def _internal_helper() -> None:
    pass

