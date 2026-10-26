# xslt-codegen

Amaç: Template + Catalog → deterministik, XSLT 1.0 uyumlu, kendine yeten HTML üreten stylesheet.

Public yüzey:
- `generate(template, catalog): GenerateResult` (bkz. contracts/xslt-codegen.md)

Bağımlı olduğu: template-model, ubl-catalog, gib-rules
Ona bağımlı: preview, designer, overegov (tüketici proje)

Invariantlar:
- Çıktı deterministik: aynı girdi → bayt aynı çıktı (golden testler)
- Üretilen her satır XSLT/XPath 1.0; 2.0 yapısı üretme yolu kodda yoktur
- Bütün satırlar render edilir, `position() <= N` sınırı yok
- Dış kaynak yok: logo data URI, font sistem fontu, script yok
- Hata varken bile xslt döner ama `errors` boş değilse dışa aktarılmaz

Testler: modules/xslt-codegen/tests (golden + iki motor parite)

Son değişiklikler:
- (none yet)

hash: 46cc228e9c3f6e0f
