// gib-rules — RULES mirrors contracts/gib-rules.md one-to-one (drift is caught by tests/rules.test.ts)
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
