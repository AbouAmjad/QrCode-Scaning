/**
 * Printable content box — object (0,0) is top-left inside border + innerMargin.
 */
export function contentBox(spec) {
  const st = (spec && spec.style) || {};
  const labelW = Math.max(1, Number(spec.labelW) || 50);
  const labelH = Math.max(1, Number(spec.labelH) || 30);
  const border = Math.max(0, Number(st.borderWidth) || 0);
  const inset = Math.max(0, Number(spec.innerMargin) || 0);
  const usableW = Math.max(0.1, labelW - 2 * border - 2 * inset);
  const usableH = Math.max(0.1, labelH - 2 * border - 2 * inset);
  return {
    labelW,
    labelH,
    border,
    inset,
    // Absolute left:0 is already inside border (border-box).
    ox: inset,
    oy: inset,
    usableW,
    usableH
  };
}
