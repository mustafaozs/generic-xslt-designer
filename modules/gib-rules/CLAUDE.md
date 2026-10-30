# gib-rules

Amaç: Üretilen XSLT'nin GİB ve özel entegratör motorlarında çalışmasını garanti eden kural seti ve kontrolcüsü.

Public yüzey:
- `RULES: Rule[]` (contracts/gib-rules.md ile birebir; 17 kural)
- `type Rule = { id: string; severity: Severity; description: string; documentTypes: DocType[] }`
- `type Severity = "error" | "warn"`
- `type DocType = "EFATURA" | "EARSIV"`
- `type RuleHit = { rule: string; severity: Severity; message: string }`
- `checkXslt(xslt: string): RuleHit[]` (X10-* ve EXT-* mekanik taramaları; LINES-ALL #43)
- `checkTemplate(template: Template, catalog: Catalog): RuleHit[]` (REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX; logo sınırı base64 karakter sayısı)
- `MODULE: string`

Bağımlı olduğu: template-model, ubl-catalog
Ona bağımlı: xslt-codegen, designer

Invariantlar:
- Kural listesi sözleşmeyle birebir; kod ile contracts/gib-rules.md arasındaki fark `tests/rules.test.ts` içinde kızarır (id, severity)
- `documentTypes` varsayılanı her iki belge türü; yalnızca REQ-EARSIV-NOTE sadece `EARSIV`
- `checkXslt` XSLT 1.0 dışı XPath 2.0 yapılarını (string literalleri hariç) ve dış kaynak/script izlerini bulur; hit'in severity'si RULES tablosundan gelir
- `checkXslt` LINES-ALL: `cac:InvoiceLine` üzerinde `position(`sız `xsl:for-each` yoksa hit. Sınırlar: `xsl:if` içindeki `position()` algılanmaz; `xsl:apply-templates` ele alınmaz
- `checkTemplate` model'de `field` bağlı bloklara bakar (catalog id ile); ham XPath okumaz. REQ-FIELDS şu an ProfileID/InvoiceTypeCode'u kontrol etmez (borç, #12)
- Kontroller saf fonksiyondur, I/O yapmaz; motor parite testleri CI job'udur, bu modülde değil
- `error` dışa aktarımı engeller, `warn` sadece gösterilir; üçüncü seviye yoktur

Testler: modules/gib-rules/tests (rules.test.ts: sözleşme drift, severity, kapsam; check-xslt.test.ts: X10-*/EXT-* kabul testleri, golden stylesheet'ler; check-lines.test.ts: LINES-ALL (#43); check-template.test.ts: REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX)

Son değişiklikler:
- #10: `RULES` tablosu (17 kural) ve `Rule` tipi eklendi; `documentTypes` alanı eklendi; sözleşme drift testi (`rules.test.ts`).
- #11: `checkXslt` ve `RuleHit` eklendi; X10-VERSION, X10-OUTPUT-HTML, X10-NO-RESULT-DOC, X10-NO-XPATH2, EXT-NONE, EXT-NO-SCRIPT taramaları; `check-xslt.test.ts`.
- #12: `checkTemplate` eklendi (planlanan madde kaldırıldı); REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX; `check-template.test.ts`. Ledger: #12 entry.
- #43: `checkXslt` LINES-ALL; `check-lines.test.ts`. Ledger: #43 entry.

hash: b1702760df2901ea
