# ubl-catalog

Amaç: Tasarımcının bağlayabildiği UBL-TR alanlarının kataloğu (id → XPath, tip, etiket, kod listesi).

Public yüzey:
- `loadCatalog(version = "ubl-tr-1.2"): Catalog`
- `getField(catalog, id): Field | undefined`
- `fieldsFor(catalog, documentType, scope?): Field[]`
- `data/ubl-tr-1.2.json` (106 alan, 9 grup)

Bağımlı olduğu: -
Ona bağımlı: xslt-codegen, gib-rules, designer

Invariantlar:
- Her XPath XSLT 1.0'da geçerli; XPath 2.0 fonksiyonu yok
- `$` ile başlayan xpath sentetiktir, codegen üretir, UBL'de yoktur
- Alan id'leri sabittir; silmek yerine `deprecated: true` eklenir (sözleşme değişikliği)
- Kod listeleri fixtures/UBL-TR_Codelist.xml'den türetilir, elle yazılmaz

Testler: modules/ubl-catalog/tests

Son değişiklikler:
- (none yet)

hash: 9a6c03bcf93c4a08
