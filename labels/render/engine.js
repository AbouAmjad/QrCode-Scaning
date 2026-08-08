/**
 * THE single label rendering engine.
 * Editor, Preview, Print, and Export all call renderLabel / renderSheet.
 */
import { createDocument, bindItem } from "../core/document.js";
import { layoutAbsolute, labelShellCss, mirrorLayers } from "../layout/index.js";
import { paintElement } from "./paint-element.js";
import { paintPageFrame } from "./page-frame.js";

export { ensureQrLibrary } from "./qr-bitmap.js";
export { ensureBarcodeLibrary } from "./barcode-bitmap.js";
export { sharedPrintCss } from "./print-css.js";
export { shouldPaintPageFrame, paintPageFrame } from "./page-frame.js";

/**
 * @param {object} docOrPartial
 * @param {object|null} item  { code, name, imageUrl }
 * @param {object} options
 *   mode: 'editor'|'preview'|'print'
 *   applyCalibration, calibration, flipped, interactive, className, dpi
 */
export async function renderLabel(docOrPartial, item = null, options = {}) {
  const doc = createDocument(docOrPartial);
  const mode = options.mode || "preview";
  const applyCalibration = options.applyCalibration ?? mode !== "editor";

  let layers = item ? bindItem(doc, item) : doc.layers;
  if (options.flipped) layers = mirrorLayers(layers, doc);

  const laid = layoutAbsolute(doc, layers, {
    applyCalibration,
    calibration: options.calibration
  });

  const root = document.createElement("div");
  root.className = ["lr-label", options.className || "", `lr-mode-${mode}`]
    .filter(Boolean)
    .join(" ");
  root.style.cssText = labelShellCss(doc, laid.shell);
  root.dataset.labelW = String(doc.labelW);
  root.dataset.labelH = String(doc.labelH);
  if (item?.code) root.dataset.code = item.code;

  const dpi = options.dpi || laid.shell.dpi || 192;

  for (const obj of laid.objects) {
    const node = await paintElement(obj, doc, { dpi });
    if (options.interactive) {
      node.classList.add("lr-interactive");
      node.style.pointerEvents = obj.locked ? "none" : "auto";
    } else {
      node.style.pointerEvents = "none";
    }
    root.appendChild(node);
  }

  // Page frame uses real label mm geometry (auto-follows labelW×labelH).
  const frame = paintPageFrame(doc, mode);
  if (frame) root.appendChild(frame);

  return root;
}