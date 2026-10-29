import { validateTemplate } from "../../template-model/src";
import type { Template } from "../../template-model/src";
import type { Catalog } from "../../ubl-catalog/src";
import { fieldsFor } from "../../ubl-catalog/src";
export type Block = Template["sections"][number]["blocks"][number];

export interface EditorState { readonly template: Template; readonly catalog: Catalog }
export type OpResult = { ok: true; state: EditorState } | { ok: false; errors: string[] };

// History is internal: kept off the state object so the public shape stays {template, catalog}.
interface History { past: Template[]; future: Template[] }
const histories = new WeakMap<object, History>();

const clone = <T>(v: T): T => structuredClone(v); // throws on circular/odd input; callers catch

function deepFreeze<T>(o: T, seen = new WeakSet<object>()): T {
  if (o && typeof o === "object" && !seen.has(o as object)) {
    seen.add(o as object);
    Object.values(o as object).forEach(v => deepFreeze(v, seen));
    Object.freeze(o);
  }
  return o;
}
const fail = (...errors: string[]): OpResult => ({ ok: false, errors });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

function make(template: Template, catalog: Catalog, h: History): EditorState {
  const s: EditorState = Object.freeze({ template, catalog });
  histories.set(s, h);
  return s;
}

export function createState(template: Template, catalog: Catalog): EditorState {
  let t: Template = template;
  try { t = deepFreeze(clone(template)); } catch { /* odd input: keep as is; every op will then reject via its own try/catch */ }
  return make(t, catalog, { past: [], future: [] });
}

function histOf(s: EditorState): History {
  return histories.get(s) ?? { past: [], future: [] };
}

function validState(s: unknown): s is EditorState {
  return isObj(s) && isObj(s.template) && isObj(s.catalog) && Array.isArray((s.catalog as any).fields);
}

/** Bindings of a caller-supplied block must be catalog ids of the right scope. Only this block is checked. */
function bindingErrors(block: any, s: EditorState, documentType: "EFATURA" | "EARSIV"): string[] {
  const errs: string[] = [];
  const doc = () => fieldsFor(s.catalog, documentType, "document");
  const line = () => fieldsFor(s.catalog, documentType, "line");
  if (block.type === "field" && !doc().some(f => f.id === block.field))
    errs.push(`"${String(block.field)}" is not a document-scope catalog id`);
  if (block.type === "lineTable" && Array.isArray(block.columns)) {
    const allowed = line();
    block.columns.forEach((c: any, i: number) => {
      if (!allowed.some(f => f.id === c?.field)) errs.push(`column ${i}: "${String(c?.field)}" is not a line-scope catalog id`);
    });
  }
  return errs;
}

/** Run a mutation on a deep copy of the template; validate; commit to history. Never throws. */
function edit(s: EditorState, mutate: (t: any) => string[] | void): OpResult {
  try {
    if (!validState(s)) return fail("invalid editor state");
    const draft = clone(s.template) as any;
    const errs = mutate(draft);
    if (errs && errs.length) return fail(...errs);
    let json: unknown;
    try { json = JSON.parse(JSON.stringify(draft)); } catch { return fail("template must be JSON-serializable"); }
    const v = validateTemplate(json);
    if (!v.ok) return fail(...v.errors);
    const ids = v.value.sections.flatMap((sec) => sec.blocks.map((b: any) => b.id));
    const dup = ids.find((id: string, i: number) => ids.indexOf(id) !== i);
    if (dup !== undefined) return fail(`duplicate block id "${dup}"`);
    const h = histOf(s);
    return { ok: true, state: make(deepFreeze(v.value), s.catalog, { past: [...h.past, s.template], future: [] }) };
  } catch (e) {
    return fail(msg(e));
  }
}

function locate(t: any, blockId: unknown): { section: any; index: number; block: any } | undefined {
  for (const section of t.sections) {
    const index = section.blocks.findIndex((b: any) => b.id === blockId);
    if (index >= 0) return { section, index, block: section.blocks[index] };
  }
  return undefined;
}
const findSection = (t: any, id: unknown) => t.sections.find((s: any) => s.id === id);

export function addBlock(s: EditorState, sectionId: string, block: Block, index?: number): OpResult {
  return edit(s, t => {
    const sec = findSection(t, sectionId);
    if (!sec) return [`unknown section "${String(sectionId)}"`];
    if (!isObj(block)) return ["block must be an object"];
    const at = index === undefined ? sec.blocks.length : index;
    if (!Number.isInteger(at) || at < 0 || at > sec.blocks.length) return [`index ${String(index)} out of range`];
    const be = bindingErrors(block, s, t.documentType);
    if (be.length) return be;
    sec.blocks.splice(at, 0, clone(block));
  });
}

export function removeBlock(s: EditorState, blockId: string): OpResult {
  return edit(s, t => {
    const loc = locate(t, blockId);
    if (!loc) return [`unknown block "${String(blockId)}"`];
    loc.section.blocks.splice(loc.index, 1);
  });
}

export function moveBlock(s: EditorState, blockId: string, toSectionId: string, toIndex: number): OpResult {
  return edit(s, t => {
    const loc = locate(t, blockId);
    if (!loc) return [`unknown block "${String(blockId)}"`];
    const to = findSection(t, toSectionId);
    if (!to) return [`unknown section "${String(toSectionId)}"`];
    loc.section.blocks.splice(loc.index, 1); // toIndex is relative to the target after removal
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > to.blocks.length) return [`index ${String(toIndex)} out of range`];
    to.blocks.splice(toIndex, 0, loc.block);
  });
}

const colFields = (b: any): unknown[] | undefined => (Array.isArray(b?.columns) ? b.columns.map((c: any) => c?.field) : undefined);
const sameList = (a: unknown[] | undefined, b: unknown[] | undefined) =>
  a === undefined || b === undefined ? a === b : a.length === b.length && a.every((x, i) => x === b[i]);

export function updateBlock(s: EditorState, blockId: string, patch: Partial<Block>): OpResult {
  return edit(s, t => {
    const loc = locate(t, blockId);
    if (!loc) return [`unknown block "${String(blockId)}"`];
    if (!isObj(patch)) return ["patch must be an object"];
    const cur = loc.block;
    const p = patch as Record<string, any>;
    if ("field" in p && p.field !== cur.field) return ["updateBlock cannot change a field binding; use bindField"];
    if ("type" in p && p.type !== cur.type && (cur.type === "field" || cur.type === "lineTable" || p.type === "field" || p.type === "lineTable"))
      return ["updateBlock cannot change binding block types"];
    if ("columns" in p) {
      if (cur.type !== "lineTable" || !sameList(colFields(p), colFields(cur)))
        return ["updateBlock cannot change column bindings; use bindColumn"];
    }
    loc.section.blocks[loc.index] = { ...cur, ...clone(p) };
  });
}

export function bindField(s: EditorState, blockId: string, fieldId: string): OpResult {
  return edit(s, t => {
    const loc = locate(t, blockId);
    if (!loc) return [`unknown block "${String(blockId)}"`];
    if (loc.block.type !== "field") return [`block "${blockId}" is not a field block`];
    const allowed = fieldsFor(s.catalog, t.documentType, "document");
    if (typeof fieldId !== "string" || !allowed.some(f => f.id === fieldId)) return [`"${String(fieldId)}" is not a document-scope catalog id`];
    loc.block.field = fieldId;
  });
}

export function bindColumn(s: EditorState, blockId: string, columnIndex: number, fieldId: string): OpResult {
  return edit(s, t => {
    const loc = locate(t, blockId);
    if (!loc) return [`unknown block "${String(blockId)}"`];
    if (loc.block.type !== "lineTable") return [`block "${blockId}" is not a lineTable block`];
    const cols = loc.block.columns;
    if (!Array.isArray(cols) || !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= cols.length)
      return [`column index ${String(columnIndex)} out of range`];
    const allowed = fieldsFor(s.catalog, t.documentType, "line");
    if (typeof fieldId !== "string" || !allowed.some(f => f.id === fieldId)) return [`"${String(fieldId)}" is not a line-scope catalog id`];
    cols[columnIndex].field = fieldId;
  });
}

export function undo(s: EditorState): EditorState {
  try {
    const h = histOf(s);
    if (!validState(s) || h.past.length === 0) return s;
    const prev = h.past[h.past.length - 1];
    return make(prev, s.catalog, { past: h.past.slice(0, -1), future: [s.template, ...h.future] });
  } catch {
    return s;
  }
}

export function redo(s: EditorState): EditorState {
  try {
    const h = histOf(s);
    if (!validState(s) || h.future.length === 0) return s;
    const [next, ...rest] = h.future;
    return make(next, s.catalog, { past: [...h.past, s.template], future: rest });
  } catch {
    return s;
  }
}

/** Binding errors of every block in a template (used by the element's `template` setter; not part of index.ts). */
export function templateBindingErrors(template: Template, catalog: Catalog): string[] {
  const s = { template, catalog } as EditorState;
  return template.sections.flatMap(sec => sec.blocks.flatMap(b => bindingErrors(b, s, template.documentType)));
}
