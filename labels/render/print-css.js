import { createDocument } from "../core/document.js";
import { roundMm } from "../core/units.js";

/** Exact @page CSS shared by iframe printer and same-tab fallback. */
export function sharedPrintCss(docOrPartial) {
  const doc = createDocument(docOrPartial);
  const isThermal = doc.page === "thermal";
  let pageW = isThermal ? doc.labelW : Number(doc.pageW) || 210;
  let pageH = isThermal ? doc.labelH : Number(doc.pageH) || 297;
  if (!isThermal && doc.orientation === "landscape") {
    [pageW, pageH] = [pageH, pageW];
  }
  const size = isThermal
    ? `${roundMm(doc.labelW)}mm ${roundMm(doc.labelH + (Number(doc.gapY) || 0))}mm`
    : `${roundMm(pageW)}mm ${roundMm(pageH)}mm`;

  return `
@page { size: ${size}; margin: 0; }
html, body {
  margin: 0; padding: 0; background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
* { box-sizing: border-box; }
.lr-sheet { margin: 0 auto; }
.lr-label { break-inside: avoid; page-break-inside: avoid; }
${isThermal ? `.lr-label { page-break-after: always; } .lr-label:last-child { page-break-after: auto; }` : ""}
img { image-rendering: -webkit-optimize-contrast; }
`;
}
