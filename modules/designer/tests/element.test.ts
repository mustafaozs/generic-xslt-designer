// @vitest-environment happy-dom
import { validateTemplate, defaultTemplate } from "../../template-model/src";
import "../src/element";

const TAG = "xslt-designer";
const make = (dt?: string) => {
  const el = document.createElement(TAG) as any;
  if (dt) el.setAttribute("document-type", dt);
  document.body.appendChild(el);
  return el;
};
const note = { id: "note-a", type: "text", text: "sentetik" };

test("element is registered", () => {
  expect(customElements.get(TAG)).toBeDefined();
});

test("seeds default template from document-type attribute", () => {
  expect(make("EARSIV").template).toEqual(defaultTemplate("EARSIV"));
  expect(make("EFATURA").template.documentType).toBe("EFATURA");
});

test("adding a block dispatches template-change with a valid Template", () => {
  const el = make("EFATURA");
  const events: CustomEvent[] = [];
  el.addEventListener("template-change", (e: Event) => events.push(e as CustomEvent));
  const r = el.addBlock("header", note);
  expect(r.ok).toBe(true);
  expect(events).toHaveLength(1);
  expect(events[0]).toBeInstanceOf(CustomEvent);
  expect(validateTemplate(events[0].detail).ok).toBe(true);
  expect(events[0].detail.sections[0].blocks.some((b: any) => b.id === "note-a")).toBe(true);
  expect(el.template.sections[0].blocks.some((b: any) => b.id === "note-a")).toBe(true);
});

test("failed ops return ok:false, keep template, dispatch nothing, never throw", () => {
  const el = make("EFATURA");
  const before = JSON.stringify(el.template);
  let n = 0;
  el.addEventListener("template-change", () => n++);
  expect(el.bindField("s-name", "//cbc:ID").ok).toBe(false);
  expect(el.bindColumn("line-table", 0, "supplier.name").ok).toBe(false);
  expect(el.removeBlock("nope").ok).toBe(false);
  expect(() => el.addBlock(null, null)).not.toThrow();
  expect(JSON.stringify(el.template)).toBe(before);
  expect(n).toBe(0);
});

test("mirrors ops, undo and redo", () => {
  const el = make("EFATURA");
  const start = JSON.stringify(el.template);
  expect(el.addBlock("header", note).ok).toBe(true);
  expect(el.bindField("s-name", "supplier.name").ok).toBe(true);
  expect(el.moveBlock("note-a", "parties", 0).ok).toBe(true);
  expect(el.updateBlock("note-a", { text: "y" }).ok).toBe(true);
  expect(el.bindColumn("line-table", 1, "line.description").ok).toBe(true);
  expect(el.removeBlock("note-a").ok).toBe(true);
  let n = 0;
  el.addEventListener("template-change", () => n++);
  for (let i = 0; i < 6; i++) el.undo();
  expect(JSON.stringify(el.template)).toBe(start);
  el.redo();
  expect(el.template.sections[0].blocks.some((b: any) => b.id === "note-a")).toBe(true);
  expect(n).toBe(7);
  expect(() => el.undo()).not.toThrow();
});

test("template property setter accepts valid and ignores invalid", () => {
  const el = make("EFATURA");
  el.template = defaultTemplate("EARSIV");
  expect(el.template.documentType).toBe("EARSIV");
  el.template = { bogus: true };
  expect(el.template.documentType).toBe("EARSIV");
  expect(el.addBlock("header", note).ok).toBe(true);
});
