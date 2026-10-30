# STATE

Current goal: H1 — contracts and the three pure modules (template-model, ubl-catalog, xslt-codegen) with gib-rules, e-Fatura/e-Arşiv only. No UI yet. H3 started (#17): designer scaffold exists (pure state ops + xslt-designer element, 37 tests); next: H3 remaining work.

Locked decisions:
- Output is XSLT 1.0 (ADR-0002). Target engines: .NET XslCompiledTransform and browser XSLTProcessor.
- Model binds catalog ids, never raw XPath.
- Designer will be a framework-free web component (H3); OverEGov integrates via Angular lazy module + one controller (H4).
- Languages: TypeScript for modules; pos kit in Python.
- Golden reference engine is libxslt via `lxml` (contracts/xslt-codegen.md, 2026-10-27); .NET parity is checked in H4, browser parity is a CI job (pending).
- Number-to-words (Yalnız: …) is a recursive named template `in-words-tr` in the generated XSLT (task #3, 2026-10-27); verified identical on libxslt and .NET.
- in-words format per ADR-0005 (Yalnız: ; 0,00 → Sıfır TL Sıfır Kr; foreign currencies by ISO code EUR/GBP/USD; implementation in #28).
- Watermark field is derived.watermark (owner decision 2026-10-28). contracts/gib-rules.md still says profile.watermark; the contract text is corrected in #27. Not an open question.

Research protocol (docs/research/protocol.md): Control window = #4 plus the next four task issues worked (protocol v1.4 §2d, by order not number); then cbad. Live list: kit docs/research/evidence/control-window.md.
Control window progress: 5 of 5 (#4, #10, #11, #15, #14). Next task issues worked count toward it in order.

Open questions:
- Which 3 sample UBL files represent the parity suite. Have three fixtures: earsiv-full (synthetic e-Arşiv, 4 lines, totals, watermark, note; #15), earsiv-satis-6gen (no InvoiceLine/LegalMonetaryTotal, ID/UUID/IssueDate commented out; golden html does not exercise lines, totals or in-words) and efatura-tevkifat (synthetic, 13 lines, KDV %20/%10, line allowance, withholding, totals; golden html exercises in-words).
- Stock defaultTemplate("EARSIV") has no note (doc.note) block; #15 golden adds one via a test-local notes section. Decide whether the stock default should carry it.
- efatura-tevkifat withholding block is synthetic (TaxTypeCode 604/50); replace or complement with a real tevkifat sample when one is available.
- Browser (Chromium XSLTProcessor via Playwright) parity job: not wired; `expected.html` is libxslt only.
- normalizeHtml collapses whitespace, so white-space:pre-line multi-line text blocks lose newlines in expected.html (found in #14); decide whether the golden comparison should preserve line breaks.
- gib-rules: checkXslt covers X10-* and EXT-*; checkXslt covers LINES-ALL (#43); checkTemplate covers REQ-FIELDS (partial: ProfileID/InvoiceTypeCode not checked), REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX (#12); CUR/WITHHOLD/PRINT/NUM remain; codegen does not call gib-rules yet (`CG-*` binding errors only).
- gib-rules LINES-ALL limits (#43): `position()` inside `xsl:if` is not detected; `xsl:apply-templates` line loops are not handled. Decide whether to tighten before codegen calls gib-rules.
- efatura-usd golden (#13, scope reduced by human decision after dev STOP): does not exercise TRY-equivalent or in-words, the real USD gaps; `money` appends raw @currencyID for non-TRY; number-tr drops trailing zeros of the rate. Follow-ups: #27 (tryEquivalent row/enum), #28 (currency-aware in-words). totals.tryTax not bound (needs second TaxTotal in fixture).

Stop condition for current task: all four cards pinned, `pos gate` green, catalog + schema validate, golden test harness runs (even with 1 case).
Progress (task #3, 2026-10-27): xslt-codegen body + golden harness with 1 case (`earsiv-default`); gib-rules body still pending.
Progress (task #4, 2026-10-27): second fixture + golden `efatura-tevkifat` (control task).
Progress (task #10, 2026-10-27): gib-rules RULES table (17 rules, documentTypes) + contract-drift test; checkTemplate/checkXslt still pending.
Progress (task #11, 2026-10-27): gib-rules checkXslt (X10-*, EXT-*) + acceptance tests; checkTemplate and REQ/LINES/CUR/WITHHOLD/PRINT/FONT/NUM checks remain.
Progress (task #15, 2026-10-27): complete synthetic e-Arşiv fixture `earsiv-full` (+ `earsiv-full-nonote`) and goldens (control task).
Progress (task #12, 2026-10-28): gib-rules checkTemplate (REQ-FIELDS, REQ-EARSIV-NOTE, FONT-SAFE, SIZE-MAX) + acceptance tests; condition cbad, not counted in control window; checkTemplate removed from planned work.
Progress (task #14, 2026-10-28): escaping and Turkish-character edge-case tests + golden `escape-edge` (control task, window 5 of 5).
Progress (task #13, 2026-10-28): efatura-usd fixture + case-specific golden only (condition cbad, not counted in control window); scope reduced by human decision after dev STOP: conflict (AC4 → #28, tryEquivalent → #27); no codegen/contract change.
Progress (task #16, 2026-10-29): in-words-tr boundary matrix test (`inwords-matrix.test.ts`, 15 tests, 12 synthetic fixtures); condition cbad, not counted in control window; no codegen or contract change; uncommitted at write time.

Progress (task #17, 2026-10-29): designer contract v1 (human-approved decisions) + pure state ops + xslt-designer element + card; 37 tests; condition cbad, not counted in control window; H3 started.

Progress (task #43, 2026-10-30): gib-rules checkXslt LINES-ALL + `check-lines.test.ts` (4 tests); uncommitted at write time; no dependent tests to run: checkXslt is called only inside gib-rules (src/index.ts and its two test files), xslt-codegen and designer do not call it.

Block 2 order: #43 (done, uncommitted), #44, #28, #41, #39, #34, #27, #21, #40, #42 (kit block2-plan.md)

Last updated: 2026-10-30
