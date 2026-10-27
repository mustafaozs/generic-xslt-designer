// Golden harness: one folder per case under tests/golden (see README there).
// `npm run golden:update` rewrites expected.* through vitest -u; never edit them by hand.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src";
import { loadCatalog, XPATH2_TOKENS } from "../../ubl-catalog/src";
import { validateTemplate } from "../../template-model/src";
import { normalizeHtml } from "./html-normalize";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const goldenDir = join(here, "golden");
const transformScript = join(root, "scripts", "xslt-transform.py");
const catalog = loadCatalog();

const cases = readdirSync(goldenDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

/** Python interpreter with lxml, or null. CI sets GOLDEN_REQUIRE_ENGINE=1 so a missing engine fails instead of skipping. */
function findEngine(): string | null {
  for (const py of [process.env.PYTHON, "python", "python3"].filter((p): p is string => !!p)) {
    try { execFileSync(py, ["-c", "import lxml.etree"], { stdio: "ignore" }); return py; } catch { /* try next */ }
  }
  return null;
}
const engine = findEngine();
if (!engine && process.env.GOLDEN_REQUIRE_ENGINE) throw new Error("libxslt engine missing: pip install lxml");

for (const name of cases) describe(`golden/${name}`, () => {
  const dir = join(goldenDir, name);
  const meta = JSON.parse(readFileSync(join(dir, "case.json"), "utf8")) as { fixture: string };
  const parsed = validateTemplate(JSON.parse(readFileSync(join(dir, "template.json"), "utf8")));
  if (!parsed.ok) throw new Error(`template.json invalid: ${parsed.errors.join("; ")}`);
  const result = generate(parsed.value, catalog);

  test("binds without errors", () => { expect(result.errors).toEqual([]); });

  test("expected.xslt is byte-identical", async () => {
    await expect(result.xslt).toMatchFileSnapshot(join(dir, "expected.xslt"));
  });

  test("deterministic: second run is identical", () => {
    expect(generate(parsed.value, catalog).xslt).toBe(result.xslt);
  });

  test("is XSLT 1.0 and self-contained", () => {
    expect(result.xslt).toMatch(/<xsl:stylesheet version="1\.0"/);
    expect(result.xslt).toMatch(/<xsl:output method="html" encoding="UTF-8"/);
    for (const re of XPATH2_TOKENS) expect(result.xslt).not.toMatch(re);
    expect(result.xslt).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(result.xslt).not.toMatch(/<script|javascript:|\son[a-z]+=/i);
    expect(result.xslt).not.toMatch(/position\(\)/);
  });

  test("expected.html matches libxslt output (normalised)", async (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const fixture = join(root, "fixtures", "ubl", meta.fixture);
    if (!existsSync(fixture)) throw new Error(`fixture missing: ${fixture}`);
    const xsltPath = join(mkdtempSync(join(tmpdir(), "golden-")), "stylesheet.xslt");
    writeFileSync(xsltPath, result.xslt, "utf8");
    const html = execFileSync(engine, [transformScript, xsltPath, fixture], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    await expect(normalizeHtml(html)).toMatchFileSnapshot(join(dir, "expected.html"));
  });
});
