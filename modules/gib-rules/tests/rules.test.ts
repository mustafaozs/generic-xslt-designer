import { readFileSync } from "node:fs";
import { RULES, type Rule } from "../src";

const md = readFileSync(new URL("../../../contracts/gib-rules.md", import.meta.url), "utf8");

interface Row { id: string; severity: string; earsivOnly: boolean }
function parseContract(text: string): Row[] {
  return text.split(/\r?\n/).filter(l => l.startsWith("|")).map(l => l.split("|").map(s => s.trim()))
    .filter(c => c[1] && c[1] !== "id" && !/^-+$/.test(c[1]))
    .map(c => ({ id: c[1], severity: c[2].split(/\s/)[0], earsivOnly: /EARSIV only/.test(c[2]) }));
}
function drift(rules: Rule[], rows: Row[]): string[] {
  const out: string[] = [];
  const have = new Map(rules.map(r => [r.id, r]));
  for (const row of rows) {
    const r = have.get(row.id);
    if (!r) out.push(`missing: ${row.id}`);
    else if (r.severity !== row.severity) out.push(`severity: ${row.id}`);
  }
  const ids = new Set(rows.map(r => r.id));
  for (const r of rules) if (!ids.has(r.id)) out.push(`extra: ${r.id}`);
  return out;
}
const rows = parseContract(md);

test("contract table parses", () => { expect(rows.length).toBeGreaterThan(10); });
test("RULES mirrors the contract table", () => {
  expect(new Set(RULES.map(r => r.id))).toEqual(new Set(rows.map(r => r.id)));
  expect(RULES.length).toBe(rows.length);
  expect(drift(RULES, rows)).toEqual([]);
});
test("drift is detected by name", () => {
  const cut = RULES.filter(r => r.id !== "LINES-ALL");
  expect(drift(cut, rows)).toContain("missing: LINES-ALL");
});
test("only two severities", () => {
  for (const s of new Set(RULES.map(r => r.severity))) expect(["error", "warn"]).toContain(s);
});
test("EARSIV-only scope", () => {
  for (const r of RULES) {
    expect(r.documentTypes).toEqual(r.id === "REQ-EARSIV-NOTE" ? ["EARSIV"] : ["EFATURA", "EARSIV"]);
  }
  expect(rows.filter(r => r.earsivOnly).map(r => r.id)).toEqual(["REQ-EARSIV-NOTE"]);
});
