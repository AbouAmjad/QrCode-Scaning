/**
 * label-print.js — Print via the same LabelRenderer (no alternate HTML).
 */
import { renderSheet, sharedPrintCss, ensureQrLibrary } from "./label-renderer.js";
import { loadCalibration } from "./label-storage.js";
import { normalizeTemplate } from "./label-model.js";

export async function printLabels(template, items, { flip = false } = {}) {
  await ensureQrLibrary();
  const tpl = normalizeTemplate(template);
  const calibration = loadCalibration();
  const sheet = await renderSheet(tpl, items, {
    mode: "print",
    flip,
    applyCalibration: true,
    calibration,
    className: "lr-print-sheet"
  });

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) throw new Error("Popup blocked — allow popups to print");

  const css = sharedPrintCss(tpl);
  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Print labels</title>
<style>${css}</style>
</head><body></body></html>`);
  w.document.close();
  w.document.body.appendChild(sheet);

  // Wait for images (QR) to decode
  const imgs = [...w.document.images];
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = img.onerror = () => res();
            })
    )
  );

  await new Promise((r) => setTimeout(r, 120));
  w.focus();
  w.print();
}

export default { printLabels };
