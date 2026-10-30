# gib-rules

Amaç: Üretilen XSLT'nin GİB ve özel entegratör motorlarında çalışmasını garanti eden kural seti ve kontrolcüsü.

Public yüzey:
- `RULES: Rule[]` (contracts/gib-rules.md birebir; 17 kural)
- `type Rule = { id: string; severity: Severity; description: string; documentTypes: DocType[] }`
- `type Severity = "error" | "warn"`
- `type DocType = "EFATURA" | "EARSIV"`
- `type RuleHit = { rule: string; severity: Severity; message: string }`
- `checkXslt(xslt: string): RuleHit[]` (X10-* ve EXT-* mekanik taramaları; LINES-ALL #43; NUM-TR #44)
- `checkTemplate(template: Template, catalog: Catalog): RuleHit[]` (REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX; logo sınırı base64 karakter sayısı)
- `MODULE: string`

Bağımlı olduğu: template-model, ubl-catalog
Ona bağımlı: xslt-codegen, designer

Invariantlar:
- Kural listesi contracts/gib-rules.md ile birebir (drift: `tests/rules.test.ts`)
- `documentTypes` varsayılanı her iki belge türü; yalnızca REQ-EARSIV-NOTE sadece `EARSIV`
- `checkXslt` XSLT 1.0 dışı XPath 2.0 yapılarını (string literalleri hariç) ve dış kaynak/script izlerini bulur; hit'in severity'si RULES tablosundan gelir
- `checkXslt` LINES-ALL: `cac:InvoiceLine` üzerinde `position(`sız `xsl:for-each` yoksa hit. Sınırlar: `xsl:if` içindeki `position()` algılanmaz; `xsl:apply-templates` ele alınmaz
- `checkTemplate` model'de `field` bağlı bloklara bakar (catalog id ile); ham XPath okumaz. REQ-FIELDS şu an ProfileID/InvoiceTypeCode'u kontrol etmez (borç, #12)
- `checkXslt` NUM-TR: `xsl:decimal-format name="tr"` yoksa (format-number kullanılıyorsa ya da başka decimal-format varsa) veya üçüncü argümanı `'tr'` olmayan `format-number` varsa hit (en çok iki). Sınır: format adı değişkenle verilirse algılanmaz
- Kontroller saf fonksiyon, I/O yok; motor parite CI job'udur
- `error` dışa aktarımı engeller, `warn` sadece gösterilir; üçüncü seviye yoktur

Testler: modules/gib-rules/tests (rules.test.ts: drift, severity, kapsam; check-xslt.test.ts: X10/EXT, NUM-TR (#44), goldens; check-lines.test.ts: #43; check-template.test.ts: REQ-*, FONT-SAFE, SIZE-MAX)

Son değişiklikler:
- #10: `RULES` (17 kural), `Rule`, `documentTypes`; drift testi.
- #11: `checkXslt`, `RuleHit`; X10-*, EXT-* taramaları.
- #12: `checkTemplate` (REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX); `check-template.test.ts`. Ledger: #12.
- #43: `checkXslt` LINES-ALL; `check-lines.test.ts`. Ledger: #43 entry.
- #44: NUM-TR; `check-xslt.test.ts`. Ledger: #44.

hash: 150d740a88846071
