import data from "../data/ubl-tr-1.2.json";

export type Scope = "document" | "line" | "taxSubtotal";
export type DocumentType = "EFATURA" | "EARSIV";
export interface Field { id: string; group: string; label: string; xpath: string; scope: Scope;
  type: "text"|"date"|"time"|"money"|"number"|"percent"|"code"|"boolean"; codelist?: string; required?: boolean;
  documentTypes?: DocumentType[]; note?: string; deprecated?: boolean }
export interface Catalog { version: string; documentTypes: DocumentType[]; groups: {id:string;label:string}[]; fields: Field[] }

export function loadCatalog(version: "ubl-tr-1.2" = "ubl-tr-1.2"): Catalog {
  if (version !== "ubl-tr-1.2") throw new Error(`unknown catalog ${version}`);
  return data as Catalog;
}
export function getField(c: Catalog, id: string): Field | undefined { return c.fields.find(f => f.id === id); }
export function fieldsFor(c: Catalog, dt: DocumentType, scope?: Scope): Field[] {
  return c.fields.filter(f => (!f.documentTypes || f.documentTypes.includes(dt)) && (!scope || f.scope === scope) && !f.deprecated);
}
export const XPATH2_TOKENS = [/\bif\s*\(/, /\bthen\b/, /\bfor\s+\$/, /\breturn\b/, /\bmatches\(/, /\btokenize\(/, /\bstring-join\(/,
  /\bexists\(/, /\bupper-case\(/, /\blower-case\(/, /\bcurrent-dateTime\(/, /\bxs:/];
