# designer

Amaç: DOM-free editör durumu (saf işlemler) ve `xslt-designer` custom element'i; şablonu kimlik-bazlı alan bağlamalarıyla düzenler (contracts/designer.md, #17).

Public yüzey:
- `src/state.ts`: `createState(template, catalog)`, `addBlock`, `removeBlock`, `moveBlock`, `updateBlock`, `bindField`, `bindColumn`, `undo`, `redo`, `EditorState`, `OpResult`, `Block` (Template'ten türetilir). `src/index.ts` yalnız bu adları dışa verir; `src/internal.ts` iç kullanım.
- `src/element.ts`: `XsltDesigner`, `customElements.define("xslt-designer")`. Kayıt için `src/element` import edilmeli (index'ten gelmez). Attribute `document-type`, property `template` (get/set, atanana dek `undefined`), property `catalog` (get/set), metodlar aynı işlemleri çağırır, event `template-change`.

Bağımlı olduğu: template-model (`defaultTemplate`, `validateTemplate`, `Template`), ubl-catalog (`loadCatalog`, `fieldsFor`, `Catalog`) — yalnız okunur.
Ona bağımlı: -

Invariantlar:
- Her işlem yeni durum döndürür; girdi durum/şablon değişmez; hiçbiri throw etmez.
- `ok:true` ⇒ şablon `validateTemplate`'ten geçer; blok id'leri tüm bölümler arasında tekil.
- Alan bağlama yalnız katalog id'si ile: `bindField` yalnız document, `bindColumn` yalnız line kapsamı; ham XPath reddedilir.
- `updateBlock` bağlamayı değiştiremez (field değişimi; field/lineTable'a veya ondan tip değişimi; column alanı değiştiren `columns` yaması).
- `field` özelliği yalnız `field` bloğunda olabilir.
- `addBlock` yalnız eklenen bloğun bağlamalarını denetler: `field` bloğu document, lineTable sütunları line kapsamı katalog id'si olmalı.
- Durumdaki şablonlar derin dondurulur (undo/redo sonuçları dahil); dışarıdan değiştirme geçmişi bozamaz.  JSON-dışı girdi `ok:false`.
- Geçmiş (undo/redo) modül düzeyi WeakMap'te, anahtar durum nesnesi.

Notlar:
- Element katalogu varsayılan `loadCatalog()`; `catalog` setter geçersiz (fields yok) değeri sessizce yok sayar; geçerliyse geçmişi sıfırlar.
- `template` setter: geçersiz şablonu veya katalogda olmayan/yanlış kapsamlı bağlamalı şablonu yok sayar; geçerliyse geçmişi sıfırlar ve `template-change` atar.
- Element `undo`/`redo`: şablon `undefined` iken `ok:false`; aksi halde `ok:true`, event yalnız şablon değişirse.
- `moveBlock` `toIndex`'i kaynak çıkarıldıktan sonraki diziye göre sayar.
- `document-type` ilk erişimde okunur; şablon değişmemişse attribute değişimi (`attributeChangedCallback`) varsayılanı yeniden tohumlar, yoksa yok sayılır.

Testler: `modules/designer/tests/state.test.ts` (24), `modules/designer/tests/element.test.ts` (13, happy-dom), `section-of.test.ts` (3), `new-block-id.test.ts` (4).

Son değişiklikler:
- #39 `newBlockId` (internal; ilk boş `block-N`; public'e çıkmaz)
- #41 `sectionOf`

hash: cbb91e4f02a2464f
