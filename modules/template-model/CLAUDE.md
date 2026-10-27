# template-model

Amaç: Tasarımcının ürettiği belge modelinin tipi ve doğrulayıcısı; saf TypeScript, bağımlılık yok.

Public yüzey:
- `type Template` (contracts/template-model.schema.json'dan üretilir, elle yazılmaz)
- `validateTemplate(json: unknown): { ok: true; value: Template } | { ok: false; errors: string[] }`
- `defaultTemplate(documentType): Template` (totals satırları: lineExtension, allowance, taxExclusive, tax, withholding, taxInclusive, payable, payableInWords — #4)

Bağımlı olduğu: -
Ona bağımlı: xslt-codegen, gib-rules, designer

Invariantlar:
- Şema tek kaynak: TS tipi şemadan üretilir, şema değişmeden tip değişmez
- Modelde XPath yok; alanlar katalog id'siyle bağlanır (`field: "doc.id"`)
- Model JSON'dur, fonksiyon/sınıf taşımaz; her yerde serileştirilebilir

Testler: modules/template-model/tests

Son değişiklikler:
- #4: defaultTemplate totals satırlarına allowance, withholding, taxInclusive eklendi (imza değişmedi)

hash: 828690c2a6b37b3e
