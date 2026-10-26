# STATE

Current goal: H1 — contracts and the three pure modules (template-model, ubl-catalog, xslt-codegen) with gib-rules, e-Fatura/e-Arşiv only. No UI yet.

Locked decisions:
- Output is XSLT 1.0 (ADR-0002). Target engines: .NET XslCompiledTransform and browser XSLTProcessor.
- Model binds catalog ids, never raw XPath.
- Designer will be a framework-free web component (H3); OverEGov integrates via Angular lazy module + one controller (H4).
- Languages: TypeScript for modules; pos kit in Python.

Research protocol (docs/research/protocol.md): tasks #3–#7 are CONTROL tasks (kit present, not used: no pos impact/map/query, free code reading, full suite). From #8 on: cbad.

Open questions:
- Number-to-words (Yalnız …) in XSLT 1.0: recursive named template vs precomputed in UBL note. Decide in H1 with a golden test.
- Which 3 sample UBL files represent the parity suite (have: earsiv-satis-6gen).

Stop condition for current task: all four cards pinned, `pos gate` green, catalog + schema validate, golden test harness runs (even with 1 case).

Last updated: 2026-10-27
