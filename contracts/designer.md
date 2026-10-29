# designer contract (v1, draft for #17)

**Input:** a Template (contracts/template-model.schema.json) + a catalog (ubl-catalog).
**Output:** a new Template after each edit; always valid per `validateTemplate`.
**Guarantees:** pure and DOM-free editor state (no framework, no network); ops never mutate their input; fields bind by catalog id only.

## API (TypeScript, no runtime dependency)

```ts
// editor state (pure; DOM-free)
export function createState(template: Template): EditorState;
export interface EditorState { readonly template: Template }   // history is internal, not part of the contract
export type OpResult = { ok: true; state: EditorState } | { ok: false; errors: string[] };

export function addBlock(s: EditorState, sectionId: string, block: Block, index?: number): OpResult;
export function removeBlock(s: EditorState, blockId: string): OpResult;
export function moveBlock(s: EditorState, blockId: string, toSectionId: string, toIndex: number): OpResult; // within or across sections
export function updateBlock(s: EditorState, blockId: string, patch: Partial<Block>): OpResult;
export function bindField(s: EditorState, blockId: string, fieldId: string): OpResult;
export function undo(s: EditorState): EditorState;   // no-op when nothing to undo
export function redo(s: EditorState): EditorState;   // no-op when nothing to redo
export function fieldChoices(catalog: Catalog, documentType: DocumentType, scope: Scope): Field[]; // = fieldsFor(catalog, documentType, scope)
```
- Every op returns a new state; the input state and its template are unchanged.
- `ok: true` ⇒ `state.template` passes `validateTemplate`. An op that would make the template invalid (unknown section/block, duplicate block id, schema limits) returns `ok: false` and no new state.
- `bindField` sets `block.field` on a `field` block. A raw XPath (e.g. `//cbc:ID`) or an id not in the catalog is rejected with `ok: false`.
- lineTable column pickers offer only `fieldsFor(catalog, documentType, "line")`.
- After three ops, undo twice then redo once yields the template of the second op.

## Custom element `xslt-designer`
- Registered with `customElements.define("xslt-designer", …)`; framework-free; works under happy-dom in tests.
- Attribute `document-type` (`EFATURA` | `EARSIV`): seeds `defaultTemplate(documentType)` when no template is set. *(proposal)*
- Property `template: Template` (get/set). *(proposal)*
- Methods mirror the pure ops: `addBlock`, `removeBlock`, `moveBlock`, `updateBlock`, `bindField`, `undo`, `redo`; on `ok: false` they throw and leave the template unchanged.
- Event `template-change` (`CustomEvent<Template>`): dispatched after every successful change; `detail` passes `validateTemplate`.

## Relation to template-model and ubl-catalog
- The designer only READS template-model (`defaultTemplate`, `validateTemplate`, `Template`) and ubl-catalog (`loadCatalog`, `getField`, `fieldsFor`). It does not change either contract.
- No XPath is ever written into a template; fields bind by catalog id.

## Out of scope
- XSLT generation and preview UI (xslt-codegen); generated XSLT is 1.0 only (ADR-0002), no XPath 2.0 anywhere.
- Persistence, styling/visual layout of the element, drag-and-drop, framework dependencies.
- OverEGov integration (H4).

## Open for human decision
1. Error surfacing: result union (`OpResult`), consistent with `validateTemplate`; the element throws.
2. `addBlock` takes a caller-supplied block (id pattern from the schema; duplicate ids rejected), no id generation.
3. `bindField` applies to `field` blocks only and checks catalog membership; whether it should also require `scope: "document"` is open. Binding lineTable columns goes through `updateBlock`.
4. Element attribute `document-type` and property `template` are proposals; the issue only requires "registered with a default template" and the API methods.
