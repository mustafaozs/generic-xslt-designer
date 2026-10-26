# billing

Amaç: Faturalar ve toplamlar; tek para birimi, kuruş cinsinden tam sayı.

Public yüzey:
- `class Invoice:`
- `def create_invoice(invoice_id: str, lines: list[tuple[str, int]]) -> Invoice:`

Bağımlı olduğu: -
Ona bağımlı: payments

Invariantlar:
- Tutarlar her zaman kuruş (int); float asla
- Invoice.total() satırların toplamıdır, vergi burada hesaplanmaz
- DB'ye doğrudan yazmaz; kalıcılık çağıranın işi

Testler: modules/billing/tests/test_core.py

Son değişiklikler:
- (none yet)

hash: 020521ffd13f6cc7
