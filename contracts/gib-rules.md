# gib-rules contract (v1)

Rules the generated XSLT must satisfy to render on GİB and on özel entegratör engines.
Each rule has an id, a severity (error blocks export, warn is shown), and a mechanical check.
The rule set is versioned; a change here is a contract change (human approval).

| id | severity | rule | check |
| --- | --- | --- | --- |
| X10-VERSION | error | Stylesheet declares `version="1.0"` | root attribute |
| X10-NO-XPATH2 | error | No XPath 2.0 constructs: `if (…) then`, `for … return`, `format-number(…, …, …)` with 3rd arg picture, `current-dateTime()`, `matches()`, `tokenize()`, `string-join()`, `exists()`, `upper-case()`, `lower-case()`, `xs:` types | token scan on generated text |
| X10-NO-RESULT-DOC | error | No `xsl:result-document`, `xsl:function`, `xsl:character-map` | element scan |
| X10-OUTPUT-HTML | error | `xsl:output method="html"` with UTF-8 | output element |
| NET-ENGINE | error | Compiles with .NET `XslCompiledTransform` (parity test in CI) | server parity job |
| BROWSER-ENGINE | error | Transforms with browser `XSLTProcessor` (parity test in CI) | headless browser job |
| EXT-NONE | error | No external resources: no `http(s)://` in `src`, `href`, `url()`; images are data URIs | regex on output |
| EXT-NO-SCRIPT | error | No `<script>`, no `on*=` attributes, no `javascript:` | regex on output |
| SIZE-MAX | error | Generated XSLT ≤ 500 KB; each logo ≤ 150 KB base64 | byte count |
| REQ-FIELDS | error | Rendered output shows: invoice ID, ETTN (UUID), IssueDate, ProfileID, InvoiceTypeCode, supplier name + VKN/TCKN, customer name + VKN/TCKN, line table, TaxTotal, PayableAmount | field presence in model |
| REQ-EARSIV-NOTE | error (EARSIV only) | e-Arşiv watermark text "e-Arşiv Fatura" visible; "İrsaliye yerine geçer" note shown when `cbc:Note` says so | model has `field: profile.watermark` |
| LINES-ALL | error | Every `cac:InvoiceLine` is rendered (no hard cap at 20 like legacy templates) | codegen uses `xsl:for-each` without position() limit |
| CUR-FOREIGN | warn | When `DocumentCurrencyCode != TRY`, TRY equivalents (`cbc:TaxAmount[@currencyID]`, exchange rate) are shown | totals block includes `tryEquivalent` |
| WITHHOLD | warn | `cac:WithholdingTaxTotal` rendered when present | totals rows include `withholding` |
| PRINT-PAGE | warn | `@page` size matches model; `page-break-inside: avoid` on rows; header repeats via `thead` | css presence |
| FONT-SAFE | warn | Only the six safe font families from the model schema | theme check |
| NUM-TR | warn | Numbers formatted `#.##0,00` via `xsl:decimal-format name="tr"` | decimal-format present |
