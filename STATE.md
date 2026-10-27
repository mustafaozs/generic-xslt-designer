# STATE

Current goal: H1 — contracts and the three pure modules (template-model, ubl-catalog, xslt-codegen) with gib-rules, e-Fatura/e-Arşiv only. No UI yet.

Locked decisions:
- Output is XSLT 1.0 (ADR-0002). Target engines: .NET XslCompiledTransform and browser XSLTProcessor.
- Model binds catalog ids, never raw XPath.
- Designer will be a framework-free web component (H3); OverEGov integrates via Angular lazy module + one controller (H4).
- Languages: TypeScript for modules; pos kit in Python.
- Golden reference engine is libxslt via `lxml` (contracts/xslt-codegen.md, 2026-10-27); .NET parity is checked in H4, browser parity is a CI job (pending).
- Number-to-words (Yalnız …) is a recursive named template `in-words-tr` in the generated XSLT (task #3, 2026-10-27); verified identical on libxslt and .NET.

Research protocol (docs/research/protocol.md): tasks #4–#8 are CONTROL tasks (kit present, not used: no pos impact/map/query, free code reading, full suite). From #9 on: cbad.

Open questions:
- Which 3 sample UBL files represent the parity suite (have: earsiv-satis-6gen, which carries no InvoiceLine/LegalMonetaryTotal and has ID/UUID/IssueDate commented out — the golden html does not exercise lines, totals or in-words yet).
- Browser (Chromium XSLTProcessor via Playwright) parity job: not wired; `expected.html` is libxslt only.
- gib-rules body (a later cbad task): codegen reports only its own binding errors (`CG-*`); X10/EXT/REQ checks are not run on generated output yet.

Stop condition for current task: all four cards pinned, `pos gate` green, catalog + schema validate, golden test harness runs (even with 1 case).
Progress (task #3, 2026-10-27): xslt-codegen body + golden harness with 1 case (`earsiv-default`); gib-rules body still pending.

Last updated: 2026-10-27
