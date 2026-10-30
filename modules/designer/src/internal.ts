import type { Template } from "../../template-model/src";
import type { Catalog, DocumentType } from "../../ubl-catalog/src";
import { fieldsFor } from "../../ubl-catalog/src";

/** Internal helpers; deliberately not re-exported from index.ts. */

/** Binding errors of one block: catalog ids of the right scope only; no `field` property on non-field blocks. */
export function bindingErrors(block: any, catalog: Catalog, documentType: DocumentType): string[] {
  const errs: string[] = [];
  if (block.type !== "field" && "field" in block) errs.push("only a field block may carry a field property");
  if (block.type === "field" && !fieldsFor(catalog, documentType, "document").some(f => f.id === block.field))
    errs.push(`"${String(block.field)}" is not a document-scope catalog id`);
  if (block.type === "lineTable" && Array.isArray(block.columns)) {
    const allowed = fieldsFor(catalog, documentType, "line");
    block.columns.forEach((c: any, i: number) => {
      if (!allowed.some(f => f.id === c?.field)) errs.push(`column ${i}: "${String(c?.field)}" is not a line-scope catalog id`);
    });
  }
  return errs;
}

/** Binding errors of every block in a template (used by the element's `template` setter). */
export function templateBindingErrors(template: Template, catalog: Catalog): string[] {
  return template.sections.flatMap(sec => sec.blocks.flatMap(b => bindingErrors(b, catalog, template.documentType)));
}

/** Id of the section holding `blockId`, or undefined when no section holds it. */
export function sectionOf(t: { sections: any[] }, blockId: unknown): string | undefined {
  return t.sections.find((s: any) => s.blocks.some((b: any) => b.id === blockId))?.id;
}
