import { renderSheet } from "../render/sheet.js";
import { sharedPrintCss, ensureQrLibrary, ensureBarcodeLibrary } from "../render/engine.js";
import { loadCalibration } from "../data/storage.js";
import { createDocument } from "../core/document.js";
import { printInFrame, printInPlace } from "./frame.js";

export async function printLabels(docOrPartial, items, { flip = false } = {}) {
  await Promise.all([ensureQrLibrary(), ensureBarcodeLibrary().catch(() => {})]);
  const doc = createDocument(docOrPartial);
  const sheet = await renderSheet(doc, items, {
    mode: "print",
    flip,
    applyCalibration: true,
    calibration: loadCalibration(),
    className: "lr-print-sheet"
  });
  const css = sharedPrintCss(doc);
  try {
    await printInFrame("Print labels", css, (_d, body) => {
      body.appendChild(sheet);
    });
  } catch (e) {
    console.warn("[print] iframe failed, using same-tab fallback", e);
    await printInPlace(css, sheet);
  }
}
