import { defaultTemplate, validateTemplate } from "../../template-model/src";
import type { Template } from "../../template-model/src";
import { loadCatalog } from "../../ubl-catalog/src";
import type { Catalog } from "../../ubl-catalog/src";
import * as ops from "./state";
import type { Block, EditorState, OpResult } from "./state";

const TAG = "xslt-designer";

const errOf = (e: unknown): OpResult => ({ ok: false, errors: [e instanceof Error ? e.message : String(e)] });

export class XsltDesigner extends HTMLElement {
  static observedAttributes = ["document-type"];
  private _state?: EditorState;
  private _catalog?: Catalog;

  private get cat(): Catalog { return (this._catalog ??= loadCatalog()); }

  private seed(): EditorState {
    const dt = this.getAttribute("document-type") === "EARSIV" ? "EARSIV" : "EFATURA";
    return ops.createState(defaultTemplate(dt), this.cat);
  }

  private ensure(): EditorState { return (this._state ??= this.seed()); }

  /** Changing document-type before any edit re-seeds the default template. */
  attributeChangedCallback(name: string, oldV: string | null, newV: string | null): void {
    try {
      if (name === "document-type" && oldV !== newV && this._state && !this._touched) this._state = this.seed();
    } catch { /* never throw from a callback */ }
  }
  private _touched = false;

  /** Catalog used for field binding; defaults to loadCatalog(). Setting it keeps the template and resets history. */
  get catalog(): Catalog | undefined { try { return this.cat; } catch { return undefined; } }
  set catalog(c: Catalog) {
    try {
      if (!c || !Array.isArray(c.fields)) return;
      this._catalog = c;
      if (this._state) this._state = ops.createState(this._state.template, c);
    } catch { /* ignore */ }
  }

  get template(): Template | undefined { try { return this.ensure().template; } catch { return undefined; } }
  set template(t: Template) {
    try {
      const v = validateTemplate(t);
      if (!v.ok || ops.templateBindingErrors(v.value, this.cat).length) return;
      this._state = ops.createState(v.value, this.cat);
      this._touched = true;
      this.dispatchEvent(new CustomEvent<Template>("template-change", { detail: this._state.template }));
    } catch { /* invalid input is ignored */ }
  }

  private run(r: OpResult): OpResult {
    try {
      if (r.ok) {
        this._state = r.state;
        this._touched = true;
        this.dispatchEvent(new CustomEvent<Template>("template-change", { detail: r.state.template }));
      }
    } catch { /* listeners must not break the API */ }
    return r;
  }

  private step(f: (s: EditorState) => EditorState): OpResult {
    try {
      const cur = this.ensure();
      const next = f(cur);
      if (next === cur) return { ok: true, state: cur };
      return this.run({ ok: true, state: next });
    } catch (e) { return errOf(e); }
  }

  private call(f: (s: EditorState) => OpResult): OpResult {
    try { return this.run(f(this.ensure())); }
    catch (e) { return errOf(e); }
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
