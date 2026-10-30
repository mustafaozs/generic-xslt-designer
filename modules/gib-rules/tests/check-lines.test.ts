// Acceptance for issue #43: LINES-ALL in checkXslt (synthetic XSLT 1.0 stylesheets).
import { checkXslt, RULES } from "../src";

const NS = 'xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"';
const sheet = (body: string) =>
  `<xsl:stylesheet version="1.0" ${NS}><xsl:output method="html" encoding="UTF-8"/><xsl:template match="/">${body}</xsl:template></xsl:stylesheet>`;
const lines = (x: string) => checkXslt(x).filter(h => h.rule === "LINES-ALL");

describe("LINES-ALL", () => {
  test("unbounded for-each over cac:InvoiceLine passes", () => {
    expect(lines(sheet('<xsl:for-each select="cac:InvoiceLine"><tr/></xsl:for-each>'))).toEqual([]);
  });
  test("no for-each over cac:InvoiceLine is one hit with severity from RULES", () => {
    const hits = lines(sheet("<p/>"));
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe(RULES.find(r => r.id === "LINES-ALL")!.severity);
    expect(hits[0].severity).toBe("error");
  });
  test("position() cap in select is one hit", () => {
    expect(lines(sheet('<xsl:for-each select="cac:InvoiceLine[position() &lt;= 20]"><tr/></xsl:for-each>'))).toHaveLength(1);
  });
  test("for-each over another element only is one hit", () => {
    expect(lines(sheet('<xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal"><tr/></xsl:for-each>'))).toHaveLength(1);
  });
});
