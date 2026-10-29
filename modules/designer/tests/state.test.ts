import { defaultTemplate, validateTemplate } from "../../template-model/src";
import type { Template } from "../../template-model/src";
import { loadCatalog, fieldsFor } from "../../ubl-catalog/src";
import {
  createState, addBlock, removeBlock, moveBlock, updateBlock, bindField, bindColumn, undo, redo,
  type EditorState, type OpResult
} from "../src";

const catalog = loadCatalog();
const mk = (dt: "EFATURA" | "EARSIV" = "EFATURA") => createState(defaultTemplate(dt), catalog);
const snap = (s: EditorState) => JSON.stringify(s.template);
function ok(r: OpResult): EditorState {
  if (!r.ok) throw new Error("expected ok: " + r.errors.join("; "));
  expect(validateTemplate(r.state.template).ok).toBe(true);
  return r.state;
}
const note = { id: "note-a", type: "text", text: "sentetik not" } as any;

describe("purity", () => {
  test("ops return new state, leave input unchanged, stay valid", () => {
    const s0 = mk();
    const before = snap(s0);
    const s1 = ok(addBlock(s0, "header", note));
    expect(s1).not.toBe(s0);
    expect(snap(s0)).toBe(before);
    expect(s1.template.sections[0]!.blocks.some(b => b.id === "note-a")).toBe(true);

    const b1 = snap(s1);
    const s2 = ok(moveBlock(s1, "note-a", "header", 0)); // within
    expect(snap(s1)).toBe(b1);
    expect(s2.template.sections[0]!.blocks[0].id).toBe("note-a");

    const b2 = snap(s2);
    const s3 = ok(moveBlock(s2, "note-a", "parties", 1)); // across
    expect(snap(s2)).toBe(b2);
    expect(s3.template.sections[1]!.blocks[1].id).toBe("note-a");
    expect(s3.template.sections[0]!.blocks.some(b => b.id === "note-a")).toBe(false);

    const b3 = snap(s3);
    const s4 = ok(updateBlock(s3, "note-a", { text: "yeni" } as any));
    expect(snap(s3)).toBe(b3);
    expect((s4.template.sections[1]!.blocks[1] as any).text).toBe("yeni");

    const b4 = snap(s4);
    const s5 = ok(removeBlock(s4, "note-a"));
    expect(snap(s4)).toBe(b4);
    expect(s5.template.sections.flatMap(s => s.blocks).some(b => b.id === "note-a")).toBe(false);
    expect(snap(s5)).toBe(before);
  });

  test("deeply frozen input does not break ops", () => {
    const deepFreeze = (o: any): any => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
    const t = deepFreeze(defaultTemplate("EFATURA")) as Template;
    const s = createState(t, catalog);
    ok(addBlock(s, "header", deepFreeze({ ...note })));
    ok(bindField(s, "doc-id", "doc.issueDate"));
    ok(bindColumn(s, "line-table", 0, "line.name"));
    ok(removeBlock(s, "doc-id"));
  });

  test("rejections: unknown section/block, duplicate id, bad index, bad block, bad id pattern", () => {
    const s = mk();
    const before = snap(s);
    const cases: OpResult[] = [
      addBlock(s, "nope", note),
      addBlock(s, "header", { id: "doc-id", type: "text", text: "x" } as any),
      addBlock(s, "header", note, 99),
      addBlock(s, "header", note, -1),
      addBlock(s, "header", { id: "Bad Id", type: "text", text: "x" } as any),
      addBlock(s, "header", { id: "note-b", type: "text" } as any), // text required
      addBlock(s, "header", null as any),
      removeBlock(s, "nope"),
      moveBlock(s, "nope", "header", 0),
      moveBlock(s, "doc-id", "nope", 0),
      moveBlock(s, "doc-id", "header", 99),
      updateBlock(s, "nope", {}),
      updateBlock(s, "doc-id", { id: "logo" }), // duplicate id
      updateBlock(s, "doc-id", { type: "bogus" } as any)
    ];
    for (const r of cases) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    }
    expect(snap(s)).toBe(before);
  });

  test("no op throws on garbage input", () => {
    const s = mk();
    const garbage: any[] = [undefined, null, 1, {}, [], "x"];
    for (const g of garbage) {
      expect(() => addBlock(s, g, g, g)).not.toThrow();
      expect(() => removeBlock(s, g)).not.toThrow();
      expect(() => moveBlock(s, g, g, g)).not.toThrow();
      expect(() => updateBlock(s, g, g)).not.toThrow();
      expect(() => bindField(s, g, g)).not.toThrow();
      expect(() => bindColumn(s, g, g, g)).not.toThrow();
    }
    expect(() => addBlock(null as any, "header", note)).not.toThrow();
    expect(addBlock(null as any, "header", note).ok).toBe(false);
    expect(() => undo(s)).not.toThrow();
  });
});

describe("field binding by catalog id", () => {
  test("bindField accepts document-scope id", () => {
    const s = mk();
    const before = snap(s);
    const s1 = ok(bindField(s, "s-name", "supplier.name"));
    expect((s1.template.sections[1]!.blocks[0] as any).field).toBe("supplier.name");
    expect(snap(s)).toBe(before);
  });

  test("bindField rejects raw xpath, unknown id, line-scope id, wrong block type", () => {
    const s = mk();
    const before = snap(s);
    for (const id of ["//cbc:ID", "cbc:ID", "no.such.field", "", "line.name"]) {
      const r = bindField(s, "s-name", id);
      expect(r.ok, id).toBe(false);
    }
    expect(bindField(s, "line-table", "supplier.name").ok).toBe(false); // wrong block type
    expect(bindField(s, "nope", "supplier.name").ok).toBe(false);
    expect(snap(s)).toBe(before);
  });

  test("bindColumn accepts only line-scope ids", () => {
    const s = mk();
    const s1 = ok(bindColumn(s, "line-table", 1, "line.description"));
    expect((s1.template.sections[2]!.blocks[0] as any).columns[1].field).toBe("line.description");
  });

  test("bindColumn rejects document-scope id, raw xpath, bad index, wrong block type", () => {
    const s = mk();
    const before = snap(s);
    expect(bindColumn(s, "line-table", 0, "supplier.name").ok).toBe(false);
    expect(bindColumn(s, "line-table", 0, "//cbc:ID").ok).toBe(false);
    expect(bindColumn(s, "line-table", 0, "no.such.field").ok).toBe(false);
    expect(bindColumn(s, "line-table", 99, "line.name").ok).toBe(false);
    expect(bindColumn(s, "line-table", -1, "line.name").ok).toBe(false);
    expect(bindColumn(s, "line-table", 0.5, "line.name").ok).toBe(false);
    expect(bindColumn(s, "s-name", 0, "line.name").ok).toBe(false);
    expect(snap(s)).toBe(before);
  });

  test("scope-aware choices: column binding accepts exactly fieldsFor(EARSIV, line)", () => {
    const s = mk("EARSIV");
    const allowed = new Set(fieldsFor(catalog, "EARSIV", "line").map(f => f.id));
    expect(allowed.size).toBeGreaterThan(0);
    for (const f of catalog.fields) {
      expect(bindColumn(s, "line-table", 0, f.id).ok, f.id).toBe(allowed.has(f.id));
    }
    const docAllowed = new Set(fieldsFor(catalog, "EARSIV", "document").map(f => f.id));
    for (const f of catalog.fields) {
      expect(bindField(s, "s-name", f.id).ok, f.id).toBe(docAllowed.has(f.id));
    }
  });

  test("updateBlock cannot change bindings", () => {
    const s = mk();
    const before = snap(s);
    expect(updateBlock(s, "s-name", { field: "supplier.taxId" } as any).ok).toBe(false);
    expect(updateBlock(s, "s-name", { field: "//cbc:ID" } as any).ok).toBe(false);
    const cols = (s.template.sections[2]!.blocks[0] as any).columns;
    const changed = cols.map((c: any, i: number) => (i === 0 ? { ...c, field: "line.name" } : c));
    expect(updateBlock(s, "line-table", { columns: changed } as any).ok).toBe(false);
    expect(updateBlock(s, "line-table", { columns: cols.slice(0, 2) } as any).ok).toBe(false);
    expect(updateBlock(s, "s-name", { type: "text", text: "x" } as any).ok).toBe(false);
    expect(snap(s)).toBe(before);
  });

  test("updateBlock allows non-binding patches, including same-binding columns", () => {
    const s = mk();
    const cols = (s.template.sections[2]!.blocks[0] as any).columns;
    const relabel = cols.map((c: any, i: number) => (i === 0 ? { ...c, label: "No" } : c));
    const s1 = ok(updateBlock(s, "line-table", { columns: relabel } as any));
    expect((s1.template.sections[2]!.blocks[0] as any).columns[0].label).toBe("No");
    ok(updateBlock(s, "s-name", { label: "Satici", field: "supplier.name" } as any));
  });
});

describe("undo / redo", () => {
  test("three ops, undo twice, redo once equals state after second op", () => {
    const s0 = mk();
    const s1 = ok(addBlock(s0, "header", note));
    const s2 = ok(bindField(s1, "s-name", "supplier.name"));
    const s3 = ok(removeBlock(s2, "doc-id"));
    const u = undo(undo(s3));
    expect(snap(u)).toBe(snap(s1));
    const r = redo(u);
    expect(snap(r)).toBe(snap(s2));
    expect(snap(redo(r))).toBe(snap(s3));
  });

  test("no-ops when nothing to undo/redo; new op clears redo", () => {
    const s0 = mk();
    expect(snap(undo(s0))).toBe(snap(s0));
    expect(snap(redo(s0))).toBe(snap(s0));
    const s1 = ok(addBlock(s0, "header", note));
    const back = undo(s1);
    expect(snap(back)).toBe(snap(s0));
    const s2 = ok(addBlock(back, "header", { id: "note-c", type: "text", text: "c" } as any));
    expect(snap(redo(s2))).toBe(snap(s2));
  });

  test("rejected op does not touch history", () => {
    const s1 = ok(addBlock(mk(), "header", note));
    const bad = bindField(s1, "s-name", "//cbc:ID");
    expect(bad.ok).toBe(false);
    expect(snap(undo(s1))).toBe(snap(mk()));
  });
});
