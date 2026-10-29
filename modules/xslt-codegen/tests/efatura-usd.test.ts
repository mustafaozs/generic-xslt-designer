// #13 (reduced): USD fixture acceptance, asserted on the COMMITTED expected files.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "golden", "efatura-usd");
const html = readFileSync(join(dir, "expected.html"), "utf8");
const xslt = readFileSync(join(dir, "expected.xslt"), "utf8");

describe("efatura-usd golden", () => {
  test("shows USD currency and the exchange rate", () => {
    expect(html).toContain('<span class="val">USD</span>');
    expect(html).toContain("Döviz Kuru");
    expect(html).toContain("32,45");
  });
  test("payable 1.234,50 sits next to USD", () => {
    expect(html).toMatch(/1\.234,50 USD/);
  });
  test("no TL suffix, no in-words, no TRY-equivalent text", () => {
    expect(html).not.toMatch(/ TL\b/);
    expect(html).not.toContain("Yalnız");
    expect(xslt).not.toContain("in-words-tr");
  });
});
