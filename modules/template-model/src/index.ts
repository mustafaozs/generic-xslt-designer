import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../../contracts/template-model.schema.json";
import type { Template } from "./types.generated";
export type { Template };

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export type ValidationResult = { ok: true; value: Template } | { ok: false; errors: string[] };

export function validateTemplate(json: unknown): ValidationResult {
  if (validate(json)) return { ok: true, value: json as unknown as Template };
  return { ok: false, errors: (validate.errors ?? []).map(e => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()) };
}

export function defaultTemplate(documentType: "EFATURA" | "EARSIV"): Template {
  return {
    version: 1,
    name: documentType === "EARSIV" ? "e-Arşiv standart" : "e-Fatura standart",
    documentType,
    page: { size: "A4", orientation: "portrait", margins: { top: 10, right: 10, bottom: 10, left: 10 } },
    theme: { fontFamily: "Arial", fontSize: 9, primaryColor: "#1f3a5f", textColor: "#000000", borderStyle: "solid" },
    sections: [
      { id: "header", kind: "header", columns: 3, blocks: [
        { id: "logo", type: "logo", column: 1, dataUri: "data:image/png;base64,iVBORw0KGgo=", widthMm: 30 },
        { id: "watermark", type: "field", column: 2, field: "derived.watermark", style: { align: "center", bold: true, fontSize: 14 } },
        { id: "doc-id", type: "field", column: 3, field: "doc.id", label: "Fatura No" },
        { id: "doc-date", type: "field", column: 3, field: "doc.issueDate", label: "Fatura Tarihi", format: "date" },
        { id: "doc-ettn", type: "field", column: 3, field: "doc.uuid", label: "ETTN" }
      ] },
      { id: "parties", kind: "parties", columns: 2, blocks: [
        { id: "s-name", type: "field", column: 1, field: "supplier.name", style: { bold: true } },
        { id: "s-tax", type: "field", column: 1, field: "supplier.taxId", label: "VKN/TCKN" },
        { id: "c-name", type: "field", column: 2, field: "customer.name", style: { bold: true } },
        { id: "c-tax", type: "field", column: 2, field: "customer.taxId", label: "VKN/TCKN" }
      ] },
      { id: "lines", kind: "lines", blocks: [
        { id: "line-table", type: "lineTable", columns: [
          { field: "line.no", label: "Sıra", widthPct: 5 },
          { field: "line.name", label: "Mal/Hizmet", widthPct: 35 },
          { field: "line.quantity", label: "Miktar", widthPct: 10, align: "right", format: "number" },
          { field: "line.unitPrice", label: "Birim Fiyat", widthPct: 15, align: "right", format: "money" },
          { field: "line.kdvRate", label: "KDV %", widthPct: 10, align: "right", format: "percent" },
          { field: "line.kdvAmount", label: "KDV", widthPct: 10, align: "right", format: "money" },
          { field: "line.extension", label: "Tutar", widthPct: 15, align: "right", format: "money" }
        ] }
      ] },
      { id: "totals", kind: "totals", blocks: [
        { id: "totals", type: "totals", rows: ["lineExtension", "allowance", "taxExclusive", "tax", "withholding", "taxInclusive", "payable", "payableInWords"] }
      ] }
    ]
  } as Template;
}
