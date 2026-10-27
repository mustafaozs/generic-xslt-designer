// Acceptance for issue #4: golden case on a full e-Fatura (lines, totals, withholding, "Yalnız: …").
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
const fixturePath = join(root, "fixtures", "ubl", "efatura-tevkifat.xml");
const xml = readFileSync(fixturePath, "utf8");
const count = (re: RegExp) => (xml.match(re) ?? []).length;

function findEngine(): string | null {
  for (const py of [process.env.PYTHON, "python", "python3"].filter((p): p is string => !!p)) {
    try { execFileSync(py, ["-c", "import lxml.etree"], { stdio: "ignore" }); return py; } catch { /* try next */ }
  }
  return null;
}
const engine = findEngine();
if (!engine && process.env.GOLDEN_REQUIRE_ENGINE) throw new Error("libxslt engine missing: pip install lxml");

describe("fixtures/ubl/efatura-tevkifat.xml structure", () => {
  test("has 13 lines, one LegalMonetaryTotal, one WithholdingTaxTotal, one AllowanceCharge", () => {
    expect(count(/<cac:InvoiceLine>/g)).toBe(13);
    expect(count(/<cac:LegalMonetaryTotal>/g)).toBe(1);
    expect(count(/<cac:WithholdingTaxTotal>/g)).toBe(1);
    expect(count(/<cac:AllowanceCharge>/g)).toBe(1);
  });
});

describe("defaultTemplate(EFATURA) on the full e-Fatura", () => {
  const result = generate(defaultTemplate("EFATURA"), loadCatalog());
  test("binds without errors", () => { expect(result.errors).toEqual([]); });

  test("html shows every line, totals rows, withholding row and Yalnız", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const xsltPath = join(mkdtempSync(join(tmpdir(), "efatura-")), "stylesheet.xslt");
    writeFileSync(xsltPath, result.xslt, "utf8");
    const html = normalizeHtml(execFileSync(engine, [join(root, "scripts", "xslt-transform.py"), xsltPath, fixturePath], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
    const names = [...xml.matchAll(/<cbc:Name>(Ürün \d\d – [^<]+)<\/cbc:Name>/g)].map(m => m[1]);
    expect(names).toHaveLength(13);
    for (const n of names) expect(html).toContain(n);
    for (const label of ["Mal Hizmet Toplam Tutarı", "Toplam İskonto", "Vergi Hariç Tutar", "Hesaplanan KDV", "Vergiler Dahil Toplam Tutar", "Ödenecek Tutar"]) expect(html).toContain(label);
    expect(html).toMatch(/<th>Tevkifat<\/th><td>4\.855,84 TL<\/td>/);
    expect(html).toMatch(/<th>Ödenecek Tutar<\/th><td>54\.260,24 TL<\/td>/);
    // PayableAmount 54260.24 -> in-words-tr concatenates words without spaces (see codegen inWordsInt)
    expect(html).toContain("Yalnız: ElliDörtBinİkiYüzAltmış TL YirmiDört Kr");
  });
});
