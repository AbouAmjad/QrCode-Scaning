/**
 * Multi-label sheet composition — uses renderLabel only.
 */
import { createDocument } from "../core/document.js";
import { renderLabel } from "./engine.js";

export async function renderSheet(docOrPartial, items, options = {}) {
  const doc = createDocument(docOrPartial);
  const sheet = document.createElement("div");
  sheet.className = ["lr-sheet", `lr-page-${doc.page}`, options.className || ""]
    .filter(Boolean)
    .join(" ");

  const isThermal = doc.page === "thermal";
  const flip = !!options.flip;
  const gapX = Number(doc.gapX) || 0;
  const gapY = Number(doc.gapY) || 0;
  const marginX = Number(doc.marginX) || 0;
  const marginY = Number(doc.marginY) || 0;

  if (isThermal) {
    sheet.style.cssText = [
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      `gap:${gapY}mm`,
      `padding:${marginY}mm ${marginX}mm`,
      "box-sizing:border-box",
      "background:#fff"
    ].join(";");
  } else {
    let pageW = Number(doc.pageW) || (doc.page === "a3" ? 297 : 210);
    let pageH = Number(doc.pageH) || (doc.page === "a3" ? 420 : 297);
    if (doc.orientation === "landscape") [pageW, pageH] = [pageH, pageW];
    sheet.style.cssText = [
      `width:${pageW}mm`,
      `min-height:${pageH}mm`,
      "display:grid",
      `grid-template-columns:repeat(${Math.max(1, doc.cols)}, ${doc.labelW}mm)`,
      `grid-auto-rows:${doc.labelH}mm`,
      `gap:${gapY}mm ${gapX}mm`,
      `padding:${marginY}mm ${marginX}mm`,
      "box-sizing:border-box",
      "background:#fff",
      "justify-content:start",
      "align-content:start"
    ].join(";");
  }

  const list = items?.length ? items : [{ code: "I1001", name: "Product name" }];
  for (let i = 0; i < list.length; i++) {
    let flipped = false;
    if (flip) {
      if (isThermal) flipped = i % 2 === 1;
      else {
        const cols = Math.max(1, doc.cols);
        flipped = Math.floor(i / cols) % 2 === 1;
      }
    }
    const label = await renderLabel(doc, list[i], {
      ...options,
      mode: options.mode || "preview",
      flipped,
      applyCalibration: options.applyCalibration !== false
    });
    sheet.appendChild(label);
  }
  return sheet;
}
