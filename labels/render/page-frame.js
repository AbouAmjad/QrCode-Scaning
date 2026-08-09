/**
 * Page frame — label-edge geometry (mm), shared by editor / preview / print.
 *
 * Editor: shown when pageFrame.enabled (default dashed guide).
 * Preview/Print: only when pageFrame.enabled && pageFrame.includeInPrint.
 */

/**
 * @param {object} doc
 * @param {"editor"|"preview"|"print"} mode
 */
export function shouldPaintPageFrame(doc, mode = "preview") {
  const pf = doc?.pageFrame;
  if (!pf || pf.enabled === false) return false;
  if (mode === "editor") return true;
  return !!pf.includeInPrint;
}

/**
 * Build a non-interactive frame element sized to the label shell.
 * @param {object} doc
 * @param {"editor"|"preview"|"print"} mode
 */
export function paintPageFrame(doc, mode = "preview") {
  if (!shouldPaintPageFrame(doc, mode)) return null;
  const pf = doc.pageFrame || {};
  const sw = Math.max(0.05, Number(pf.strokeWidth) || 0.4);
  const color = pf.color || "#2C2C2A";
  // Editor defaults to a light dashed cut guide; print/export follow the dash toggle.
  const dashed = pf.dash !== false;

  const el = document.createElement("div");
  el.className = "lr-page-frame";
  el.dataset.type = "page-frame";
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = [
    "position:absolute",
    "inset:0",
    "width:100%",
    "height:100%",
    "box-sizing:border-box",
    `border:${sw}mm ${dashed ? "dashed" : "solid"} ${color}`,
    "border-radius:0",
    "pointer-events:none",
    "z-index:40",
    mode === "editor" ? "opacity:0.72" : "opacity:1"
  ].join(";");
  return el;
}
