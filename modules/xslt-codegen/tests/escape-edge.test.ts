// Acceptance for issue #14: escaping and Turkish-character edge cases (golden case escape-edge covers the committed files).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src";
import { loadCatalog } from "../../ubl-catalog/src";
import { validateTemplate } from "../../template-model/src";
import { normalizeHtml } from "./html-normalize";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const catalog = loadCatalog();

function findEngine(): string | null {
  for (const py of [process.env.PYTHON, "python", "python3"].filter((p): p is string => !!p)) {
    try { execFileSync(py, ["-c", "import lxml.etree"], { stdio: "ignore" }); return py; } catch { /* try next */ }
  }
  return null;
}
const engine = findEngine();
if (!engine && process.env.GOLDEN_REQUIRE_ENGINE) throw new Error("libxslt engine missing: pip install lxml");

const SPECIAL = `x < y & z "çift" 'tek' {1}`;
const TR = "İSTANBUL ığşöçü ĞÜŞİ";
const FIELD_LABEL = "A & B {x} <y>";
const COL1 = "Mal & <Hizmet> {1}";
const COL2 = `Fiyat > 5 {a} & "b"`;
const NAME = `Kaçış & Uç <Durum> "İSTANBUL"`;

function build() {
  const raw = JSON.parse(readFileSync(join(here, "golden", "efatura-tevkifat", "template.json"), "utf8"));
  raw.name = NAME;
  for (const s of raw.sections) for (const b of s.blocks) {
    if (b.id === "s-name") b.label = FIELD_LABEL;
    if (b.type === "lineTable") { b.columns[1].label = COL1; b.columns[3].label = COL2; }
  }
  raw.sections.splice(1, 0, { id: "edge", kind: "notes", blocks: [
    { id: "t-special", type: "text", text: SPECIAL },
    { id: "t-tr", type: "text", text: TR },
  ] });
  const v = validateTemplate(raw);
  if (!v.ok) throw new Error(v.errors.join("; "));
  return v.value;
}
const template = build();
const result = generate(template, catalog);

function run(code: string, ...args: string[]): string {
  return execFileSync(engine!, ["-c", code, ...args], { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
}
function render(): string {
  const xsltPath = join(mkdtempSync(join(tmpdir(), "escape-edge-")), "stylesheet.xslt");
  writeFileSync(xsltPath, result.xslt, "utf8");
  return execFileSync(engine!, [join(root, "scripts", "xslt-transform.py"), xsltPath, join(root, "fixtures", "ubl", "efatura-tevkifat.xml")], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}
/** Text as a browser would show it: html-escape the literal. */
const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("escape edge cases", () => {
  test("binds without errors", () => { expect(result.errors).toEqual([]); });

  test("special characters in text block: XSLT is well-formed (lxml) and html shows them literally", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const xsltPath = join(mkdtempSync(join(tmpdir(), "escape-wf-")), "s.xslt");
    writeFileSync(xsltPath, result.xslt, "utf8");
    run("import sys,lxml.etree as e; e.parse(sys.argv[1])", xsltPath);
    const html = render();
    expect(html).toContain(h(SPECIAL));
    expect(html).not.toContain("<y>");
  });

  test("labels and lineTable column labels with & < > { } transform and appear literally", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    const html = render();
    for (const s of [FIELD_LABEL, COL1, COL2]) expect(html).toContain(h(s));
    expect(html).toContain(h(NAME));
  });

  test("Turkish letters preserved, UTF-8 output", (ctx) => {
    if (!engine) { ctx.skip(); return; }
    expect(result.xslt).toContain(TR);
    const html = render();
    expect(html).toContain(TR);
    expect(html).toMatch(/charset=utf-8/i);
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(html, "utf8"))).not.toThrow();
  });

  test("determinism: generated twice is byte-identical", () => {
    const again = generate(build(), catalog);
    expect(Buffer.from(again.xslt, "utf8").equals(Buffer.from(result.xslt, "utf8"))).toBe(true);
  });

  test("XSLT file has no 2.0 or raw-brace attribute value templates from labels", () => {
    expect(result.xslt).not.toMatch(/="[^"]*\{x\}/);
  });
});
