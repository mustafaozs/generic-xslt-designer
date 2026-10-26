# xslt-codegen contract (v1)

**Input:** a Template (contracts/template-model.schema.json) + a catalog (ubl-catalog).
**Output:** one XSLT 1.0 string that transforms a UBL-TR Invoice into self-contained HTML.
**Guarantees:** deterministic (same input → byte-identical output), passes every `error` rule in gib-rules, no network, no LLM.

## API (TypeScript, no runtime dependency)

```ts
export function generate(template: Template, catalog: Catalog): GenerateResult;
export interface GenerateResult { xslt: string; warnings: RuleHit[]; errors: RuleHit[] }
export interface RuleHit { rule: string; blockId?: string; message: string }
```
`errors` non-empty ⇒ `xslt` is still returned (for debugging) but must not be exported.

## Structure of the generated stylesheet (fixed order, so diffs stay readable)
1. prolog: `xsl:stylesheet version="1.0"`, UBL namespaces, `xsl:output method="html" encoding="UTF-8"`, `xsl:decimal-format name="tr"`
2. named templates: `money`, `date-tr`, `number-tr`, `in-words-tr`, `codelist-*` (only those used)
3. `match="/"` → `<html><head><style>…</style></head><body>` with `@page`
4. one `xsl:template name="section-<id>"` per model section, called in order
5. lineTable → `xsl:for-each select="cac:InvoiceLine"` (all lines, no cap)
6. epilog

## Golden tests
`modules/xslt-codegen/tests/golden/<case>/{template.json, expected.xslt, expected.html}`.
`expected.html` is produced by transforming `fixtures/ubl/*.xml` with the generated XSLT through **both** engines (browser XSLTProcessor and .NET XslCompiledTransform); they must be byte-identical after whitespace normalisation.
