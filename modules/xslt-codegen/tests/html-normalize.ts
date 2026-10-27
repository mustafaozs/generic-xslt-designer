/** Whitespace normalisation used to compare engine outputs (contracts/xslt-codegen.md §Golden tests).
 *  Also drops the <meta http-equiv> that libxslt injects for method="html"; browsers do not emit it. */
export function normalizeHtml(html: string): string {
  return html
    .replace(/\r\n?/g, "\n")
    .replace(/<meta http-equiv="Content-Type"[^>]*>/i, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim() + "\n";
}
