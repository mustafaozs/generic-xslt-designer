# payments

Amaç: Bir faturayı tahsil eder; billing'i sadece sözleşmesi üzerinden kullanır.

Public yüzey:
- `class PaymentService:`

Bağımlı olduğu: billing
Ona bağımlı: -

Invariantlar:
- Aynı invoice iki kez charge edilmez (idempotent anahtar: invoice.id)
- Invoice iç yapısına erişmez, sadece id ve total()

Testler: modules/payments/tests/test_service.py

Son değişiklikler:
- (none yet)

hash: bf16c4109758825b
