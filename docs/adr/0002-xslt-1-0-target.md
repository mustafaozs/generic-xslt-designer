# ADR-0002: Generated stylesheets target XSLT 1.0

Tarih: 2026-10-27
Durum: accepted
Modüller: xslt-codegen, gib-rules, ubl-catalog

## Bağlam
GİB's and most özel entegratör render paths run on .NET `XslCompiledTransform` (XSLT 1.0 only). The legacy portal template declares `version="2.0"` but executes in 1.0 forward-compatible mode; 2.0 functions silently misbehave. Browsers' built-in `XSLTProcessor` is also 1.0, which allows client-side live preview with no server round-trip.

## Karar
The code generator emits strictly XSLT/XPath 1.0. gib-rules scans output for 2.0 constructs and blocks export. CI runs every golden case through both engines and compares normalised HTML.

## Reddedilen seçenekler
- XSLT 2.0/3.0 via Saxon-JS in browser and Saxon on server: richer language, but GİB/entegratör engines would not run the output; defeats the purpose.
- Rendering HTML server-side and skipping XSLT: the deliverable customers upload *is* the XSLT.

## Sonuçlar
- Number→words, date formatting and grouping must be implemented as recursive named templates.
- Live preview is free and offline; parity is a CI job, not a runtime dependency.
