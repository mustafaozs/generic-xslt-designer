// Acceptance for issue #15: complete synthetic e-Arşiv fixture + golden (lines, totals, watermark, note).
// The golden template is defaultTemplate("EARSIV") plus a "notes" section (doc.note); the stock default has no note block.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src";
import { loadCatalog } from "../../ubl-catalog/src";
import { defaultTemplate } from "../../template-model/src";
import { normalizeHtml } from "./html-normalize";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const NOTE = "İrsaliye yerine geçer";

function findEngine(): string | null {
  for (const py of [process.env.PYTHON, "python", "python3"].filter((p): p is string => !!p)) {
    try { execFileSync(py, ["-c", "import lxml.etree"], { stdio: "ignore" }); return py; } catch { /* try next */ }
  }
  return null;
}
const engine = findEngine();
if (!engine && process.env.GOLDEN_REQUIRE_ENGINE) throw new Error("libxslt engine missing: pip install lxml");

const template = defaultTemplate("EARSIV");
template.sections.push({ id: "notes", kind: "notes", blocks: [{ id: "note", type: "field", field: "doc.note" }] } as never);
const result = generate(template, loadCatalog());

function render(fixture: string): string {
  const xsltPath = join(mkdtempSync(join(tmpdir(), "earsiv-full-")), "stylesheet.xslt");
  writeFileSync(xsltPath, result.xslt, "utf8");
  return normalizeHtml(execFileSync(engine!, [join(root, "scripts", "xslt-transform.py"), xsltPath, join(root, "fixtures", "ubl", fixture)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
}
const xml = readFileSync(join(root, "fixtures", "ubl", "earsiv-full.xml"), "utf8");

describe("earsiv-full fixture", () => {
  test("structure: EARSIVFATURA, 4 lines, one LegalMonetaryTotal, note present", () => {
    expect(xml).toContain("<cbc:ProfileID>EARSIVFATURA</cbc:ProfileID>");
    expect((xml.match(/<cac:InvoiceLine>/g) ?? []).length).toBe(4);
    expect((xml.match(/<cac:LegalMonetaryTotal>/g) ?? []).length).toBe(1);
    expect(xml).toContain(NOTE);
  });
  test("binds without errors", () => { expect(result.errors).toEqual([]); });

  test("complete golden: id, ETTN, date, lines, totals, Yalnız", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const html = render("earsiv-full.xml");
    for (const s of ["ORE2026000000001", "7d1e4b86-2c93-4f0a-8b57-a3e9c60d1f24", "01-07-2026",
      "Ürün 01 – Defter", "Ürün 02 – Kalem Seti", "Ürün 03 – Masa Lambası", "Ürün 04 – Un",
      "Mal Hizmet Toplam Tutarı", "Vergi Hariç Tutar", "Hesaplanan KDV", "Ödenecek Tutar", "2.375,00 TL", "Yalnız:"]) expect(html).toContain(s);
  });

  test("watermark and note", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const html = render("earsiv-full.xml");
    expect(html).toContain("e-Arşiv Fatura");
    expect(html).toContain(NOTE);
  });

  test("note absent in variant, watermark still present", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const html = render("earsiv-full-nonote.xml");
    expect(html).toContain("e-Arşiv Fatura");
    expect(html).not.toContain(NOTE);
  });

  test("exactly 4 line-table body rows", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const body = /<table class="blk lines">.*?<tbody>(.*?)<\/tbody>/s.exec(render("earsiv-full.xml"))![1];
    expect((body.match(/<tr>/g) ?? []).length).toBe(4);
  });
});
