/**
 * label-units.js — Millimeter geometry helpers.
 * All label math is mm. Pixels are derived only at paint time.
 */
export const MM_PER_INCH = 25.4;

export function roundMm(n, places = 3) {
  const f = 10 ** places;
  return Math.round(Number(n) * f) / f;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Number(n)));
}

/** Single conversion: pixels = mm × DPI / 25.4 */
export function mmToPx(mm, dpi = 96) {
  return (Number(mm) * Number(dpi)) / MM_PER_INCH;
}

export function pxToMm(px, dpi = 96) {
  return (Number(px) * MM_PER_INCH) / Number(dpi);
}

/** Screen CSS uses mm directly — browser converts for display. */
export function mmCss(n) {
  return `${roundMm(n)}mm`;
}

export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function uid(prefix = "ly") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
