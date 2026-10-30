// gib-rules — RULES mirrors contracts/gib-rules.md one-to-one (drift is caught by tests/rules.test.ts)
import type { Template } from "../../template-model/src";
import { getField, type Catalog } from "../../ubl-catalog/src";

export const MODULE = "gib-rules";

export type Severity = "error" | "warn";
export type DocType = "EFATURA" | "EARSIV";
export interface Rule { id: string; severity: Severity; description: string; documentTypes: DocType[] }

const BOTH: DocType[] = ["EFATURA", "EARSIV"];
const r = (id: string, severity: Severity, description: string, documentTypes: DocType[] = BOTH): Rule =>
  ({ id, severity, description, documentTypes });

export const RULES: Rule[] = [
  r("X10-VERSION", "error", "Stylesheet declares version=\"1.0\""),
  r("X10-NO-XPATH2", "error", "No XPath 2.0 constructs"),
  r("X10-NO-RESULT-DOC", "error", "No xsl:result-document, xsl:function, xsl:character-map"),
  r("X10-OUTPUT-HTML", "error", "xsl:output method=\"html\" with UTF-8"),
  r("NET-ENGINE", "error", "Compiles with .NET XslCompiledTransform"),
  r("BROWSER-ENGINE", "error", "Transforms with browser XSLTProcessor"),
  r("EXT-NONE", "error", "No external resources; images are data URIs"),
  r("EXT-NO-SCRIPT", "error", "No script, on* attributes, or javascript:"),
  r("SIZE-MAX", "error", "Generated XSLT <= 500 KB; each logo <= 150 KB base64"),
  r("REQ-FIELDS", "error", "Mandatory invoice fields are rendered"),
  r("REQ-EARSIV-NOTE", "error", "e-Arsiv watermark and note present", ["EARSIV"]),
  r("LINES-ALL", "error", "Every cac:InvoiceLine is rendered"),
  r("CUR-FOREIGN", "warn", "TRY equivalents shown for foreign currency"),
  r("WITHHOLD", "warn", "cac:WithholdingTaxTotal rendered when present"),
  r("PRINT-PAGE", "warn", "@page size, row page-break, repeating thead"),
  r("FONT-SAFE", "warn", "Only the six safe font families"),
  r("NUM-TR", "warn", "Numbers formatted with xsl:decimal-format name=\"tr\""),
];

export interface RuleHit { rule: string; severity: Severity; message: string }

const XSLT_NS = "http://www.w3.org/1999/XSL/Transform";
const XPATH_ATTRS = new Set(["select", "test", "match", "use", "value", "group-by"]);
const TAG_RE = /<([A-Za-z_][\w.-]*(?::[\w.-]+)?)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;
const ATTR_RE = /([^\s=>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

interface Tag { name: string; attrs: [string, string][] }

function tags(xml: string): Tag[] {
  const out: Tag[] = [];
  for (const m of xml.matchAll(TAG_RE)) {
    const attrs: [string, string][] = [];
    for (const a of m[2].matchAll(ATTR_RE)) attrs.push([a[1], a[2] ?? a[3]]);
    out.push({ name: m[1], attrs });
  }
  return out;
}

// XPath 2.0 constructs, tested on an expression with string literals blanked out
const XPATH2: [string, RegExp][] = [
  ["upper-case()", /(?<![\w:.-])upper-case\s*\(/],
  ["lower-case()", /(?<![\w:.-])lower-case\s*\(/],
  ["string-join()", /(?<![\w:.-])string-join\s*\(/],
  ["tokenize()", /(?<![\w:.-])tokenize\s*\(/],
  ["matches()", /(?<![\w:.-])matches\s*\(/],
  ["exists()", /(?<![\w:.-])exists\s*\(/],
  ["current-dateTime()", /(?<![\w:.-])current-dateTime\s*\(/],
  ["if/then", /(?<![\w:.$-])if\s*\([^]*\)\s*then\b/],
  ["for/return", /(?<![\w:.-])for\s+\$[\w.-]+\s+in\b[^]*\breturn\b/],
  ["xs: type", /(?<![\w:.$-])xs:[A-Za-z]/],
];

const blankLiterals = (expr: string): string => expr.replace(/'[^']*'|"[^"]*"/g, "''");

// argument lists of each format-number(...) call in an expression (top-level comma split, quotes respected)
function formatNumberCalls(expr: string): string[][] {
  const out: string[][] = [];
  for (const m of expr.matchAll(/(?<![\w:.-])format-number\s*\(/g)) {
    const args: string[] = [];
    let depth = 1, quote = "", cur = "";
    for (let i = m.index! + m[0].length; i < expr.length; i++) {
      const c = expr[i];
      if (quote) { if (c === quote) quote = ""; }
      else if (c === "'" || c === '"') quote = c;
      else if (c === "(") depth++;
      else if (c === ")" && --depth === 0) break;
      else if (c === "," && depth === 1) { args.push(cur); cur = ""; continue; }
      cur += c;
    }
    args.push(cur);
    out.push(args);
  }
  return out;
}

export function checkXslt(xslt: string): RuleHit[] {
  const sev = new Map(RULES.map(r => [r.id, r.severity]));
  const hits: RuleHit[] = [];
  const seen = new Set<string>();
  const hit = (rule: string, message: string): void => {
    const key = `${rule}\u0000${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ rule, severity: sev.get(rule) ?? "error", message });
  };

  const text = xslt.replace(/<!--[^]*?-->/g, "");
  const all = tags(text);
  const prefix = all.flatMap(t => t.attrs).find(([n, v]) => n.startsWith("xmlns:") && v === XSLT_NS)?.[0].slice(6) ?? "xsl";
  const isXsl = (t: Tag, local: string): boolean => t.name === `${prefix}:${local}`;

  const root = all.find(t => t.name === `${prefix}:stylesheet` || t.name === `${prefix}:transform`);
  const version = root?.attrs.find(([n]) => n === "version")?.[1];
  if (version !== "1.0") hit("X10-VERSION", `stylesheet version is ${version === undefined ? "missing" : `"${version}"`}, expected "1.0"`);

  const output = all.find(t => isXsl(t, "output"));
  const get = (t: Tag | undefined, n: string): string | undefined => t?.attrs.find(([k]) => k === n)?.[1];
  if (get(output, "method") !== "html" || get(output, "encoding")?.toUpperCase() !== "UTF-8") {
    hit("X10-OUTPUT-HTML", 'xsl:output must declare method="html" and encoding="UTF-8"');
  }

  for (const t of all) {
    for (const el of ["result-document", "function", "character-map"]) {
      if (isXsl(t, el)) hit("X10-NO-RESULT-DOC", `xsl:${el} is not allowed in XSLT 1.0`);
    }
    if (t.name.startsWith(`${prefix}:`)) {
      for (const [n, v] of t.attrs) {
        if (!XPATH_ATTRS.has(n)) continue;
        const expr = blankLiterals(v);
        for (const [label, re] of XPATH2) if (re.test(expr)) hit("X10-NO-XPATH2", `XPath 2.0 construct ${label} in ${n}="${v}"`);
      }
    } else {
      for (const [n, v] of t.attrs) {
        const lower = n.toLowerCase();
        if ((lower === "src" || lower === "href") && /^\s*(?:https?:)?\/\//i.test(v)) hit("EXT-NONE", `external resource in ${n}="${v}"`);
        if (/^on[a-z]+$/.test(lower)) hit("EXT-NO-SCRIPT", `event handler attribute ${n}`);
        if (/^\s*javascript:/i.test(v)) hit("EXT-NO-SCRIPT", `javascript: URL in ${n}`);
      }
      if (t.name.toLowerCase() === "script") hit("EXT-NO-SCRIPT", "script element");
    }
  }
  const linesOk = all.some(t => isXsl(t, "for-each") && (() => {
    const expr = blankLiterals(get(t, "select") ?? "");
    return /(?<![\w.-])cac:InvoiceLine(?![\w.-])/.test(expr) && !/position\s*\(/.test(expr);
  })());
  if (!linesOk) hit("LINES-ALL", "no xsl:for-each over cac:InvoiceLine without a position() limit");
  const declaresTr = all.some(t => isXsl(t, "decimal-format") && get(t, "name") === "tr");
  const formatCalls = all.flatMap(t => t.attrs.map(([, v]) => v)).flatMap(formatNumberCalls);
  const badCalls = formatCalls.filter(a => !/^\s*(?:'tr'|"tr")\s*$/.test(a[2] ?? ""));
  const anyFormat = all.some(t => isXsl(t, "decimal-format"));
  if (!declaresTr && (formatCalls.length > 0 || anyFormat)) hit("NUM-TR", 'no xsl:decimal-format name="tr" declared');
  if (badCalls.length > 0) hit("NUM-TR", `${badCalls.length} format-number call(s) without the 'tr' decimal-format`);
  // url() in <style> text or CSS emitted outside attributes
  for (const m of text.matchAll(/url\(\s*["']?\s*(?:https?:)?\/\/[^)]*\)/gi)) hit("EXT-NONE", `external url(): ${m[0]}`);
  return hits;
}

// ---- template-level rules (#12): REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX ----
const SAFE_FONTS = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana", "Tahoma"];
const LOGO_MAX_BASE64 = 150 * 1024;
const REQUIRED_FIELDS = ["doc.id", "doc.uuid", "doc.issueDate", "supplier.name", "supplier.taxId", "customer.name", "customer.taxId"];
const REQUIRED_TOTAL_ROWS = ["tax", "payable"];

export function checkTemplate(template: Template, catalog: Catalog): RuleHit[] {
  const sev = new Map(RULES.map(r => [r.id, r.severity]));
  const hits: RuleHit[] = [];
  const hit = (rule: string, message: string): void => { hits.push({ rule, severity: sev.get(rule) ?? "error", message }); };

  const blocks = template.sections.flatMap(s => s.blocks) as unknown as Array<{ id: string; type: string; field?: string; rows?: string[]; dataUri?: string }>;
  const bound = new Set(blocks.flatMap(b => (b.type === "field" && b.field ? [b.field] : [])));
  const rows = new Set(blocks.filter(b => b.type === "totals").flatMap(b => b.rows ?? []));

  for (const id of REQUIRED_FIELDS) {
    if (!bound.has(id)) hit("REQ-FIELDS", `required field ${id}${getField(catalog, id) ? "" : " (not in catalog)"} is not bound to any block`);
  }
  if (!blocks.some(b => b.type === "lineTable")) hit("REQ-FIELDS", "required lineTable block is missing");
  for (const row of REQUIRED_TOTAL_ROWS) {
    if (!rows.has(row)) hit("REQ-FIELDS", `required field totals.${row} is not shown (totals block row "${row}" missing)`);
  }

  if (template.documentType === "EARSIV" && !bound.has("derived.watermark")) {
    hit("REQ-EARSIV-NOTE", "EARSIV template has no block bound to derived.watermark");
  }

  const font = template.theme?.fontFamily;
  if (font !== undefined && !SAFE_FONTS.includes(font)) hit("FONT-SAFE", `font family "${font}" is not one of the safe families`);

  for (const b of blocks) {
    if (b.type !== "logo" || typeof b.dataUri !== "string") continue;
    const payload = b.dataUri.slice(b.dataUri.indexOf(",") + 1);
    if (payload.length > LOGO_MAX_BASE64) hit("SIZE-MAX", `logo block ${b.id} base64 payload is ${payload.length} bytes, limit ${LOGO_MAX_BASE64}`);
  }
  return hits;
}
