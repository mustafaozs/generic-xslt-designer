// xslt-codegen — Template + Catalog → deterministic XSLT 1.0 (contracts/xslt-codegen.md).
// Pure: no I/O, no runtime dependency; only types are imported from sibling modules.
import type { Template } from "../../template-model/src/types.generated";
import type { Catalog, Field, Scope } from "../../ubl-catalog/src/index";

export interface RuleHit { rule: string; blockId?: string; message: string }
export interface GenerateResult { xslt: string; warnings: RuleHit[]; errors: RuleHit[] }

// ---- model narrowing (the generated Block type is loose because the schema uses if/then) ----
type Format = "text" | "date" | "money" | "number" | "percent";
type Align = "left" | "right" | "center";
interface Style { fontSize?: number; bold?: boolean; italic?: boolean; align?: Align; color?: string; background?: string; border?: boolean; padding?: number }
interface BaseBlock { id: string; type: string; column?: number; style?: Style }
interface TextBlock extends BaseBlock { type: "text"; text: string }
interface FieldBlock extends BaseBlock { type: "field"; field: string; label?: string; format?: Format; hideWhenEmpty?: boolean }
interface LogoBlock extends BaseBlock { type: "logo"; dataUri: string; widthMm?: number }
interface LineColumn { field: string; label: string; widthPct?: number; align?: Align; format?: Format }
interface LineTableBlock extends BaseBlock { type: "lineTable"; columns: LineColumn[]; maxRowsPerPage?: number }
type TotalsRow = "lineExtension" | "allowance" | "charge" | "taxExclusive" | "tax" | "withholding" | "taxInclusive" | "payable" | "payableInWords";
interface TotalsBlock extends BaseBlock { type: "totals"; rows?: TotalsRow[] }
interface QrBlock extends BaseBlock { type: "qr"; content?: "ettn" | "gibVerify"; sizeMm?: number }
interface PlainBlock extends BaseBlock { type: "taxTable" | "signature" | "spacer" | "rule" }
type Block = TextBlock | FieldBlock | LogoBlock | LineTableBlock | TotalsBlock | QrBlock | PlainBlock;
type Section = Template["sections"][number];

// ---- constants (fixed order keeps diffs readable; see contract §Structure) ----
const NS = {
  n1: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
} as const;

type NamedTemplate = "money" | "date-tr" | "number-tr" | "in-words-tr";
const NAMED_ORDER: NamedTemplate[] = ["money", "date-tr", "number-tr", "in-words-tr"];
type Variable = "watermark" | "payableInWords" | "page";
const VARIABLE_ORDER: Variable[] = ["watermark", "payableInWords", "page"];

const TOTALS_ROWS: Record<TotalsRow, { field: string; label: string; optional: boolean }> = {
  lineExtension: { field: "totals.lineExtension", label: "Mal Hizmet Toplam Tutarı", optional: false },
  allowance: { field: "totals.allowance", label: "Toplam İskonto", optional: true },
  charge: { field: "totals.charge", label: "Toplam Artırım", optional: true },
  taxExclusive: { field: "totals.taxExclusive", label: "Vergi Hariç Tutar", optional: false },
  tax: { field: "totals.tax", label: "Hesaplanan KDV", optional: false },
  withholding: { field: "totals.withholding", label: "Tevkifat", optional: true },
  taxInclusive: { field: "totals.taxInclusive", label: "Vergiler Dahil Toplam Tutar", optional: false },
  payable: { field: "totals.payable", label: "Ödenecek Tutar", optional: false },
  payableInWords: { field: "derived.payableInWords", label: "", optional: false },
};
const DEFAULT_TOTALS_ROWS: TotalsRow[] = ["lineExtension", "taxExclusive", "tax", "taxInclusive", "payable"];

const FONT_FALLBACK: Record<string, string> = {
  "Arial": "sans-serif", "Helvetica": "sans-serif", "Verdana": "sans-serif", "Tahoma": "sans-serif",
  "Times New Roman": "serif", "Courier New": "monospace",
};

const TENS = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
const ONES = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];

// ---- escaping ----
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string): string => esc(s).replace(/"/g, "&quot;");
const num = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

// ---- generator ----
class Gen {
  readonly errors: RuleHit[] = [];
  readonly warnings: RuleHit[] = [];
  private readonly used = new Set<NamedTemplate>();
  private readonly vars = new Set<Variable>();
  private readonly fields = new Map<string, Field>();

  constructor(private readonly t: Template, catalog: Catalog) {
    for (const f of catalog.fields) this.fields.set(f.id, f);
  }

  private error(rule: string, message: string, blockId?: string): void { this.errors.push(blockId ? { rule, blockId, message } : { rule, message }); }
  private warn(rule: string, message: string, blockId?: string): void { this.warnings.push(blockId ? { rule, blockId, message } : { rule, message }); }

  /** Resolve a catalog id in a scope; registers used variables. Returns null (and an error) when it cannot be bound. */
  private bind(id: string, scope: Scope, blockId: string): { field: Field; xpath: string; isPath: boolean } | null {
    const f = this.fields.get(id);
    if (!f) { this.error("CG-FIELD-UNKNOWN", `unknown catalog field "${id}"`, blockId); return null; }
    if (f.scope !== scope) { this.error("CG-FIELD-SCOPE", `field "${id}" has scope ${f.scope}, block needs ${scope}`, blockId); return null; }
    if (f.documentTypes && !f.documentTypes.includes(this.t.documentType)) {
      this.error("CG-FIELD-DOCTYPE", `field "${id}" is not available for ${this.t.documentType}`, blockId); return null;
    }
    if (f.deprecated) this.warn("CG-FIELD-DEPRECATED", `field "${id}" is deprecated`, blockId);
    if (f.xpath.startsWith("$")) {
      const v = f.xpath.slice(1) as Variable;
      if (v === "page") this.warn("CG-FIELD-UNSUPPORTED", `field "${id}" cannot be computed in XSLT 1.0 output; rendered empty`, blockId);
      if (VARIABLE_ORDER.includes(v)) this.vars.add(v);
      return { field: f, xpath: f.xpath, isPath: false };
    }
    return { field: f, xpath: f.xpath, isPath: !/^[a-z-]+\(/.test(f.xpath) };
  }

  private formatOf(f: Field, requested?: Format): Format {
    if (requested) return requested;
    switch (f.type) { case "money": case "date": case "number": case "percent": return f.type; default: return "text"; }
  }

  /** Lines that output one bound value in a format. */
  private value(b: { xpath: string; isPath: boolean }, format: Format, ind: string): string[] {
    const xp = escAttr(b.xpath);
    switch (format) {
      case "money":
        this.used.add("money");
        return [
          `${ind}<xsl:call-template name="money">`,
          `${ind}  <xsl:with-param name="v" select="${xp}"/>`,
          ...(b.isPath ? [`${ind}  <xsl:with-param name="cur" select="${xp}/@currencyID"/>`] : []),
          `${ind}</xsl:call-template>`,
        ];
      case "date":
        this.used.add("date-tr");
        return [`${ind}<xsl:call-template name="date-tr"><xsl:with-param name="d" select="${xp}"/></xsl:call-template>`];
      case "number":
        this.used.add("number-tr");
        return [`${ind}<xsl:call-template name="number-tr"><xsl:with-param name="v" select="${xp}"/></xsl:call-template>`];
      case "percent":
        this.used.add("number-tr");
        return [`${ind}<xsl:text>%</xsl:text><xsl:call-template name="number-tr"><xsl:with-param name="v" select="${xp}"/></xsl:call-template>`];
      default:
        return [`${ind}<xsl:value-of select="${xp}"/>`];
    }
  }

  private styleAttr(s?: Style, extra: string[] = []): string {
    const css = [...extra];
    if (s) {
      if (s.fontSize !== undefined) css.push(`font-size:${num(s.fontSize)}pt`);
      if (s.bold) css.push("font-weight:bold");
      if (s.italic) css.push("font-style:italic");
      if (s.align) css.push(`text-align:${s.align}`);
      if (s.color) css.push(`color:${s.color}`);
      if (s.background) css.push(`background:${s.background}`);
      if (s.border) css.push("border:1px solid");
      if (s.padding !== undefined) css.push(`padding:${num(s.padding)}mm`);
    }
    return css.length ? ` style="${escAttr(css.join(";"))}"` : "";
  }

  // ---- blocks ----
  private block(b: Block, ind: string): string[] {
    switch (b.type) {
      case "text": return [`${ind}<div class="blk blk-text"${this.styleAttr(b.style)}>${esc(b.text)}</div>`];
      case "field": return this.fieldBlock(b, ind);
      case "logo": {
        const w = b.widthMm !== undefined ? [`width:${num(b.widthMm)}mm`] : [];
        return [`${ind}<img class="blk blk-logo" src="${escAttr(b.dataUri)}" alt=""${this.styleAttr(b.style, w)}/>`];
      }
      case "lineTable": return this.lineTable(b, ind);
      case "taxTable": return this.taxTable(b, ind);
      case "totals": return this.totals(b, ind);
      case "qr": return this.qr(b, ind);
      case "signature": return [`${ind}<div class="blk blk-signature"${this.styleAttr(b.style)}>İmza / Kaşe</div>`];
      case "spacer": return [`${ind}<div class="blk blk-spacer"${this.styleAttr(b.style)}></div>`];
      case "rule": return [`${ind}<hr class="blk blk-rule"${this.styleAttr(b.style)}/>`];
      default: {
        const unknown = b as BaseBlock;
        this.error("CG-BLOCK-UNKNOWN", `unknown block type "${unknown.type}"`, unknown.id);
        return [];
      }
    }
  }

  private fieldBlock(b: FieldBlock, ind: string): string[] {
    const bound = this.bind(b.field, "document", b.id);
    if (!bound) return [];
    const hide = b.hideWhenEmpty ?? true;
    const inner = ind + (hide ? "  " : "");
    const out: string[] = [];
    if (hide) out.push(`${ind}<xsl:if test="string(${escAttr(bound.xpath)}) != ''">`);
    out.push(`${inner}<div class="blk blk-field"${this.styleAttr(b.style)}>`);
    if (b.label) out.push(`${inner}  <span class="lbl">${esc(b.label)}: </span>`);
    out.push(`${inner}  <span class="val">`);
    out.push(...this.value(bound, this.formatOf(bound.field, b.format), inner + "    "));
    out.push(`${inner}  </span>`);
    out.push(`${inner}</div>`);
    if (hide) out.push(`${ind}</xsl:if>`);
    return out;
  }

  private lineTable(b: LineTableBlock, ind: string): string[] {
    if (b.maxRowsPerPage !== undefined) this.warn("CG-OPTION-IGNORED", "maxRowsPerPage is not applied; rows break by CSS only", b.id);
    const cols = b.columns.map(c => ({ col: c, bound: this.bind(c.field, "line", b.id) })).filter(x => x.bound !== null);
    const out: string[] = [`${ind}<table class="blk lines"${this.styleAttr(b.style)}>`, `${ind}  <thead>`, `${ind}    <tr>`];
    for (const { col } of cols) {
      const css: string[] = [];
      if (col.widthPct !== undefined) css.push(`width:${num(col.widthPct)}%`);
      if (col.align) css.push(`text-align:${col.align}`);
      out.push(`${ind}      <th${css.length ? ` style="${css.join(";")}"` : ""}>${esc(col.label)}</th>`);
    }
    out.push(`${ind}    </tr>`, `${ind}  </thead>`, `${ind}  <tbody>`);
    out.push(`${ind}    <xsl:for-each select="cac:InvoiceLine">`, `${ind}      <tr>`);
    for (const { col, bound } of cols) {
      out.push(`${ind}        <td${col.align ? ` class="${col.align}"` : ""}>`);
      out.push(...this.value(bound!, this.formatOf(bound!.field, col.format), ind + "          "));
      out.push(`${ind}        </td>`);
    }
    out.push(`${ind}      </tr>`, `${ind}    </xsl:for-each>`, `${ind}  </tbody>`, `${ind}</table>`);
    return out;
  }

  private taxTable(b: PlainBlock, ind: string): string[] {
    const name = this.bind("tax.name", "taxSubtotal", b.id), code = this.bind("tax.code", "taxSubtotal", b.id);
    const rate = this.bind("tax.rate", "taxSubtotal", b.id), base = this.bind("tax.base", "taxSubtotal", b.id), amount = this.bind("tax.amount", "taxSubtotal", b.id);
    if (!name || !code || !rate || !base || !amount) return [];
    const i = ind + "      ";
    return [
      `${ind}<table class="blk taxes"${this.styleAttr(b.style)}>`,
      `${ind}  <thead>`, `${ind}    <tr><th>Vergi</th><th class="right">Oran</th><th class="right">Matrah</th><th class="right">Tutar</th></tr>`, `${ind}  </thead>`,
      `${ind}  <tbody>`,
      `${ind}    <xsl:for-each select="cac:TaxTotal/cac:TaxSubtotal">`,
      `${ind}      <tr>`,
      `${i}  <td>`,
      `${i}    <xsl:choose>`,
      `${i}      <xsl:when test="string(${escAttr(name.xpath)}) != ''"><xsl:value-of select="${escAttr(name.xpath)}"/></xsl:when>`,
      `${i}      <xsl:otherwise><xsl:value-of select="${escAttr(code.xpath)}"/></xsl:otherwise>`,
      `${i}    </xsl:choose>`,
      `${i}  </td>`,
      `${i}  <td class="right">`, ...this.value(rate, "percent", i + "    "), `${i}  </td>`,
      `${i}  <td class="right">`, ...this.value(base, "money", i + "    "), `${i}  </td>`,
      `${i}  <td class="right">`, ...this.value(amount, "money", i + "    "), `${i}  </td>`,
      `${ind}      </tr>`,
      `${ind}    </xsl:for-each>`,
      `${ind}  </tbody>`,
      `${ind}</table>`,
    ];
  }

  private totals(b: TotalsBlock, ind: string): string[] {
    const out: string[] = [`${ind}<table class="blk totals"${this.styleAttr(b.style)}>`];
    for (const row of b.rows ?? DEFAULT_TOTALS_ROWS) {
      const def = TOTALS_ROWS[row];
      const bound = this.bind(def.field, "document", b.id);
      if (!bound) continue;
      if (row === "payableInWords") {
        out.push(`${ind}  <tr><td colspan="2" class="words"><xsl:value-of select="${escAttr(bound.xpath)}"/></td></tr>`);
        continue;
      }
      const inner = ind + (def.optional ? "    " : "  ");
      if (def.optional) out.push(`${ind}  <xsl:if test="string(${escAttr(bound.xpath)}) != ''">`);
      out.push(`${inner}<tr>`, `${inner}  <th>${esc(def.label)}</th>`, `${inner}  <td>`);
      out.push(...this.value(bound, "money", inner + "    "));
      out.push(`${inner}  </td>`, `${inner}</tr>`);
      if (def.optional) out.push(`${ind}  </xsl:if>`);
    }
    out.push(`${ind}</table>`);
    return out;
  }

  private qr(b: QrBlock, ind: string): string[] {
    this.warn("CG-BLOCK-UNSUPPORTED", "qr block has no XSLT 1.0 rendering without external resources; ETTN rendered as text", b.id);
    const uuid = this.bind("doc.uuid", "document", b.id);
    if (!uuid) return [];
    const size = b.sizeMm !== undefined ? [`width:${num(b.sizeMm)}mm`] : [];
    return [`${ind}<div class="blk blk-qr"${this.styleAttr(b.style, size)}><xsl:value-of select="${escAttr(uuid.xpath)}"/></div>`];
  }

  // ---- sections ----
  private section(s: Section): string[] {
    const blocks = s.blocks as unknown as Block[];
    const columns = Math.max(1, s.columns ?? 1);
    const out: string[] = [`  <xsl:template name="section-${s.id}">`, `    <div class="sec sec-${s.kind}" id="sec-${s.id}">`];
    if (columns === 1) {
      for (const b of blocks) out.push(...this.block(b, "      "));
    } else {
      const width = num(Math.round((100 / columns) * 100) / 100);
      out.push(`      <table class="cols">`, `        <tr>`);
      for (let c = 1; c <= columns; c++) {
        out.push(`          <td style="width:${width}%">`);
        for (const b of blocks) if (Math.min(b.column ?? 1, columns) === c) out.push(...this.block(b, "            "));
        out.push(`          </td>`);
      }
      out.push(`        </tr>`, `      </table>`);
    }
    out.push(`    </div>`, `  </xsl:template>`);
    return out;
  }

  // ---- fixed parts ----
  private css(): string[] {
    const th = this.t.theme, pg = this.t.page;
    const font = th.fontFamily ?? "Arial";
    const primary = th.primaryColor ?? "#000000";
    const border = (th.borderStyle ?? "solid") === "none" ? "0" : `1px ${th.borderStyle ?? "solid"} ${primary}`;
    const m = pg.margins;
    return [
      `@page { size: ${pg.size} ${pg.orientation ?? "portrait"}; margin: ${num(m.top)}mm ${num(m.right)}mm ${num(m.bottom)}mm ${num(m.left)}mm; }`,
      `body { font-family: '${font}', ${FONT_FALLBACK[font] ?? "sans-serif"}; font-size: ${num(th.fontSize ?? 9)}pt; color: ${th.textColor ?? "#000000"}; margin: 0; }`,
      `table { border-collapse: collapse; }`,
      `thead { display: table-header-group; }`,
      `.cols { width: 100%; table-layout: fixed; }`,
      `.cols td { vertical-align: top; padding: 1mm; }`,
      `.sec { margin-bottom: 3mm; }`,
      `.blk { margin: 0.5mm 0; }`,
      `.blk-text { white-space: pre-line; }`,
      `.lbl { font-weight: bold; }`,
      `.lines, .taxes { width: 100%; }`,
      `.lines th, .lines td, .taxes th, .taxes td { border: ${border}; padding: 1mm; }`,
      `.lines th, .taxes th { background: ${primary}; color: #ffffff; }`,
      `.lines tr, .taxes tr, .totals tr { page-break-inside: avoid; }`,
      `.right { text-align: right; }`,
      `.center { text-align: center; }`,
      `.left { text-align: left; }`,
      `.totals { margin-left: auto; min-width: 60mm; }`,
      `.totals th { text-align: left; padding: 0.5mm 2mm; }`,
      `.totals td { text-align: right; padding: 0.5mm 2mm; }`,
      `.totals .words { text-align: left; font-weight: bold; }`,
      `.blk-rule { border: 0; border-top: ${border}; }`,
      `.blk-spacer { height: 4mm; }`,
      `.blk-signature { border: ${border}; width: 60mm; height: 20mm; padding: 1mm; }`,
      `.blk-qr { font-family: 'Courier New', monospace; font-size: 7pt; }`,
    ];
  }

  private variable(v: Variable): string[] {
    switch (v) {
      case "watermark":
        return [`  <xsl:variable name="watermark" select="'${this.t.documentType === "EARSIV" ? "e-Arşiv Fatura" : "e-Fatura"}'"/>`];
      case "payableInWords":
        this.used.add("in-words-tr");
        return [
          `  <xsl:variable name="payableInWords">`,
          `    <xsl:call-template name="in-words-tr"><xsl:with-param name="n" select="/n1:Invoice/cac:LegalMonetaryTotal/cbc:PayableAmount"/></xsl:call-template>`,
          `  </xsl:variable>`,
        ];
      case "page":
        return [`  <xsl:variable name="page" select="''"/>`];
    }
  }

  private named(n: NamedTemplate): string[] {
    switch (n) {
      case "money": return [
        `  <xsl:template name="money">`,
        `    <xsl:param name="v"/>`,
        `    <xsl:param name="cur" select="''"/>`,
        `    <xsl:if test="string(number($v)) != 'NaN'">`,
        `      <xsl:value-of select="format-number($v, '#.##0,00', 'tr')"/>`,
        `      <xsl:choose>`,
        `        <xsl:when test="string($cur) = ''"/>`,
        `        <xsl:when test="$cur = 'TRY'"><xsl:text> TL</xsl:text></xsl:when>`,
        `        <xsl:otherwise><xsl:text> </xsl:text><xsl:value-of select="$cur"/></xsl:otherwise>`,
        `      </xsl:choose>`,
        `    </xsl:if>`,
        `  </xsl:template>`,
      ];
      case "date-tr": return [
        `  <xsl:template name="date-tr">`,
        `    <xsl:param name="d"/>`,
        `    <xsl:if test="string-length($d) >= 10">`,
        `      <xsl:value-of select="concat(substring($d, 9, 2), '-', substring($d, 6, 2), '-', substring($d, 1, 4))"/>`,
        `    </xsl:if>`,
        `  </xsl:template>`,
      ];
      case "number-tr": return [
        `  <xsl:template name="number-tr">`,
        `    <xsl:param name="v"/>`,
        `    <xsl:if test="string(number($v)) != 'NaN'">`,
        `      <xsl:value-of select="format-number($v, '#.##0,##', 'tr')"/>`,
        `    </xsl:if>`,
        `  </xsl:template>`,
      ];
      case "in-words-tr": return [...this.inWords(), ...this.inWordsInt()];
    }
  }

  /** "Yalnız: <lira> TL <kuruş> Kr" for a money amount (ADR-0002: recursive named template). */
  private inWords(): string[] {
    return [
      `  <xsl:template name="in-words-tr">`,
      `    <xsl:param name="n"/>`,
      `    <xsl:if test="string(number($n)) != 'NaN'">`,
      `      <xsl:variable name="k" select="round(number($n) * 100)"/>`,
      `      <xsl:variable name="lira" select="floor($k div 100)"/>`,
      `      <xsl:variable name="kurus" select="$k mod 100"/>`,
      `      <xsl:text>Yalnız: </xsl:text>`,
      `      <xsl:choose>`,
      `        <xsl:when test="$lira = 0"><xsl:text>Sıfır</xsl:text></xsl:when>`,
      `        <xsl:otherwise><xsl:call-template name="in-words-tr-int"><xsl:with-param name="n" select="$lira"/></xsl:call-template></xsl:otherwise>`,
      `      </xsl:choose>`,
      `      <xsl:text> TL</xsl:text>`,
      `      <xsl:if test="$kurus > 0">`,
      `        <xsl:text> </xsl:text>`,
      `        <xsl:call-template name="in-words-tr-int"><xsl:with-param name="n" select="$kurus"/></xsl:call-template>`,
      `        <xsl:text> Kr</xsl:text>`,
      `      </xsl:if>`,
      `    </xsl:if>`,
      `  </xsl:template>`,
    ];
  }

  private inWordsInt(): string[] {
    const call = (sel: string) => `<xsl:call-template name="in-words-tr-int"><xsl:with-param name="n" select="${sel}"/></xsl:call-template>`;
    const out = [`  <xsl:template name="in-words-tr-int">`, `    <xsl:param name="n"/>`, `    <xsl:choose>`];
    for (const [limit, word] of [["1000000000", "Milyar"], ["1000000", "Milyon"]] as const) {
      out.push(`      <xsl:when test="$n >= ${limit}">`, `        ${call(`floor($n div ${limit})`)}`, `        <xsl:text>${word}</xsl:text>`, `        ${call(`$n mod ${limit}`)}`, `      </xsl:when>`);
    }
    for (const [limit, word] of [["1000", "Bin"], ["100", "Yüz"]] as const) {
      out.push(`      <xsl:when test="$n >= ${limit}">`, `        <xsl:if test="$n >= ${2 * Number(limit)}">${call(`floor($n div ${limit})`)}</xsl:if>`,
        `        <xsl:text>${word}</xsl:text>`, `        ${call(`$n mod ${limit}`)}`, `      </xsl:when>`);
    }
    out.push(`      <xsl:when test="$n >= 10">`, `        <xsl:choose>`);
    for (let i = 1; i <= 9; i++) out.push(`          <xsl:when test="floor($n div 10) = ${i}"><xsl:text>${TENS[i]}</xsl:text></xsl:when>`);
    out.push(`        </xsl:choose>`, `        ${call("$n mod 10")}`, `      </xsl:when>`);
    for (let i = 1; i <= 9; i++) out.push(`      <xsl:when test="$n = ${i}"><xsl:text>${ONES[i]}</xsl:text></xsl:when>`);
    out.push(`    </xsl:choose>`, `  </xsl:template>`);
    return out;
  }

  // ---- assembly ----
  generate(): string {
    const seen = new Set<string>();
    for (const s of this.t.sections) {
      if (seen.has(s.id)) this.error("CG-ID-DUPLICATE", `duplicate section id "${s.id}"`, s.id);
      seen.add(s.id);
    }
    // Sections first: they decide which named templates and variables are needed.
    const sections = this.t.sections.map(s => this.section(s));
    const repeating = this.t.sections.filter(s => s.repeatOnEveryPage);
    const flowing = this.t.sections.filter(s => !s.repeatOnEveryPage);
    const variables = VARIABLE_ORDER.filter(v => this.vars.has(v)).flatMap(v => this.variable(v)); // may add in-words-tr
    const named = NAMED_ORDER.filter(n => this.used.has(n)).flatMap(n => this.named(n));

    const call = (s: Section, ind: string) => `${ind}<xsl:call-template name="section-${s.id}"/>`;
    const body: string[] = [];
    if (repeating.length) {
      body.push(`      <table class="page">`, `        <thead>`, `          <tr><td>`);
      for (const s of repeating) body.push(call(s, "            "));
      body.push(`          </td></tr>`, `        </thead>`, `        <tbody>`, `          <tr><td>`);
      for (const s of flowing) body.push(call(s, "            "));
      body.push(`          </td></tr>`, `        </tbody>`, `      </table>`);
    } else {
      for (const s of flowing) body.push(call(s, "      "));
    }

    const title = esc(this.t.name ?? (this.t.documentType === "EARSIV" ? "e-Arşiv Fatura" : "e-Fatura"));
    const lines = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"`,
      `  xmlns:n1="${NS.n1}"`,
      `  xmlns:cbc="${NS.cbc}"`,
      `  xmlns:cac="${NS.cac}"`,
      `  xmlns:ext="${NS.ext}"`,
      `  exclude-result-prefixes="n1 cbc cac ext">`,
      `  <xsl:output method="html" encoding="UTF-8" indent="no"/>`,
      `  <xsl:decimal-format name="tr" decimal-separator="," grouping-separator="."/>`,
      ...variables,
      ...named,
      `  <xsl:template match="/">`,
      `    <html>`,
      `      <head>`,
      `        <meta charset="UTF-8"/>`,
      `        <title>${title}</title>`,
      `        <style>`,
      ...this.css().map(l => `          ${l}`),
      `        </style>`,
      `      </head>`,
      `      <body>`,
      `        <xsl:for-each select="/n1:Invoice">`,
      ...body.map(l => `  ${l}`),
      `        </xsl:for-each>`,
      `      </body>`,
      `    </html>`,
      `  </xsl:template>`,
      ...sections.flat(),
      `</xsl:stylesheet>`,
    ];
    return lines.join("\n") + "\n";
  }
}

export function generate(template: Template, catalog: Catalog): GenerateResult {
  const g = new Gen(template, catalog);
  const xslt = g.generate();
  return { xslt, warnings: g.warnings, errors: g.errors };
}
