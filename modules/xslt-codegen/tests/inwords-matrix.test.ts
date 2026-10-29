// #16: in-words-tr boundary amounts. Expected strings are written by hand (card spelling: adjacent words,
// "<lira> TL <kuruş> Kr"), never derived from engine output.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src";
import { loadCatalog } from "../../ubl-catalog/src";
import { defaultTemplate } from "../../template-model/src";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const matrix = join(root, "fixtures", "ubl", "inwords-matrix");

function findEngine(): string | null {
  for (const py of [process.env.PYTHON, "python", "python3"].filter((p): p is string => !!p)) {
    try { execFileSync(py, ["-c", "import lxml.etree"], { stdio: "ignore" }); return py; } catch { /* try next */ }
  }
  return null;
}
const engine = findEngine();
if (!engine && process.env.GOLDEN_REQUIRE_ENGINE) throw new Error("libxslt engine missing: pip install lxml");

const result = generate(defaultTemplate("EFATURA"), loadCatalog());
const xsltPath = join(mkdtempSync(join(tmpdir(), "inwords-")), "stylesheet.xslt");
writeFileSync(xsltPath, result.xslt, "utf8");

function inWords(fixture: string): string {
  const html = execFileSync(engine!, [join(root, "scripts", "xslt-transform.py"), xsltPath, join(matrix, fixture)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const m = html.match(/Yalnız: ([^<\n]*)/);
  if (!m) throw new Error("no in-words text in output of " + fixture);
  return m[1].trim();
}

const table: Array<[string, string]> = [
  ["payable-0.00.xml", "Sıfır TL"],
  ["payable-0.01.xml", "Sıfır TL Bir Kr"],
  ["payable-1.00.xml", "Bir TL"],
  ["payable-10.00.xml", "On TL"],
  ["payable-100.00.xml", "Yüz TL"],
  ["payable-1000.00.xml", "Bin TL"],
  ["payable-1001.00.xml", "BinBir TL"],
  ["payable-1000000.00.xml", "BirMilyon TL"],
  ["payable-1234567.89.xml", "BirMilyonİkiYüzOtuzDörtBinBeşYüzAltmışYedi TL SeksenDokuz Kr"],
  ["payable-999999999.99.xml", "DokuzYüzDoksanDokuzMilyonDokuzYüzDoksanDokuzBinDokuzYüzDoksanDokuz TL DoksanDokuz Kr"],
];

describe("in-words-tr boundary matrix", () => {
  test("generation has no errors", () => { expect(result.errors).toEqual([]); });

  test.each(table)("%s", (fixture, expected, ctx) => {
    if (!engine) { ctx.skip(); return; }
    expect(inWords(fixture)).toBe(expected);
  });

  test("kuruş-only 0.05 ends with 'Beş Kr'", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const five = inWords("payable-0.05.xml");
    expect(five.endsWith("Beş Kr")).toBe(true);
    expect(five).toBe("Sıfır TL Beş Kr");
  });

  test("rounding: payable 10.014 (lines 3.338 x3) rounds to 10.01, gives 'On TL Bir Kr', no float artefacts", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    expect(inWords("payable-10.01-rounding.xml")).toBe("On TL Bir Kr");
  });
});

describe("stylesheet is XSLT 1.0 only and deterministic", () => {
  test("no XPath 2.0 tokens", () => {
    const banned = [/\bmatches\s*\(/, /\btokenize\s*\(/, /\breplace\s*\(/, /\bif\s*\(.*\)\s*then\b/, /\bfor\s+\$\w+\s+in\b/, /\bsome\s+\$/, /\bevery\s+\$/, /\bupper-case\s*\(/, /\blower-case\s*\(/, /\bstring-join\s*\(/, /\bxsl:function\b/, /\bxsl:analyze-string\b/, /\bxsl:for-each-group\b/, /\binstance\s+of\b/, /\bcast\s+as\b/, /\bxs:/, /version="2\.0"/];
    for (const re of banned) expect(result.xslt).not.toMatch(re);
    expect(result.xslt).toContain('version="1.0"');
  });
  test("generating twice is byte-identical", () => {
    const again = generate(defaultTemplate("EFATURA"), loadCatalog());
    expect(again.xslt).toBe(result.xslt);
  });
});
