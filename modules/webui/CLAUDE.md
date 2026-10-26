# webui

Amaç: Tahsilat sonucunu gösteren web arayüzü; payments API'sini tüketir.

Public yüzey:
- `interface Charge { invoice: string; amount: number; status: string }`
- `async function chargeInvoice(id: string): Promise<Charge> {`
- `function formatMoney(cents: number): string {`
- `const render = (c: Charge) => `${c.invoice}: ${formatMoney(c.amount)}`;`

Bağımlı olduğu: -
Ona bağımlı: -

Invariantlar:
- Para formatı formatMoney üzerinden, başka yerde biçimlenmez
- Backend tiplerine değil, contracts/payments şemasına bağlıdır

Testler: modules/webui/src/api.test.ts

Son değişiklikler:
- (none yet)

hash: 032c40fe1e1ca128
