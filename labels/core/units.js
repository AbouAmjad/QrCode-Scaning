/**
 * Millimeter geometry helpers.
 * Pixels exist only at paint time: px = mm × dpi / 25.4
 */
export const MM_PER_INCH = 25.4;

export function roundMm(n, places = 3) {
  const f = 10 ** places;
  return Math.round(Number(n) * f) / f;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n)));
}

/** Single conversion path — never chain. */
export function mmToPx(mm, dpi = 96) {
  return (Number(mm) * Number(dpi)) / MM_PER_INCH;
}

export function pxToMm(px, dpi = 96) {
  return (Number(px) * MM_PER_INCH) / Number(dpi);
}

export function mmCss(n) {
  return `${roundMm(n)}mm`;
}

/** Browser CSS-mm → CSS-px factor at reference DPI (96). */
export function cssMmToPxFactor(dpi = 96) {
  return Number(dpi) / MM_PER_INCH;
}
