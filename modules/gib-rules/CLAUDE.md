# gib-rules

Amaç: Üretilen XSLT'nin GİB ve özel entegratör motorlarında çalışmasını garanti eden kural seti ve kontrolcüsü.

Public yüzey:
- `RULES: Rule[]` (contracts/gib-rules.md ile birebir; 17 kural)
- `type Rule = { id: string; severity: Severity; description: string; documentTypes: DocType[] }`
- `type Severity = "error" | "warn"`
- `type DocType = "EFATURA" | "EARSIV"`
- `MODULE: string`
- Planlanan, henüz gövdesi yok: `checkTemplate(template, catalog): RuleHit[]`, `checkXslt(xslt: string): RuleHit[]`

Bağımlı olduğu: template-model, ubl-catalog
Ona bağımlı: xslt-codegen, designer

Invariantlar:
- Kural listesi sözleşmeyle birebir; kod ile contracts/gib-rules.md arasındaki fark `tests/rules.test.ts` içinde kızarır (id, severity)
- `documentTypes` varsayılanı her iki belge türü; yalnızca REQ-EARSIV-NOTE sadece `EARSIV`
- Kontroller saf fonksiyondur, I/O yapmaz; motor parite testleri CI job'udur, bu modülde değil
- `error` dışa aktarımı engeller, `warn` sadece gösterilir; üçüncü seviye yoktur

Testler: modules/gib-rules/tests (rules.test.ts: sözleşme drift, severity, kapsam)

Son değişiklikler:
- #10: `RULES` tablosu (17 kural) ve `Rule` tipi eklendi; `documentTypes` alanı eklendi; sözleşme drift testi (`rules.test.ts`).

hash: bc687e1338a2560b
