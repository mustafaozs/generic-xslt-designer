// Acceptance for issue #12: checkTemplate REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX. All data synthetic.
import { checkTemplate } from "../src";
import { defaultTemplate, type Template } from "../../template-model/src";
import { loadCatalog } from "../../ubl-catalog/src";

const catalog = loadCatalog();
const clone = (t: Template): Template => JSON.parse(JSON.stringify(t));
const without = (t: Template, field: string): Template => {
  const c = clone(t);
  for (const s of c.sections) s.blocks = s.blocks.filter(b => (b as { field?: string }).field !== field);
  return c;
};

describe("Scenario: default templates satisfy REQ-FIELDS", () => {
  for (const dt of ["EFATURA", "EARSIV"] as const) {
    test(`${dt} default has no error hit`, () => {
      expect(checkTemplate(defaultTemplate(dt), catalog).filter(h => h.severity === "error")).toEqual([]);
    });
  }
});

describe("Scenario: a required field is removed", () => {
  test("exactly one REQ-FIELDS error naming doc.uuid", () => {
    const hits = checkTemplate(without(defaultTemplate("EFATURA"), "doc.uuid"), catalog);
    const req = hits.filter(h => h.rule === "REQ-FIELDS");
    expect(req).toHaveLength(1);
    expect(req[0].severity).toBe("error");
    expect(req[0].message).toContain("doc.uuid");
  });
  test("missing line table and totals are reported", () => {
    const t = clone(defaultTemplate("EFATURA"));
    for (const s of t.sections) s.blocks = s.blocks.filter(b => b.type !== "lineTable" && b.type !== "totals");
    const msgs = checkTemplate(t, catalog).filter(h => h.rule === "REQ-FIELDS").map(h => h.message).join("|");
    expect(msgs).toMatch(/lineTable/);
    expect(msgs).toContain("totals.payable");
  });
});

describe("Scenario: e-Arsiv watermark requirement", () => {
  test("EARSIV without derived.watermark -> REQ-EARSIV-NOTE error; EFATURA none", () => {
    const earsiv = without(defaultTemplate("EARSIV"), "derived.watermark");
    const hit = checkTemplate(earsiv, catalog).find(h => h.rule === "REQ-EARSIV-NOTE");
    expect(hit?.severity).toBe("error");
    const efatura = { ...earsiv, documentType: "EFATURA" } as Template;
    expect(checkTemplate(efatura, catalog).filter(h => h.rule === "REQ-EARSIV-NOTE")).toEqual([]);
  });
});

describe("Scenario: font and size limits", () => {
  test("FONT-SAFE warn and SIZE-MAX error", () => {
    const t = clone(defaultTemplate("EFATURA"));
    (t.theme as { fontFamily: string }).fontFamily = "Comic Sans MS"; // bypasses validation on purpose
    const logo = t.sections[0].blocks.find(b => b.type === "logo") as unknown as { dataUri: string };
    logo.dataUri = "data:image/png;base64," + "A".repeat(150 * 1024 + 1);
    const hits = checkTemplate(t, catalog);
    expect(hits.find(h => h.rule === "FONT-SAFE")?.severity).toBe("warn");
    expect(hits.find(h => h.rule === "SIZE-MAX")?.severity).toBe("error");
  });
  test("safe font and small logo give neither", () => {
    const rules = checkTemplate(defaultTemplate("EFATURA"), catalog).map(h => h.rule);
    expect(rules).not.toContain("FONT-SAFE");
    expect(rules).not.toContain("SIZE-MAX");
  });
});
