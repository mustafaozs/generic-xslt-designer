import { validateTemplate, defaultTemplate } from "../src";

test("default templates validate against the contract", () => {
  for (const dt of ["EFATURA", "EARSIV"] as const) {
    const r = validateTemplate(defaultTemplate(dt));
    expect(r.ok, JSON.stringify(r)).toBe(true);
  }
});

test("rejects raw xpath and unknown block types", () => {
  const t: any = defaultTemplate("EFATURA");
  t.sections[0].blocks.push({ id: "bad", type: "xpath", xpath: "cbc:ID" });
  const r = validateTemplate(t);
  expect(r.ok).toBe(false);
});

test("rejects external logo urls", () => {
  const t: any = defaultTemplate("EFATURA");
  t.sections[0].blocks[0].dataUri = "https://example.com/logo.png";
  expect(validateTemplate(t).ok).toBe(false);
});
