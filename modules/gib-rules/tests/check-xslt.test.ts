// Acceptance for issue #11: checkXslt X10-* and EXT-* scans.
import { readFileSync } from "node:fs";
import { checkXslt as checkAll } from "../src";

// LINES-ALL (#43) is covered in check-lines.test.ts; these synthetic sheets have no line loop
const checkXslt = (x: string) => checkAll(x).filter(h => h.rule !== "LINES-ALL");

const golden = (n: string) => readFileSync(new URL(`../../xslt-codegen/tests/golden/${n}/expected.xslt`, import.meta.url), "utf8");
const NS = 'xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"';
const sheet = (body: string, version = "1.0") =>
  `<xsl:stylesheet version="${version}" ${NS}><xsl:output method="html" encoding="UTF-8"/>${body}</xsl:stylesheet>`;
const sel = (expr: string) => sheet(`<xsl:template match="/"><xsl:value-of select="${expr}"/></xsl:template>`);
const rules = (x: string) => checkXslt(x).map(h => h.rule);

describe("golden stylesheets", () => {
  for (const n of ["earsiv-default", "efatura-tevkifat"]) {
    test(`${n} has no error hits`, () => {
      expect(checkAll(golden(n)).filter(h => h.severity === "error")).toEqual([]);
    });
    test(`${n} gives no LINES-ALL hit`, () => {
      expect(checkAll(golden(n)).filter(h => h.rule === "LINES-ALL")).toEqual([]);
    });
  }
});

describe("X10-NO-XPATH2", () => {
  test("clean stylesheet has no hits", () => { expect(checkXslt(sel("string(/n1:Invoice/cbc:ID)"))).toEqual([]); });
  const cases: [string, string][] = [
    ["upper-case(", "upper-case(/n1:Invoice/cbc:ID)"],
    ["string-join(", "string-join(/n1:Invoice/cbc:ID, ',')"],
    ["tokenize(", "tokenize(/n1:Invoice/cbc:ID, ',')"],
    ["matches(", "matches(/n1:Invoice/cbc:ID, 'a')"],
    ["exists(", "exists(/n1:Invoice/cbc:ID)"],
    ["if/then", "if (/n1:Invoice) then 1 else 2"],
    ["xs:string", "xs:string(/n1:Invoice/cbc:ID)"],
  ];
  for (const [name, expr] of cases) {
    test(`rejects ${name}`, () => {
      const hits = checkXslt(sel(expr));
      expect(hits.map(h => h.rule)).toEqual(["X10-NO-XPATH2"]);
      expect(hits[0].severity).toBe("error");
    });
  }
  test("ignores constructs inside string literals", () => { expect(checkXslt(sel("'upper-case( if (x) then'"))).toEqual([]); });
});

describe("version and forbidden elements", () => {
  test("version 2.0", () => { expect(rules(sheet("", "2.0"))).toEqual(["X10-VERSION"]); });
  test("xsl:result-document", () => {
    expect(rules(sheet('<xsl:template match="/"><xsl:result-document href="a"/></xsl:template>'))).toEqual(["X10-NO-RESULT-DOC"]);
  });
  test("xsl:function", () => {
    expect(rules(sheet('<xsl:function name="f:g" xmlns:f="urn:f"/>'))).toEqual(["X10-NO-RESULT-DOC"]);
  });
  test("missing html output", () => {
    expect(rules(`<xsl:stylesheet version="1.0" ${NS}/>`)).toEqual(["X10-OUTPUT-HTML"]);
  });
});

describe("EXT-NONE / EXT-NO-SCRIPT", () => {
  const out = (html: string) => sheet(`<xsl:template match="/">${html}</xsl:template>`);
  test("external resources and scripts", () => {
    const r = rules(out(
      '<img src="http://example.invalid/a.png"/><div style="background:url(https://example.invalid/f)"/>' +
      '<script>1</script><b onclick="x()"/><a href="javascript:void(0)"/>'));
    expect(r.filter(x => x === "EXT-NONE").length).toBe(2);
    expect(r.filter(x => x === "EXT-NO-SCRIPT").length).toBe(3);
  });
  test("data URI and namespace URI are fine", () => {
    expect(checkXslt(out('<img src="data:image/png;base64,iVBORw0KGgo="/>'))).toEqual([]);
  });
});

test("purity: same input, deep-equal result", () => {
  const x = sel("upper-case(.)");
  expect(checkXslt(x)).toEqual(checkXslt(x));
});
