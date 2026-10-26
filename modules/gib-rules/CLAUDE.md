# gib-rules

Amaç: Üretilen XSLT'nin GİB ve özel entegratör motorlarında çalışmasını garanti eden kural seti ve kontrolcüsü.

Public yüzey:
- `checkTemplate(template, catalog): RuleHit[]` (REQ-*, FONT-SAFE, SIZE-MAX)
- `checkXslt(xslt: string): RuleHit[]` (X10-*, EXT-*, NUM-TR, PRINT-PAGE)
- `RULES: Rule[]` (contracts/gib-rules.md ile birebir; id, severity, açıklama)

Bağımlı olduğu: template-model, ubl-catalog
Ona bağımlı: xslt-codegen, designer

Invariantlar:
- Kural listesi sözleşmeyle birebir; kod ile contracts/gib-rules.md arasındaki fark CI'da kızarır
- Kontroller saf fonksiyondur, I/O yapmaz; motor parite testleri CI job'udur, bu modülde değil
- `error` dışa aktarımı engeller, `warn` sadece gösterilir; üçüncü seviye yoktur

Testler: modules/gib-rules/tests

Son değişiklikler:
- (none yet)

hash: 705de481447680e0
