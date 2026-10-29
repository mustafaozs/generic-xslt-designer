# xslt-codegen

Amaç: Template + Catalog → deterministik, XSLT 1.0 uyumlu, kendine yeten HTML üreten stylesheet.

Public yüzey:
- `generate(template, catalog): GenerateResult` (bkz. contracts/xslt-codegen.md)
- `GenerateResult { xslt, warnings: RuleHit[], errors: RuleHit[] }`, `RuleHit { rule, blockId?, message }`
- Codegen'in kendi bağlama kuralları (gib-rules tablosu dışında, `CG-` öneki):
  error → `CG-FIELD-UNKNOWN`, `CG-FIELD-SCOPE`, `CG-FIELD-DOCTYPE`, `CG-ID-DUPLICATE`, `CG-BLOCK-UNKNOWN`;
  warn → `CG-FIELD-DEPRECATED`, `CG-FIELD-UNSUPPORTED` (derived.pageNo boş), `CG-BLOCK-UNSUPPORTED` (qr → ETTN metni), `CG-OPTION-IGNORED` (maxRowsPerPage)

Bağımlı olduğu: template-model, ubl-catalog (yalnız tip importu; runtime bağımlılığı yok), gib-rules (bağlanacak)
Ona bağımlı: preview, designer, overegov (tüketici proje)

Invariantlar:
- Çıktı deterministik: aynı girdi → bayt aynı çıktı (golden testler)
- Üretilen her satır XSLT/XPath 1.0; 2.0 yapısı üretme yolu kodda yoktur
- Bütün satırlar render edilir, `position() <= N` sınırı yok
- Dış kaynak yok: logo data URI, font sistem fontu, script yok
- Hata varken bile xslt döner ama `errors` boş değilse dışa aktarılmaz
- Sabit sıra: prolog → değişkenler (`$watermark`, `$payableInWords`, `$page`) → adlandırılmış şablonlar (money, date-tr, number-tr, in-words-tr; yalnız kullanılanlar) → `match="/"` → `section-<id>` şablonları
- Katalog XPath'leri `n1:Invoice` bağlamında çözülür (`/n1:Invoice`); alan kapsamı (document/line/taxSubtotal) blok tipiyle eşleşmezse `CG-FIELD-SCOPE`
- Yazıyla tutar (Yalnız: …) özyinelemeli `in-words-tr`/`in-words-tr-int` şablonudur (ADR-0002); bitişik yazım: `BirMilyonİkiYüz… TL Beş Kr`; 0,00 → `Sıfır TL` (kuruş kısmı yok)

Testler: modules/xslt-codegen/tests — `generate.test.ts` (bağlama kuralları), `golden.test.ts` (golden/<case>: expected.xslt bayt eşitliği + libxslt ile expected.html), `efatura-fixture.test.ts` (#4: efatura-tevkifat). `earsiv-full.test.ts` (#15: earsiv-full). `inwords-matrix.test.ts` (#16: sınır tutarları, 12 fixture; libxslt gerekir). `npm run golden:update` yeniler; lxml yoksa html testi atlanır, CI `GOLDEN_REQUIRE_ENGINE=1` ile zorlar.

Son değişiklikler:
- #3: blok tipleri text/field/logo/lineTable/taxTable/totals/qr/signature/spacer/rule; golden `earsiv-default`
- #4: ikinci fixture (sentetik e-Fatura TEVKIFAT, 13 satır, tevkifat, iskonto); golden `efatura-tevkifat`
- #15: tam e-Arşiv fixture (4 kalem, toplam, filigran, not); golden `earsiv-full`, `earsiv-full-nonote`; public yüzey değişmedi
- #16: in-words-tr sınır matrisi (15 test); yalnız test/fixture, kod, public yüzey değişmedi

hash: 02b642c53690e24c
