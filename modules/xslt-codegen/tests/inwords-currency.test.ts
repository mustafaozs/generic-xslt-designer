// #28: currency-aware in-words-tr (ADR-0005). Expected strings are hand-written (adjacent number words, ADR-0005 option A).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src";
import { loadCatalog } from "../../ubl-catalog/src";
import { defaultTemplate } from "../../template-model/src";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const base = readFileSync(join(root, "fixtures", "ubl", "inwords-matrix", "payable-0.00.xml"), "utf8");

function findEngine(): string | null {
  for (const py of [process.env.PYTHON, "python", "python3"].filter((p): p is string => !!p)) {
    try { execFileSync(py, ["-c", "import lxml.etree"], { stdio: "ignore" }); return py; } catch { /* try next */ }
  }
  return null;
}
const engine = findEngine();
if (!engine && process.env.GOLDEN_REQUIRE_ENGINE) throw new Error("libxslt engine missing: pip install lxml");

const dir = mkdtempSync(join(tmpdir(), "inwords-cur-"));
const xsltPath = join(dir, "stylesheet.xslt");
writeFileSync(xsltPath, generate(defaultTemplate("EFATURA"), loadCatalog()).xslt, "utf8");

function inWords(cur: string, amount: string): string {
  const xml = base.replace(/>TRY</g, `>${cur}<`).replace(/currencyID="TRY"/g, `currencyID="${cur}"`).replace(/>0\.00</g, `>${amount}<`);
  const f = join(dir, `${cur}-${amount}.xml`);
  writeFileSync(f, xml, "utf8");
  const html = execFileSync(engine!, [join(root, "scripts", "xslt-transform.py"), xsltPath, f], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const m = html.match(/Yalnız: ([^<\n]*)/);
  if (!m) throw new Error("no in-words text");
  return "Yalnız: " + m[1].trim();
}

const table: Array<[string, string, string]> = [
  ["TRY", "1234.50", "Yalnız: BinİkiYüzOtuzDört TL Elli Kr"],
  ["TRY", "0.00", "Yalnız: Sıfır TL Sıfır Kr"],
  ["USD", "1234.50", "Yalnız: BinİkiYüzOtuzDört USD Elli Cent"],
  ["EUR", "1234.50", "Yalnız: BinİkiYüzOtuzDört EUR Elli Cent"],
  ["GBP", "1234.50", "Yalnız: BinİkiYüzOtuzDört GBP Elli Pence"],
  ["CHF", "1200.50", "Yalnız: BinİkiYüz CHF 50/100"],
  ["CHF", "1200.05", "Yalnız: BinİkiYüz CHF 05/100"],
  ["EUR", "0.00", "Yalnız: Sıfır EUR Sıfır Cent"],
  ["USD", "100.00", "Yalnız: Yüz USD"],
];

describe("in-words-tr currency (ADR-0005)", () => {
  test.skipIf(!engine).each(table)("%s %s", (cur, amount, expected) => {
    expect(inWords(cur, amount)).toBe(expected);
  });
});
