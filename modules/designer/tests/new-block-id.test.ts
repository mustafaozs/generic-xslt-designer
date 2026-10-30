import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultTemplate } from "../../template-model/src";
import { loadCatalog } from "../../ubl-catalog/src";
import * as publicApi from "../src";
import { createState, addBlock } from "../src";
import { newBlockId } from "../src/internal";

const ID_RE = /^[a-z][a-z0-9-]{1,40}$/; // contracts/template-model.schema.json block id pattern
const mk = () => createState(defaultTemplate("EARSIV"), loadCatalog());
const allIds = (s: any) => s.template.sections.flatMap((x: any) => x.blocks.map((b: any) => b.id));

describe("newBlockId (internal)", () => {
  it("proposes a valid, unused id", () => {
    const s = mk();
    const id = newBlockId(s);
    expect(id).toMatch(ID_RE);
    expect(allIds(s)).not.toContain(id);
  });
  it("never collides across repeated proposals", () => {
    let s = mk();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = newBlockId(s);
      const r = addBlock(s, "header", { id, type: "text", text: "x" } as any);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
      ids.push(id);
    }
    expect(new Set(ids).size).toBe(5);
  });
  it("does not alter state", () => {
    const s = mk();
    const snap = JSON.parse(JSON.stringify({ template: s.template, catalog: s.catalog }));
    expect(() => newBlockId(s)).not.toThrow();
    expect(JSON.parse(JSON.stringify({ template: s.template, catalog: s.catalog }))).toEqual(snap);
  });
  it("keeps public surface and addBlock duplicate rejection", () => {
    const doc = readFileSync(new URL("../../../contracts/designer.md", import.meta.url), "utf8");
    const names = ["createState", "addBlock", "removeBlock", "moveBlock", "updateBlock", "bindField", "bindColumn", "undo", "redo"];
    for (const n of names) expect(doc).toContain(`export function ${n}(`);
    expect(Object.keys(publicApi).sort()).toEqual([...names].sort());
    expect(Object.keys(publicApi)).not.toContain("newBlockId");
    const s = mk();
    const dup = allIds(s)[0];
    expect(addBlock(s, "header", { id: dup, type: "text", text: "x" } as any).ok).toBe(false);
  });
});
