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
  const put = (s: any, section: string, id: string) => {
    const r = addBlock(s, section, { id, type: "text", text: "x" } as any);
    expect(r.ok).toBe(true);
    return (r as any).state;
  };
  it("returns the first gap (block-2) when block-1 and block-3 exist across sections", () => {
    let s = mk();
    s = put(s, "header", "block-1");
    s = put(s, "parties", "block-3");
    expect(allIds(s)).toEqual(expect.arrayContaining(["block-1", "block-3"]));
    expect(allIds(s)).not.toContain("block-2");
    expect(newBlockId(s)).toBe("block-2");
  });
  it("returns block-4 when block-1, block-2 and block-3 exist across sections", () => {
    let s = mk();
    s = put(s, "header", "block-1");
    s = put(s, "parties", "block-2");
    s = put(s, "totals", "block-3");
    expect(newBlockId(s)).toBe("block-4");
  });
});
