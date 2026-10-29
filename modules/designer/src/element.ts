import { defaultTemplate, validateTemplate } from "../../template-model/src";
import type { Template } from "../../template-model/src";
import { loadCatalog } from "../../ubl-catalog/src";
import type { Catalog } from "../../ubl-catalog/src";
import * as ops from "./state";
import type { Block, EditorState, OpResult } from "./state";

const TAG = "xslt-designer";

export class XsltDesigner extends HTMLElement {
  static observedAttributes = ["document-type"];
  private _state?: EditorState;
  private _catalog?: Catalog;

  private get cat(): Catalog { return (this._catalog ??= loadCatalog()); }

  private ensure(): EditorState {
    if (!this._state) {
      const dt = this.getAttribute("document-type") === "EARSIV" ? "EARSIV" : "EFATURA";
      this._state = ops.createState(defaultTemplate(dt), this.cat);
    }
    return this._state;
  }

  /** Catalog used for field binding; defaults to loadCatalog(). Setting it keeps the template and resets history. */
  get catalog(): Catalog { return this.cat; }
  set catalog(c: Catalog) {
    if (!c || !Array.isArray(c.fields)) return;
    this._catalog = c;
    if (this._state) this._state = ops.createState(this._state.template, c);
  }

  get template(): Template { return this.ensure().template; }
  set template(t: Template) {
    const v = validateTemplate(t);
    if (v.ok) this._state = ops.createState(v.value, this.cat);
  }

  private run(r: OpResult): OpResult {
    try {
      if (r.ok) {
        this._state = r.state;
        this.dispatchEvent(new CustomEvent<Template>("template-change", { detail: r.state.template }));
      }
    } catch { /* listeners must not break the API */ }
    return r;
  }

  private step(f: (s: EditorState) => EditorState): OpResult {
    const cur = this.ensure();
    const next = f(cur);
    if (next === cur) return { ok: true, state: cur };
    return this.run({ ok: true, state: next });
  }

  private call(f: (s: EditorState) => OpResult): OpResult {
    try { return this.run(f(this.ensure())); }
    catch (e) { return { ok: false, errors: [e instanceof Error ? e.message : String(e)] }; }
  }

  addBlock(sectionId: string, block: Block, index?: number): OpResult { return this.call(s => ops.addBlock(s, sectionId, block, index)); }
  removeBlock(blockId: string): OpResult { return this.call(s => ops.removeBlock(s, blockId)); }
  moveBlock(blockId: string, toSectionId: string, toIndex: number): OpResult { return this.call(s => ops.moveBlock(s, blockId, toSectionId, toIndex)); }
  updateBlock(blockId: string, patch: Partial<Block>): OpResult { return this.call(s => ops.updateBlock(s, blockId, patch)); }
  bindField(blockId: string, fieldId: string): OpResult { return this.call(s => ops.bindField(s, blockId, fieldId)); }
  bindColumn(blockId: string, columnIndex: number, fieldId: string): OpResult { return this.call(s => ops.bindColumn(s, blockId, columnIndex, fieldId)); }
  /** Always ok:true; the event fires only when the template actually changed. */
  undo(): OpResult { return this.step(ops.undo); }
  redo(): OpResult { return this.step(ops.redo); }
}

if (typeof customElements !== "undefined" && !customElements.get(TAG)) customElements.define(TAG, XsltDesigner);
