import Ajv2020 from "ajv/dist/2020";
import schema from "../../../contracts/ubl-catalog.schema.json";
import { loadCatalog, fieldsFor, getField, XPATH2_TOKENS } from "../src";

const c = loadCatalog();

test("catalog validates against its contract", () => {
  const v = new Ajv2020({ strict: false }).compile(schema);
  expect(v(c), JSON.stringify(v.errors)).toBe(true);
});
test("ids unique, groups resolve", () => {
  const ids = c.fields.map(f => f.id);
  expect(new Set(ids).size).toBe(ids.length);
  const groups = new Set(c.groups.map(g => g.id));
  for (const f of c.fields) expect(groups.has(f.group), f.id).toBe(true);
});
test("no XPath 2.0 constructs in any xpath", () => {
  for (const f of c.fields) for (const re of XPATH2_TOKENS) expect(re.test(f.xpath), `${f.id}: ${f.xpath}`).toBe(false);
});
test("required GİB fields exist", () => {
  for (const id of ["doc.id","doc.uuid","doc.issueDate","doc.profile","doc.typeCode","supplier.name","supplier.taxId","customer.taxId","line.name","totals.tax","totals.payable"])
    expect(getField(c, id)?.required, id).toBe(true);
});
test("EARSIV-only fields hidden for EFATURA", () => {
  const ids = fieldsFor(c, "EFATURA").map(f => f.id);
  expect(ids).not.toContain("refs.okcSerial");
  expect(fieldsFor(c, "EARSIV").map(f => f.id)).toContain("refs.okcSerial");
});
