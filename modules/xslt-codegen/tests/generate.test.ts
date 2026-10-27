import { generate } from "../src";
import { loadCatalog } from "../../ubl-catalog/src";
import { defaultTemplate } from "../../template-model/src";
import type { Template } from "../../template-model/src";

const catalog = loadCatalog();
const field = (id: string, extra: Record<string, unknown> = {}) => ({ id: "b", type: "field", field: id, ...extra });
const withBlocks = (dt: "EFATURA" | "EARSIV", blocks: unknown[]): Template =>
  ({ version: 1, documentType: dt, page: { size: "A4", margins: { top: 5, right: 5, bottom: 5, left: 5 } }, theme: {},
    sections: [{ id: "s", kind: "body", blocks }] }) as unknown as Template;

test("unknown catalog id is an error carrying the block id", () => {
  const r = generate(withBlocks("EFATURA", [field("doc.nope")]), catalog);
  expect(r.errors).toEqual([{ rule: "CG-FIELD-UNKNOWN", blockId: "b", message: expect.stringContaining("doc.nope") }]);
  expect(r.xslt).toContain("<xsl:stylesheet"); // still returned for debugging
});

test("line-scoped field in a document block is a scope error", () => {
  const r = generate(withBlocks("EFATURA", [field("line.name")]), catalog);
  expect(r.errors.map(e => e.rule)).toEqual(["CG-FIELD-SCOPE"]);
});

test("field restricted to another document type is an error", () => {
  const r = generate(withBlocks("EFATURA", [field("refs.okcSerial")]), catalog);
  expect(r.errors.map(e => e.rule)).toEqual(["CG-FIELD-DOCTYPE"]);
  expect(generate(withBlocks("EARSIV", [field("refs.okcSerial")]), catalog).errors).toEqual([]);
});

test("derived.pageNo renders empty with a warning, not an error", () => {
  const r = generate(withBlocks("EFATURA", [field("derived.pageNo")]), catalog);
  expect(r.errors).toEqual([]);
  expect(r.warnings.map(w => w.rule)).toEqual(["CG-FIELD-UNSUPPORTED"]);
  expect(r.xslt).toContain(`<xsl:variable name="page" select="''"/>`);
});

test("only the named templates and variables that are used are emitted", () => {
  const r = generate(withBlocks("EFATURA", [field("doc.id")]), catalog);
  expect(r.xslt).not.toContain('name="money"');
  expect(r.xslt).not.toContain('name="in-words-tr"');
  expect(r.xslt).not.toContain('name="watermark"');
  const d = generate(defaultTemplate("EARSIV"), catalog);
  expect(d.errors).toEqual([]);
  expect(d.xslt).toContain('<xsl:template name="money">');
  expect(d.xslt).toContain('<xsl:template name="in-words-tr">');
  expect(d.xslt).toContain(`select="'e-Arşiv Fatura'"`);
});

test("labels and text are XML-escaped", () => {
  const r = generate(withBlocks("EFATURA", [field("doc.id", { label: "A & <B>" }), { id: "t", type: "text", text: "x < y" }]), catalog);
  expect(r.xslt).toContain("A &amp; &lt;B&gt;: ");
  expect(r.xslt).toContain("x &lt; y");
});

test("lineTable renders every cac:InvoiceLine without a position() cap", () => {
  const r = generate(defaultTemplate("EFATURA"), catalog);
  expect(r.xslt).toContain('<xsl:for-each select="cac:InvoiceLine">');
  expect(r.xslt).not.toMatch(/position\(\)/);
});
