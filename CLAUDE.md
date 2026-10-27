# generic-xslt-designer

@AGENTS.md

<!-- Claude-Code-specific additions go below this line; keep the portable rules in AGENTS.md -->

## Project-specific
- First time on a machine: `pip install -e . lxml` and `npm install && npm run gen:types`
- `npm test`            vitest (TypeScript modules); `npm run gen:types` after schema changes
- Generated XSLT is 1.0 only (ADR-0002). Never write XPath 2.0, even in tests.
- Fields bind by catalog id; never put raw XPath in a template.
