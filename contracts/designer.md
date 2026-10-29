# designer contract (v1, #17)

**Input:** a Template (contracts/template-model.schema.json) + a catalog (ubl-catalog).
**Output:** a new Template after each edit; always valid per `validateTemplate`.
**Guarantees:** pure and DOM-free editor state (no framework, no network); ops never mutate their input; fields bind by catalog id only; nothing throws.

## API (TypeScript, no runtime dependency)

```ts
// editor state (pure; DOM-free). The state carries the catalog; the documentType is state.template.documentType.
export function createState(template: Template, catalog: Catalog): EditorState;
export interface EditorState { readonly template: Template; readonly catalog: Catalog }   // history is internal, not part of the contract
export type OpResult = { ok: true; state: EditorState } | { ok: false; errors: string[] };

export function addBlock(s: EditorState, sectionId: string, block: Block, index?: number): OpResult;
export function removeBlock(s: EditorState, blockId: string): OpResult;
export function moveBlock(s: EditorState, blockId: string, toSectionId: string, toIndex: number): OpResult; // within or across sections
export function updateBlock(s: EditorState, blockId: string, patch: Partial<Block>): OpResult;
export function bindField(s: EditorState, blockId: string, fieldId: string): OpResult;
export function bindColumn(s: EditorState, blockId: string, columnIndex: number, fieldId: string): OpResult;
export function undo(s: EditorState): EditorState;   // no-op when nothing to undo
export function redo(s: EditorState): EditorState;   // no-op when nothing to redo
```
- Every op returns a new state; the input state and its template are unchanged. No op throws.
- `ok: true` ⇒ `state.template` passes `validateTemplate`. An op that would make the template invalid (unknown section/block, duplicate block id, schema limits) returns `ok: false` and no new state.
- `addBlock` takes a caller-supplied block (id pattern from the schema); no id generation; a duplicate id is rejected.
- `bindField` sets `block.field` on a `field` block; it accepts only ids in `fieldsFor(catalog, documentType, "document")`.
- `bindColumn` sets `columns[columnIndex].field` on a `lineTable` block; it accepts only ids in `fieldsFor(catalog, documentType, "line")`.
- Both reject with `ok: false` a raw XPath (e.g. `//cbc:ID`), an id not in the catalog, an id of the wrong scope, a wrong block type or a column index out of range.
- `updateBlock` rejects with `ok: false` any patch that changes a field binding (a `field` block's `field`, or a lineTable column's `field`); binding is done only via `bindField`/`bindColumn`.
- Field pickers use `fieldsFor` directly (no wrapper): lineTable columns offer only `fieldsFor(catalog, documentType, "line")`.
- After three ops, undo twice then redo once yields the template of the second op.

## Custom element `xslt-designer`
- Registered with `customElements.define("xslt-designer", …)`; framework-free; works under happy-dom in tests.
- Attribute `document-type` (`EFATURA` | `EARSIV`): seeds `defaultTemplate(documentType)` when no template is set.
- Property `template: Template` (get/set).
- Methods mirror the pure ops: `addBlock`, `removeBlock`, `moveBlock`, `updateBlock`, `bindField`, `bindColumn`, `undo`, `redo`; they return `OpResult` and never throw; on `ok: false` the template is unchanged.
- Event `template-change` (`CustomEvent<Template>`): dispatched after every successful change; `detail` passes `validateTemplate`.

## Relation to template-model and ubl-catalog
- The designer only READS template-model (`defaultTemplate`, `validateTemplate`, `Template`) and ubl-catalog (`loadCatalog`, `getField`, `fieldsFor`). It does not change either contract.
- No XPath is ever written into a template; fields bind by catalog id.

## Out of scope
- XSLT generation and preview UI (xslt-codegen); generated XSLT is 1.0 only (ADR-0002), no XPath 2.0 anywhere.
- Persistence, styling/visual layout of the element, drag-and-drop, framework dependencies.
- OverEGov integration (H4).

## Decisions (owner, 2026-10-29)
1. Errors via `OpResult` everywhere, element methods too; nothing throws.
2. `addBlock` takes a caller-supplied block.
3. `bindField` = document scope only, `bindColumn` = line scope only; `updateBlock` cannot change bindings.
4. Attribute `document-type` and property `template` are definitive.
5. No `fieldChoices` wrapper; `fieldsFor` is used directly.
6. Invalid edits are rejected through the same `ok: false` path.
