# template-model

Amaç: Tasarımcının ürettiği belge modelinin tipi ve doğrulayıcısı; saf TypeScript, bağımlılık yok.

Public yüzey:
- `type Template` (contracts/template-model.schema.json'dan üretilir, elle yazılmaz)
- `validateTemplate(json: unknown): { ok: true; value: Template } | { ok: false; errors: string[] }`
- `defaultTemplate(documentType): Template`

Bağımlı olduğu: -
Ona bağımlı: xslt-codegen, gib-rules, designer

Invariantlar:
- Şema tek kaynak: TS tipi şemadan üretilir, şema değişmeden tip değişmez
- Modelde XPath yok; alanlar katalog id'siyle bağlanır (`field: "doc.id"`)
- Model JSON'dur, fonksiyon/sınıf taşımaz; her yerde serileştirilebilir

Testler: modules/template-model/tests

Son değişiklikler:
- (none yet)

hash: f94b7826017d12a1
