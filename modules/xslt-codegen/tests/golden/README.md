One folder per case: `case.json` (`{ "fixture": "<file in fixtures/ubl>" }`), `template.json`, `expected.xslt`, `expected.html`.
`expected.html` is libxslt output (`scripts/xslt-transform.py`) after `tests/html-normalize.ts`.
Regenerate expected files only through `npm run golden:update`, never by hand. Requires `pip install lxml`.
