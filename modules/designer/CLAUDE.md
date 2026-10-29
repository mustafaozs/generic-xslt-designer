# designer

Amaç: DOM-free editör durumu (saf işlemler) ve `xslt-designer` custom element'i; şablonu kimlik-bazlı alan bağlamalarıyla düzenler (contracts/designer.md, #17).

Public yüzey:
- `src/state.ts`: `createState(template, catalog)`, `addBlock`, `removeBlock`, `moveBlock`, `updateBlock`, `bindField`, `bindColumn`, `undo`, `redo`, `EditorState`, `OpResult`, `Block` (re-export). `src/index.ts` yalnız `./state`'i yeniden dışa verir.
- `src/element.ts`: `XsltDesigner`, `customElements.define("xslt-designer")`. Kayıt için `src/element` import edilmeli (index'ten gelmez). Attribute `document-type`, property `template` (get/set), property `catalog` (get/set), metodlar aynı işlemleri çağırır, event `template-change`.

Bağımlı olduğu: template-model (`defaultTemplate`, `validateTemplate`, `Template`, `Block`), ubl-catalog (`loadCatalog`, `fieldsFor`, `Catalog`) — yalnız okunur.
Ona bağımlı: -

Invariantlar:
- Her işlem yeni durum döndürür; girdi durum/şablon değişmez; hiçbiri throw etmez.
- `ok:true` ⇒ şablon `validateTemplate`'ten geçer; blok id'leri tüm bölümler arasında tekil.
- Alan bağlama yalnız katalog id'si ile: `bindField` yalnız document, `bindColumn` yalnız line kapsamı; ham XPath reddedilir.
- `updateBlock` bağlamayı değiştiremez (field değişimi; field/lineTable'a veya ondan tip değişimi; column alanı değiştiren `columns` yaması).
- Geçmiş (undo/redo) modül düzeyi WeakMap'te, anahtar durum nesnesi.

Katalog/aralık notları (contract'ta yok, kod davranışı):
- Element katalogu varsayılan `loadCatalog()`; `catalog` setter geçersiz (fields dizisi yok) değeri sessizce yok sayar, geçerliyse şablonu tutar ve geçmişi sıfırlar.
- `template` setter geçersiz şablonu yok sayar, geçmişi sıfırlar, event atmaz.
- Element `undo`/`redo` her zaman `ok:true`; event yalnız şablon gerçekten değiştiyse.
- `moveBlock` `toIndex`'i kaynak bloğu çıkardıktan sonraki hedef dizisine göre sayar.
- `document-type` ilk erişimde okunur; `observedAttributes` tanımlı ama `attributeChangedCallback` yok, sonradan değişiklik yok sayılır.

Testler: `modules/designer/tests/state.test.ts` (14), `modules/designer/tests/element.test.ts` (6, happy-dom).

Son değişiklikler:
- #17 (designer contract v1 + state ops + element), bkz. docs/ledger/2026-10.md

hash: c97c743bee2861c5
